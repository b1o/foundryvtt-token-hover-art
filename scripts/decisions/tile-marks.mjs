/*
 * The multi-select of the gallery picker (docs/design-trigger-points.md 6.4). A marked tile is part of the next move.
 * The word "selection" is not used here, because it means the hover art of a token.
 *
 * A tile key is "asset:<path>" or "category:<id>". The order is the tile order on the screen.
 */

/**
 * @typedef {object} TileMarks
 * @property {string[]} keys        The marked tiles, in the order of marking.
 * @property {string|null} anchor   The start of the next range.
 */

/** @type {TileMarks} */
export const NO_MARKS = Object.freeze({keys: [], anchor: null});

const ASSET_PREFIX = "asset:";
const CATEGORY_PREFIX = "category:";

/**
 * @param {string} path
 * @returns {string}
 */
export const assetKey = path => `${ASSET_PREFIX}${path}`;

/**
 * @param {string} id
 * @returns {string}
 */
export const categoryKey = id => `${CATEGORY_PREFIX}${id}`;

/**
 * A plain click: no marks, and the clicked tile starts the next range.
 * @param {string} key
 * @returns {TileMarks}
 */
export function startAt(key) {
  return {keys: [], anchor: key};
}

/**
 * Ctrl+click: mark the tile, or remove its mark.
 * @param {TileMarks} marks
 * @param {string} key
 * @returns {TileMarks}
 */
export function toggleMark(marks, key) {
  const keys = marks.keys.includes(key) ? marks.keys.filter(k => k !== key) : [...marks.keys, key];
  return {keys, anchor: key};
}

/**
 * Shift+click: mark the range from the anchor to the tile, instead of the old marks.
 * @param {TileMarks} marks
 * @param {string[]} order  The tile keys on the screen.
 * @param {string} key
 * @returns {TileMarks}
 */
export function markRange(marks, order, key) {
  return {keys: getRange(marks, order, key), anchor: getAnchor(marks, order, key)};
}

/**
 * Ctrl+Shift+click: add the range from the anchor to the tile to the old marks.
 * @param {TileMarks} marks
 * @param {string[]} order
 * @param {string} key
 * @returns {TileMarks}
 */
export function addRange(marks, order, key) {
  const keys = [...new Set([...marks.keys, ...getRange(marks, order, key)])];
  return {keys, anchor: getAnchor(marks, order, key)};
}

/**
 * Keep only the marks of tiles that are still on the screen, for example after a move or a change by another user.
 * @param {TileMarks} marks
 * @param {string[]} order
 * @returns {TileMarks}
 */
export function keepShown(marks, order) {
  return {
    keys: marks.keys.filter(key => order.includes(key)),
    anchor: order.includes(marks.anchor) ? marks.anchor : null
  };
}

/**
 * @param {string[]} keys
 * @returns {import("./category-tree.mjs").MovedItems}
 */
export function toMovedItems(keys) {
  return {
    paths: keys.filter(key => key.startsWith(ASSET_PREFIX)).map(key => key.slice(ASSET_PREFIX.length)),
    categoryIds: keys.filter(key => key.startsWith(CATEGORY_PREFIX)).map(key => key.slice(CATEGORY_PREFIX.length))
  };
}

/**
 * @param {TileMarks} marks
 * @param {string} key  A tile that is used now.
 * @returns {string[]}  The keys that a move of this tile moves: all marked tiles if it is marked, else only itself.
 */
export function getMovedKeys(marks, key) {
  return marks.keys.includes(key) ? marks.keys : [key];
}

/**
 * @param {TileMarks} marks
 * @param {string[]} order
 * @param {string} key
 * @returns {string[]}
 */
function getRange(marks, order, key) {
  const end = order.indexOf(key);
  if ( end === -1 ) return [];
  const start = order.indexOf(getAnchor(marks, order, key));
  return order.slice(Math.min(start, end), Math.max(start, end) + 1);
}

/**
 * @param {TileMarks} marks
 * @param {string[]} order
 * @param {string} key
 * @returns {string}  The anchor, or the tile itself if the anchor is not on the screen.
 */
function getAnchor(marks, order, key) {
  return order.includes(marks.anchor) ? marks.anchor : key;
}
