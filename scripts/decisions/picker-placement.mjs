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
 * The default place next to a trigger: to the left of it, with the picker center at a given height. Not clamped: a
 * dragged offset is added to it first (picker-offsets.mjs), and keepInViewport (screen-geometry.mjs) runs last.
 * @param {import("./screen-geometry.mjs").Rect} anchor  The screen rectangle of the trigger.
 * @param {number} centerY  The height of the picker center: the token center for a picker from the Token HUD, else
 *                          the trigger center.
 * @param {import("./screen-geometry.mjs").Size} size    The outer size of the picker.
 * @returns {{left: number, top: number}}
 */
export function getBesideTrigger(anchor, centerY, size) {
  return {left: anchor.left - ANCHOR_GAP - size.width, top: centerY - (size.height / 2)};
}

/**
 * The default place of a picker from the hotbar (user decision 2026-10-26): the center of the viewport. Not clamped.
 * @param {import("./screen-geometry.mjs").Size} size  The outer size of the picker.
 * @param {import("./screen-geometry.mjs").Size} viewport
 * @returns {{left: number, top: number}}
 */
export function getViewportCenter(size, viewport) {
  return {left: (viewport.width - size.width) / 2, top: (viewport.height - size.height) / 2};
}
