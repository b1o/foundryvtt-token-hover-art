import { MODULE_ID, FLAGS } from "../constants.mjs";
import { mayOwnersManageGallery } from "../settings.mjs";
import { mayManageGallery } from "../decisions/gallery-rules.mjs";
import { hasVideoExtension } from "../compat.mjs";

/*
 * All reads and writes of the gallery, selection, and secret data go through this file.
 *
 * Gallery:   the manual images plus the files of all folder sources. All tokens of the Actor share it.
 *            Manual images: flags.token-hover-art.images on the world (base) Actor.
 *            Folders:       flags.token-hover-art.folders on the world (base) Actor. Each entry stores the result
 *                           of its last scan, so users without the file browser permission can read the files.
 * Selection: flags.token-hover-art.selected on each TokenDocument. Each token can show a different image.
 * Secret:    flags.token-hover-art.secret on each TokenDocument. Only GMs and owners see secret art.
 * Defaults:  the same two token flags on Actor#prototypeToken. Foundry copies them into each new token.
 */

/**
 * Return the world Actor that holds the gallery.
 * An unlinked token has a synthetic Actor. A write to the synthetic Actor goes into the token's ActorDelta,
 * and then the other tokens of the Actor do not see it. So the gallery always uses the base Actor.
 * @param {Actor|null} actor
 * @returns {Actor|null}
 */
export function getBaseActor(actor) {
  if ( !actor ) return null;
  return actor.isToken ? (actor.token?.baseActor ?? null) : actor;
}

/**
 * Can a user manage the gallery of this Actor? See mayManageGallery for the rule.
 * @param {Actor|null} actor  A base or a synthetic Actor.
 * @param {User} user
 * @returns {boolean}
 */
export function canManageGallery(actor, user) {
  const baseActor = getBaseActor(actor);
  return mayManageGallery({
    hasActor: !!baseActor,
    isInCompendium: !!baseActor?.pack,
    isGM: user.isGM,
    isOwner: !!baseActor?.testUserPermission(user, "OWNER"),
    ownersMayManage: mayOwnersManageGallery()
  });
}

/**
 * @typedef {import("../decisions/folder-list.mjs").FolderSource} FolderSource
 */

/**
 * @param {Actor|null} actor  A base or a synthetic Actor.
 * @returns {string[]}        All paths in the gallery: the manual images first, then the files of each folder.
 */
export function getGallery(actor) {
  const folderFiles = getFolderSources(actor).flatMap(f => f.files);
  return [...new Set([...getManualImages(actor), ...folderFiles])];
}

/**
 * @param {Actor|null} actor  A base or a synthetic Actor.
 * @returns {string[]}        The images that were added one by one.
 */
export function getManualImages(actor) {
  const images = getBaseActor(actor)?.getFlag(MODULE_ID, FLAGS.IMAGES);
  return Array.isArray(images) ? images : [];
}

/**
 * Replace the manual images. Duplicate and empty paths are removed.
 * @param {Actor} actor
 * @param {string[]} paths
 * @returns {Promise<void>}
 */
export async function setManualImages(actor, paths) {
  const unique = [...new Set(paths.filter(p => typeof p === "string" && p.trim()))];
  await getBaseActor(actor).setFlag(MODULE_ID, FLAGS.IMAGES, unique);
  await reconcileDefaultArt(actor);
}

/**
 * @param {Actor|null} actor  A base or a synthetic Actor.
 * @returns {FolderSource[]}
 */
export function getFolderSources(actor) {
  const folders = getBaseActor(actor)?.getFlag(MODULE_ID, FLAGS.FOLDERS);
  return Array.isArray(folders) ? folders : [];
}

/**
 * Replace the folder sources.
 * @param {Actor} actor
 * @param {FolderSource[]} folders
 * @returns {Promise<void>}
 */
export async function setFolderSources(actor, folders) {
  await getBaseActor(actor).setFlag(MODULE_ID, FLAGS.FOLDERS, folders);
  await reconcileDefaultArt(actor);
}

/**
 * The default art of new tokens must be in the gallery. The two gallery writers above call this after each write, so
 * every way to remove an image applies the rule: a manual removal, a folder removal, and a scan that no longer finds
 * a file. Tokens that selected the image keep it, because the file can still exist.
 * @param {Actor} actor
 * @returns {Promise<void>}
 */
