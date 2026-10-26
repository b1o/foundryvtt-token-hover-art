/*
 * Screen positions that keep their place when the window size changes. The hover display uses them now, and the
 * gallery picker will use them for a pinned position. No Foundry and no DOM access: the callers pass the values.
 */

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * A position relative to the nearest horizontal and vertical screen edge. An element at this position grows away
 * from those edges, toward the screen center. The distances are fractions of the screen size.
 * @typedef {object} EdgePosition
 * @property {"left"|"right"} anchorX  The horizontal screen edge that the element keeps its distance to.
 * @property {number} x                The distance to that edge, as a fraction of the screen width (0 to 1).
 * @property {"top"|"bottom"} anchorY  The vertical screen edge that the element keeps its distance to.
 * @property {number} y                The distance to that edge, as a fraction of the screen height (0 to 1).
 */

/**
 * @typedef {object} Rect
 * @property {number} left
 * @property {number} top
 * @property {number} right
 * @property {number} bottom
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {object} Size
 * @property {number} width
 * @property {number} height
 */

/**
 * @param {Rect} rect      The screen rectangle of the element.
 * @param {Size} viewport
 * @returns {EdgePosition}
 */
export function toEdgePosition(rect, viewport) {
  const anchorX = ((rect.left + (rect.width / 2)) < (viewport.width / 2)) ? "left" : "right";
  const anchorY = ((rect.top + (rect.height / 2)) < (viewport.height / 2)) ? "top" : "bottom";
  const x = (anchorX === "left") ? rect.left : (viewport.width - rect.right);
  const y = (anchorY === "top") ? rect.top : (viewport.height - rect.bottom);
  return {anchorX, x: clamp(x / viewport.width, 0, 1), anchorY, y: clamp(y / viewport.height, 0, 1)};
}

/**
 * @param {*} value  A stored value.
 * @returns {boolean}  Is the value a valid EdgePosition?
 */
export function isEdgePosition(value) {
  return ["left", "right"].includes(value?.anchorX) && ["top", "bottom"].includes(value?.anchorY)
    && Number.isFinite(value.x) && Number.isFinite(value.y);
}
