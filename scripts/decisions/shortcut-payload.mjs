/*
 * The drag payload of the gallery picker (docs/design-trigger-points.md 7.2). One format for a move inside the picker
 * and for a drop on the hotbar.
 */

export const SHORTCUT_TYPE = "token-hover-art.Shortcut";

/**
 * @typedef {object} ShortcutPayload
 * @property {"token-hover-art.Shortcut"} type
 * @property {"gallery"|"category"|"asset"} kind
 * @property {string} tokenUuid
 * @property {string|null} categoryId   Set for the kind "category".
 * @property {string|null} path         For the kind "asset": the asset, or null for "No hover art".
 */

/**
 * @param {object} source
 * @param {ShortcutPayload["kind"]} source.kind
 * @param {string} source.tokenUuid
 * @param {string|null} [source.categoryId]
 * @param {string|null} [source.path]
 * @returns {ShortcutPayload}
 */
export function createShortcutPayload({kind, tokenUuid, categoryId = null, path = null}) {
  return {
    type: SHORTCUT_TYPE,
    kind,
    tokenUuid,
    categoryId: (kind === "category") ? categoryId : null,
    path: (kind === "asset") ? path : null
  };
}
