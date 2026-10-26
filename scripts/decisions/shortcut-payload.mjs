/*
 * The drag payload of the gallery picker and the shortcut data of a hotbar macro (docs/design-trigger-points.md 7.2
 * and 7.3). One format for a move inside the picker and for a drop on the hotbar. The macro keeps the payload without
 * its type in its flags, and every read validates it (FOUNDRY_MODULE_RULES.md 7.4).
 */

export const SHORTCUT_TYPE = "token-hover-art.Shortcut";

const KINDS = Object.freeze(["gallery", "category", "asset"]);

/**
 * @typedef {object} Shortcut
 * @property {"gallery"|"category"|"asset"} kind
 * @property {string} tokenUuid
 * @property {string|null} categoryId   Set for the kind "category".
 * @property {string|null} path         For the kind "asset": the asset, or null for "No hover art".
 */

/**
 * @typedef {Shortcut & {type: "token-hover-art.Shortcut"}} ShortcutPayload
 */

/**
 * @param {object} source
 * @param {Shortcut["kind"]} source.kind
 * @param {string} source.tokenUuid
 * @param {string|null} [source.categoryId]
 * @param {string|null} [source.path]
 * @returns {ShortcutPayload}
 */
export function createShortcutPayload({kind, tokenUuid, categoryId = null, path = null}) {
  return {type: SHORTCUT_TYPE, ...toShortcut({kind, tokenUuid, categoryId, path})};
}

/**
 * @param {unknown} data  The drag data of a drop.
 * @returns {boolean}  Is it a drag from this module? Then the module handles the drop, also if the data is invalid.
 */
export function isShortcutDrop(data) {
  return (typeof data === "object") && (data !== null) && (data.type === SHORTCUT_TYPE);
}

/**
 * Validate shortcut data from a drop or from macro flags.
 * @param {unknown} data
 * @returns {Shortcut|null}  The shortcut with only its known fields, or null if the data is invalid.
 */
export function readShortcut(data) {
  if ( (typeof data !== "object") || (data === null) ) return null;
  const {kind, tokenUuid, categoryId, path} = data;
  if ( !KINDS.includes(kind) || !isFilledString(tokenUuid) ) return null;
  if ( (kind === "category") && !isFilledString(categoryId) ) return null;
  if ( (kind === "asset") && (path !== null) && !isFilledString(path) ) return null;
  return toShortcut({kind, tokenUuid, categoryId, path});
}

/**
 * @param {Shortcut|null} a
 * @param {Shortcut|null} b
 * @returns {boolean}  Do both open or set the same thing? A macro with the same shortcut is reused.
 */
export function isSameShortcut(a, b) {
  if ( !a || !b ) return false;
  return (a.kind === b.kind) && (a.tokenUuid === b.tokenUuid) && (a.categoryId === b.categoryId) && (a.path === b.path);
}

/**
 * @param {string[]} parts  The token name, then the category path or the file name.
 * @returns {string}  The parts of a shortcut name, as the picker breadcrumb shows them.
 */
export function joinNameParts(parts) {
  return parts.join(" › ");
}

/**
 * @param {Shortcut} shortcut
 * @returns {Shortcut}  Only the field of its kind is set.
 */
function toShortcut({kind, tokenUuid, categoryId, path}) {
  return {
    kind,
    tokenUuid,
    categoryId: (kind === "category") ? categoryId : null,
    path: (kind === "asset") ? path : null
  };
}

function isFilledString(value) {
  return (typeof value === "string") && (value.length > 0);
}
