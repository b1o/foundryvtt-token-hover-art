/*
 * The position that the user dragged the gallery picker to: a plain translation in screen pixels from the default
 * place of the picker to its top-left corner. position = default place + offset. No Foundry and no DOM access.
 *
 * The default place comes from the trigger (picker-placement.mjs): left of the Token HUD button, or the viewport
 * center for the hotbar. So a moved picker acts as a picker at its default place, only shifted: a picker from the HUD
 * follows the HUD button on a pan, a zoom, and a token move (user decision 2026-10-26, after v0.5.0).
 *
 * The offsets are in screen pixels, not canvas units: the picker has a fixed screen size.
 */

/**
 * Marks an offset from the default place. v0.5.0 stored offsets from the token center or the screen origin, without
 * this mark; such an offset would put the picker at another place, so it counts as no offset.
 */
const OFFSET_BASE = "default";

/**
 * @typedef {object} PickerOffset
 * @property {number} x       The picker left minus the default left.
 * @property {number} y       The picker top minus the default top.
 * @property {"default"} from
 */

/**
 * @typedef {object} Position
 * @property {number} left
 * @property {number} top
 */

/**
 * @param {import("./screen-geometry.mjs").Rect} token  The token rectangle on the screen.
 * @returns {number}  The height of the token center. The picker from the HUD has its vertical center there.
 */
export function getTokenCenterY(token) {
  return token.top + (token.height / 2);
}

/**
 * @param {Position} picker   The picker position on the screen.
 * @param {Position} base     The default place of the picker now (not clamped).
 * @returns {PickerOffset}
 */
export function toOffset(picker, base) {
  return {x: picker.left - base.left, y: picker.top - base.top, from: OFFSET_BASE};
}

/**
 * @param {PickerOffset} offset
 * @param {Position} base     The default place of the picker now (not clamped).
 * @returns {Position}  Not clamped: the caller keeps the picker inside the viewport.
 */
export function fromOffset(offset, base) {
  return {left: base.left + offset.x, top: base.top + offset.y};
}

/**
 * @param {*} value  A stored value.
 * @returns {boolean}  Is the value a valid offset from the default place?
 */
export function isOffset(value) {
  return Number.isFinite(value?.x) && Number.isFinite(value?.y) && (value?.from === OFFSET_BASE);
}
