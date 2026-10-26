/*
 * Changes to the list of folder sources. Each function takes the list as it is right before the write, and returns
 * the new list. A folder scan takes time, and another user (or another action of this user) can change the list
 * during the scan, so the change is applied to the current list, not to the list from before the scan
 * (FOUNDRY_MODULE_RULES.md 4.1). No Foundry access.
 */

/**
 * @typedef {object} FolderSource
 * @property {string} source       The file storage: "data", "public", or "s3".
 * @property {string|null} bucket  The S3 bucket, if the source is "s3".
 * @property {string} folder       The folder path in the storage, without a trailing slash.
 * @property {string} filter       A glob pattern for the file names.
 * @property {string[]} files      The files that the last scan found.
 */

/**
 * @typedef {Pick<FolderSource, "source"|"bucket"|"folder"|"filter">} FolderKey
 * The identity of a folder source: two entries with the same key scan the same files.
 */

/**
 * @param {FolderKey} a
 * @param {FolderKey} b
 * @returns {boolean}  Do both entries scan the same folder with the same filter?
 */
export function isSameFolder(a, b) {
  return (a.source === b.source) && (a.bucket === b.bucket) && (a.folder === b.folder) && (a.filter === b.filter);
}

/**
 * @param {FolderSource[]} current
 * @param {FolderKey} key
 * @param {FolderKey|null} [ignored]  An entry that does not count, for example the entry that a change replaces.
 * @returns {boolean}  Does the list have an entry with this key?
 */
export function hasFolder(current, key, ignored = null) {
  return current.some(f => isSameFolder(f, key) && !(ignored && isSameFolder(f, ignored)));
}

/**
 * @param {FolderSource[]} current
 * @param {FolderKey} target       The entry before the change.
 * @param {FolderSource} changed   The entry with the new filter and its scanned files.
 * @returns {FolderSource[]|null}  The new list, or null if the target is gone.
 */
export function replaceFolder(current, target, changed) {
  const index = current.findIndex(f => isSameFolder(f, target));
  if ( index < 0 ) return null;
  return current.map((f, i) => (i === index) ? changed : f);
}

/**
 * @param {FolderSource[]} current
 * @param {FolderKey} target
 * @returns {FolderSource[]|null}  The list without the target, or null if the target is gone already.
 */
export function removeFolder(current, target) {
  const folders = current.filter(f => !isSameFolder(f, target));
  return (folders.length === current.length) ? null : folders;
}

/**
 * Apply scan results to the current list. An entry without a result (its scan failed, or another user added it
 * during the scan) keeps its files. A result for an entry that another user removed during the scan is dropped.
 * @param {FolderSource[]} current
 * @param {{key: FolderKey, files: string[]}[]} results
 * @returns {FolderSource[]|null}  The new list, or null if no file list changed.
 */
export function applyScanResults(current, results) {
  let changed = false;
  const folders = current.map(entry => {
    const result = results.find(r => isSameFolder(r.key, entry));
    if ( !result || isSameFileList(result.files, entry.files) ) return entry;
    changed = true;
    return {...entry, files: result.files};
  });
  return changed ? folders : null;
}

/**
 * @param {string[]} a  A sorted file list.
 * @param {string[]} b  A sorted file list.
 * @returns {boolean}
 */
function isSameFileList(a, b) {
  return (a.length === b.length) && a.every((path, i) => path === b[i]);
}
