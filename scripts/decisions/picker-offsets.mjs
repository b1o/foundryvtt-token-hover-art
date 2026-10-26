/*
 * The position that the user dragged the gallery picker to: a plain translation in screen pixels from a reference
 * point to the picker top-left corner. position = point + offset. No Foundry and no DOM access.
 *
 * - Token reference (picker from the Token HUD): the token center on the screen, so the picker follows the token.
 * - Screen reference (every other trigger): the viewport top-left corner, so the offset is the screen position.
 *
 * The offsets are in screen pixels, not canvas units: the picker has a fixed screen size, so its distance to the
 * token stays the same at every canvas zoom.
 */

/**
 * @typedef {object} PickerOffset
 * @property {number} x  The picker left minus the reference point X.
 * @property {number} y  The picker top minus the reference point Y.
 */

/**
 * @typedef {object} Point
 * @property {number} x
 * @property {number} y
 */

/** The reference point of the screen reference. */
export const SCREEN_ORIGIN = Object.freeze({x: 0, y: 0});

/**
 * @param {import("./screen-geometry.mjs").Rect} token  The token rectangle on the screen.
 * @returns {Point}  The reference point of the token reference.
 */
export function getTokenOrigin(token) {
  return {x: token.left + (token.width / 2), y: token.top + (token.height / 2)};
}

/**
 * @param {{left: number, top: number}} picker  The picker position on the screen.
 * @param {Point} origin
 * @returns {PickerOffset}
 */
export function toOffset(picker, origin) {
  return {x: picker.left - origin.x, y: picker.top - origin.y};
}

/**
 * @param {PickerOffset} offset
 * @param {Point} origin
 * @returns {{left: number, top: number}}  Not clamped: the caller keeps the picker inside the viewport.
 */
export function fromOffset(offset, origin) {
  return {left: origin.x + offset.x, top: origin.y + offset.y};
}

/**
 * @param {*} value  A stored value.
 * @returns {boolean}  Is the value a valid PickerOffset?
 */
export function isOffset(value) {
  return Number.isFinite(value?.x) && Number.isFinite(value?.y);
}
