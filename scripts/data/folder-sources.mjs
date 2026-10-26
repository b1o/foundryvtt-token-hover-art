import { getDefaultFilter } from "../settings.mjs";
import { getFolderSources, setFolderSources } from "./gallery-data.mjs";
import { hasFolder, replaceFolder, removeFolder, applyScanResults } from "../decisions/folder-list.mjs";
import { getFilePickerClass } from "../compat.mjs";
import { log } from "../output.mjs";

/*
 * Folder sources use the core wildcard browse, the same mechanism as "Randomize Wildcard Images" on tokens.
 * The server lists one folder (not recursive) and matches each file name with minimatch(name, filter).
 * So the filter is a glob on the file name: "*.png", "hero-*.webp", or "{*.png,*.webp}". The match is case-sensitive.
 *
 * The server answers only users with the FILES_BROWSE permission. So a scan stores its result in the
 * Actor flag, and all other users read that stored result.
 *
 * Writes: each action scans first, then reads the current list and applies its change to it (folder-list.mjs).
 * The writes of this client run one after the other, so a write always reads the result of the write before it.
 * Writes of two different clients at the same moment can still overwrite each other: Foundry has no transaction for
 * a flag, and the next scan repairs a lost file list.
 */

/** Only image and video files can be hover art. The server applies this list together with the filter. */
const MEDIA_EXTENSIONS = Object.keys(CONST.IMAGE_FILE_EXTENSIONS)
  .concat(Object.keys(CONST.VIDEO_FILE_EXTENSIONS))
  .map(ext => `.${ext}`);

/**
 * @typedef {import("../decisions/folder-list.mjs").FolderSource} FolderSource
 */

/**
 * @typedef {object} RescanResult
 * @property {boolean} changed           Did a file list change?
 * @property {string[]} failedFolders    The folders that could not be scanned. They keep their last result.
 */

export class FolderSources {

  /** The last write of this client. The next write starts when it ends. */
  #lastWrite = Promise.resolve();

  /**
   * @returns {boolean}  Can the current user scan folders?
   */
  canScan() {
    return game.user.can("FILES_BROWSE");
  }

  /**
   * Add a folder source to the Actor and scan it.
   * @param {Actor} actor
   * @param {object} data
   * @param {string} data.folder           The folder path.
   * @param {string} [data.filter]         The file name filter. Empty means the default filter.
   * @param {string} [data.source]         The storage. If it is missing, it comes from the path (see sourceOfPath).
   * @param {string|null} [data.bucket]    The S3 bucket. An empty value means no bucket.
   * @returns {Promise<FolderSource>}      The added entry.
   * @throws {Error}  If the gallery has this folder with this filter already.
   */
  async add(actor, {folder, filter, source, bucket}) {
    const path = normalizeFolder(folder);
    const entry = {
      source: source ?? sourceOfPath(path),
      bucket: bucket || null,
      folder: path,
      filter: normalizeFilter(filter),
      files: []
    };
    // Check before the scan too, so a duplicate fails at once and does not scan the folder for nothing.
    if ( hasFolder(getFolderSources(actor), entry) ) throw alreadyAddedError();
    entry.files = await scanFolder(entry);
    await this.#write(actor, current => {
      if ( hasFolder(current, entry) ) throw alreadyAddedError();
      return [...current, entry];
    });
    return entry;
  }

  /**
   * Change the filter of a folder source and scan the folder again.
   * @param {Actor} actor
   * @param {number} index   The index of the entry in the list that the user sees now.
   * @param {string} filter
   * @returns {Promise<void>}
   * @throws {Error}  If another entry has the same folder with the new filter.
   */
  async setFilter(actor, index, filter) {
    const target = getFolderSources(actor)[index];
    if ( !target ) return;
    const changed = {...target, filter: normalizeFilter(filter)};
    changed.files = await scanFolder(changed);
    await this.#write(actor, current => {
      if ( hasFolder(current, changed, target) ) throw alreadyAddedError();
      return replaceFolder(current, target, changed);
    });
  }

  /**
   * Remove a folder source. Tokens that selected one of its files keep the selection.
   * @param {Actor} actor
   * @param {number} index  The index of the entry in the list that the user sees now.
   * @returns {Promise<void>}
   */
  async remove(actor, index) {
    const target = getFolderSources(actor)[index];
    if ( target ) await this.#write(actor, current => removeFolder(current, target));
  }

  /**
   * Scan all folder sources again. Write to the Actor only if a file list changed, because each write
   * sends an update to all clients and renders the sheets and the pickers again.
   * A folder that cannot be scanned keeps its last result. The caller tells the user about it.
   * @param {Actor} actor
   * @returns {Promise<RescanResult>}
   */
  async rescan(actor) {
    const results = [];
    const failedFolders = [];
    for ( const entry of getFolderSources(actor) ) {
      try {
        results.push({key: entry, files: await scanFolder(entry)});
      } catch(err) {
        log.warn(`Cannot scan the folder "${entry.folder}".`, err);
        failedFolders.push(entry.folder);
      }
    }
    const changed = await this.#write(actor, current => applyScanResults(current, results));
    return {changed, failedFolders};
  }

  /**
   * Run a change after the last write of this client, on the list as it is at that moment.
   * @param {Actor} actor
   * @param {function(FolderSource[]): (FolderSource[]|null)} change  Returns the new list, or null for no write.
   * @returns {Promise<boolean>}  Did the change write a new list?
   */
  #write(actor, change) {
    const write = this.#lastWrite.then(async () => {
      const folders = change(getFolderSources(actor));
      if ( !folders ) return false;
      await setFolderSources(actor, folders);
      return true;
    });
    // A failed write must not stop the writes after it. The caller of this write gets its error.
    this.#lastWrite = write.then(() => undefined, () => undefined);
    return write;
  }
}

/**
 * Normalize a filter. An empty filter becomes the default filter of the world.
 * @param {string} filter
 * @returns {string}
 * @throws {Error}     If the filter contains a "/". The filter matches file names, not paths.
 */
function normalizeFilter(filter) {
  const value = (filter ?? "").trim() || getDefaultFilter();
  if ( value.includes("/") ) throw new Error(game.i18n.localize("TOKEN_HOVER_ART.Folders.FilterHasSlash"));
  return value;
}

/**
 * List the files in the folder that match the filter.
 * @param {FolderSource} entry
 * @returns {Promise<string[]>}  The file paths, sorted by name.
 */
async function scanFolder({source, bucket, folder, filter}) {
  const options = {wildcard: true, extensions: MEDIA_EXTENSIONS};
  if ( bucket ) options.bucket = bucket;
  const result = await getFilePickerClass().browse(source, `${folder}/${filter}`, options);
  return [...result.files].sort((a, b) => a.localeCompare(b));
}

/**
 * @param {string} folder
 * @returns {string}  The folder without a trailing slash.
 */
function normalizeFolder(folder) {
  const value = (folder ?? "").trim().replace(/\/+$/, "");
  if ( !value ) throw new Error(game.i18n.localize("TOKEN_HOVER_ART.Folders.NoFolder"));
  return value;
}

/**
 * Find the storage of a typed folder path. Core uses the same rule for wildcard token images
 * (Files.parseWildcardPath): paths in "icons/" are in the public storage, all other paths are in the data storage.
 * @param {string} folder
 * @returns {string}
 */
function sourceOfPath(folder) {
  return folder.startsWith("icons/") ? "public" : "data";
}

/** @returns {Error} */
function alreadyAddedError() {
  return new Error(game.i18n.localize("TOKEN_HOVER_ART.Folders.AlreadyAdded"));
}