async function reconcileDefaultArt(actor) {
  const defaultArt = getDefaultArt(actor);
  if ( defaultArt && !getGallery(actor).includes(defaultArt) ) await clearDefaultArt(actor);
}

/**
 * @param {object} change  The change object of an updateToken or updateActor hook.
 * @returns {boolean}      Did the update change a flag of this module?
 */
export function hasModuleFlagChange(change) {
  return foundry.utils.hasProperty(change, `flags.${MODULE_ID}`);
}

/**
 * @param {TokenDocument} tokenDoc
 * @returns {string|null}  The selected hover art path, or null if the token has no hover art.
 */
export function getSelectedArt(tokenDoc) {
  return tokenDoc?.getFlag(MODULE_ID, FLAGS.SELECTED) || null;
}

/**
 * Give a token the hover art of one gallery asset. This is the only way to change the selection, so every trigger
 * point applies the same rule: the path must be in the gallery of the token's Actor at the moment of the change.
 * @param {TokenDocument} tokenDoc
 * @param {string|null} path  A gallery path, or null for "No hover art".
 * @returns {Promise<TokenDocument>}
 * @throws {Error}  If the path is not in the gallery.
 */
export function applyAsset(tokenDoc, path) {
  if ( path === null ) return tokenDoc.unsetFlag(MODULE_ID, FLAGS.SELECTED);
  if ( !getGallery(tokenDoc.actor).includes(path) ) {
    throw new Error(game.i18n.localize("TOKEN_HOVER_ART.Errors.NotInGallery"));
  }
  return tokenDoc.setFlag(MODULE_ID, FLAGS.SELECTED, path);
}

/**
 * @param {TokenDocument} tokenDoc
 * @returns {boolean}
 */
export function isSecret(tokenDoc) {
  return tokenDoc?.getFlag(MODULE_ID, FLAGS.SECRET) === true;
}

/**
 * @param {TokenDocument} tokenDoc
 * @param {boolean} secret
 * @returns {Promise<TokenDocument>}
 */
export function setSecret(tokenDoc, secret) {
  return tokenDoc.setFlag(MODULE_ID, FLAGS.SECRET, secret);
}

/**
 * Can the current user see the hover art of this token?
 * GMs and owners always can. Other users can only if the art is not secret.
 * @param {TokenDocument} tokenDoc
 * @returns {boolean}
 */
export function canViewArt(tokenDoc) {
  return !isSecret(tokenDoc) || tokenDoc.isOwner;
}

/**
 * @param {Actor} actor
 * @returns {string|null}  The hover art that new tokens of this Actor start with.
 */
export function getDefaultArt(actor) {
  const flags = getBaseActor(actor)?.prototypeToken.flags;
  return foundry.utils.getProperty(flags ?? {}, `${MODULE_ID}.${FLAGS.SELECTED}`) || null;
}

/**
 * @param {Actor} actor
 * @param {string} path
 * @returns {Promise<Actor>}
 */
export function setDefaultArt(actor, path) {
  return getBaseActor(actor).update({[`prototypeToken.flags.${MODULE_ID}.${FLAGS.SELECTED}`]: path});
}

/**
 * @param {Actor} actor
 * @returns {Promise<Actor>}
 */
export function clearDefaultArt(actor) {
  return getBaseActor(actor).update({[`prototypeToken.flags.${MODULE_ID}.-=${FLAGS.SELECTED}`]: null});
}

/**
 * @param {Actor} actor
 * @returns {boolean}  Do new tokens of this Actor start with secret hover art?
 */
export function isDefaultSecret(actor) {
  const flags = getBaseActor(actor)?.prototypeToken.flags;
  return foundry.utils.getProperty(flags ?? {}, `${MODULE_ID}.${FLAGS.SECRET}`) === true;
}

/**
 * @param {Actor} actor
 * @param {boolean} secret
 * @returns {Promise<Actor>}
 */
export function setDefaultSecret(actor, secret) {
  return getBaseActor(actor).update({[`prototypeToken.flags.${MODULE_ID}.${FLAGS.SECRET}`]: secret});
}

/**
 * @param {string} path
 * @returns {boolean}  Is the path a video file (webm, mp4, ...)?
 */
export function isVideo(path) {
  return hasVideoExtension(path);
}
