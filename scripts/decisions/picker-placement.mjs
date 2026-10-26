import { clamp } from "./screen-geometry.mjs";

/*
 * The size and the screen position of the gallery picker. No Foundry and no DOM access.
 */

/** The size limits of the picker grid in CSS pixels. */
export const PICKER_SIZE_LIMITS = Object.freeze({minWidth: 160, maxWidth: 640, minHeight: 120, maxHeight: 640});

/** The default size of the picker grid. */
export const DEFAULT_PICKER_SIZE = Object.freeze({width: 228, height: 290});

/** The space between the trigger and the picker, in pixels. */
const ANCHOR_GAP = 8;

/**
 * @param {*} size  A stored or dragged size.
 * @returns {import("./screen-geometry.mjs").Size}  The size, rounded and inside PICKER_SIZE_LIMITS. An invalid
 *                                                 value gives the default size.
 */
export function clampPickerSize(size) {
  if ( !Number.isFinite(size?.width) || !Number.isFinite(size?.height) ) return {...DEFAULT_PICKER_SIZE};
  const {minWidth, maxWidth, minHeight, maxHeight} = PICKER_SIZE_LIMITS;
  return {
    width: Math.round(clamp(size.width, minWidth, maxWidth)),
    height: Math.round(clamp(size.height, minHeight, maxHeight))
  };
}

/**
 * The default position: to the left of the trigger, with the picker center at a given height, inside the viewport.
 * @param {import("./screen-geometry.mjs").Rect} anchor  The screen rectangle of the trigger.
 * @param {number} centerY  The height of the picker center: the token center for a picker from the Token HUD, else
 *                          the trigger center.
 * @param {import("./screen-geometry.mjs").Size} size    The outer size of the picker.
 * @param {import("./screen-geometry.mjs").Size} viewport
 * @returns {{left: number, top: number}}
 */
export function placePicker(anchor, centerY, size, viewport) {
  const position = {left: anchor.left - ANCHOR_GAP - size.width, top: centerY - (size.height / 2)};
  return clampToViewport(position, size, viewport);
}

/**
 * The default position of a picker from the hotbar (user decision 2026-10-26): the center of the viewport.
 * @param {import("./screen-geometry.mjs").Size} size  The outer size of the picker.
 * @param {import("./screen-geometry.mjs").Size} viewport
 * @returns {{left: number, top: number}}
 */
export function centerPicker(size, viewport) {
  const position = {left: (viewport.width - size.width) / 2, top: (viewport.height - size.height) / 2};
  return clampToViewport(position, size, viewport);
}

/**
 * Keep the picker where it is, but inside the viewport. For a picker whose trigger is gone.
 * @param {import("./screen-geometry.mjs").Rect} rect  The screen rectangle of the picker now.
 * @param {import("./screen-geometry.mjs").Size} viewport
 * @returns {{left: number, top: number}}
 */
export function keepInViewport(rect, viewport) {
  return clampToViewport(rect, rect, viewport);
}

/**
 * @param {{left: number, top: number}} position
 * @param {import("./screen-geometry.mjs").Size} size
 * @param {import("./screen-geometry.mjs").Size} viewport
 * @returns {{left: number, top: number}}  The position, rounded, with the whole size inside the viewport. A size
 *                                         larger than the viewport starts at the top-left corner.
 */
function clampToViewport({left, top}, size, viewport) {
  return {
    left: Math.round(clamp(left, 0, Math.max(viewport.width - size.width, 0))),
    top: Math.round(clamp(top, 0, Math.max(viewport.height - size.height, 0)))
  };
}
