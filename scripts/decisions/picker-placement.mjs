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
 * Place the picker to the left of its trigger, with the top edges aligned, and keep it inside the viewport.
 * @param {import("./screen-geometry.mjs").Rect} anchor  The screen rectangle of the trigger.
 * @param {import("./screen-geometry.mjs").Size} size    The outer size of the picker.
 * @param {import("./screen-geometry.mjs").Size} viewport
 * @returns {{left: number, top: number}}
 */
export function placePicker(anchor, size, viewport) {
  const left = anchor.left - ANCHOR_GAP - size.width;
  return {
    left: Math.round(clamp(left, 0, Math.max(viewport.width - size.width, 0))),
    top: Math.round(clamp(anchor.top, 0, Math.max(viewport.height - size.height, 0)))
  };
}
