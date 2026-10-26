import { getPickerOffset, setPickerOffset } from "../settings.mjs";
import { getBesideTrigger, getViewportCenter } from "../decisions/picker-placement.mjs";
import { getViewportSize, placeInViewport } from "../viewport.mjs";
import { getTokenCenterY, toOffset, fromOffset } from "../decisions/picker-offsets.mjs";

/*
 * Where the gallery picker is. The trigger gives the default place (picker-placement.mjs): left of the Token HUD
 * button with the picker center on the token center, or the viewport center for the hotbar. If the user dragged the
 * picker, a saved offset shifts the default place (picker-offsets.mjs). There is one offset for each trigger point.
 * In every case the picker stays inside the viewport.
 *
 * The placement runs at the open and again after each pan, zoom, token move, HUD render, window resize, and
 * navigation, so a moved picker follows the trigger exactly as a picker at its default place does.
 */

/**
 * @typedef {import("./gallery-picker.mjs").PickerContext} PickerContext
 */

/**
 * Put the picker where it belongs now. If the trigger is gone, the picker only stays inside the viewport.
 * @param {HTMLElement} picker
 * @param {PickerContext} context
 */
export function placePicker(picker, context) {
  const rect = picker.getBoundingClientRect();
  const base = getDefaultPlace(context, rect);
  const offset = getPickerOffset(context.trigger);
  let target = rect;
  if ( base ) target = offset ? fromOffset(offset, base) : base;
  placeInViewport(picker, {...target, width: rect.width, height: rect.height});
}

/**
 * @param {PickerContext} context
 * @returns {boolean}  Did the user drag the picker for the trigger point of this context?
 */
export function isPickerMoved(context) {
  return getPickerOffset(context.trigger) !== null;
}

/**
 * Save the place where the user dragged the picker, as an offset from its default place now.
 * @param {DOMRect} rect  The screen rectangle of the picker.
 * @param {PickerContext} context
 * @returns {Promise<boolean>}  Was the position saved? It needs the trigger on the screen.
 */
export async function savePickerPosition(rect, context) {
  const base = getDefaultPlace(context, rect);
  if ( !base ) return false;
  await setPickerOffset(context.trigger, toOffset(rect, base));
  return true;
}

/**
 * Go back to the default place, for the trigger point of the context. The other trigger point keeps its position.
 * @param {PickerContext} context
 */
export function resetPickerPosition(context) {
  return setPickerOffset(context.trigger, null);
}

/**
 * @param {PickerContext} context
 * @param {{width: number, height: number}} size  The picker size.
 * @returns {{left: number, top: number}|null}  The default place now, not clamped: the viewport center for the hotbar,
 *                                             or left of the HUD button and centered on the token (on the button if
 *                                             the token is not on the screen). Null if the HUD button is gone.
 */
function getDefaultPlace(context, size) {
  if ( context.trigger === "hotbar" ) return getViewportCenter(size, getViewportSize());
  const anchor = context.getAnchorRect();
  if ( !anchor ) return null;
  const token = context.getTokenRect();
  const centerY = token ? getTokenCenterY(token) : (anchor.top + (anchor.height / 2));
  return getBesideTrigger(anchor, centerY, size);
}
