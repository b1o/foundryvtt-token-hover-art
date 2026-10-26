import { getPickerOffsets, setPickerOffset } from "../settings.mjs";
import { getBesideTrigger, getViewportCenter } from "../decisions/picker-placement.mjs";
import { getViewportSize, placeInViewport } from "../viewport.mjs";
import { getTokenCenterY, toOffset, fromOffset } from "../decisions/picker-offsets.mjs";

/*
 * Where the gallery picker is. The trigger gives the default place (picker-placement.mjs): left of the Token HUD
 * button with the picker center on the token center, or the viewport center for the hotbar. If the user dragged the
 * picker, a saved offset shifts the default place (picker-offsets.mjs). There is one offset for each reference of the
 * context ("token" for the Token HUD, "screen" for the hotbar). In every case the picker stays inside the viewport.
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
  const offset = getPickerOffsets()[context.positionReference];
  let target = rect;
  if ( base ) target = offset ? fromOffset(offset, base) : base;
  placeInViewport(picker, {...target, width: rect.width, height: rect.height});
}

/**
 * @param {PickerContext} context
 * @returns {boolean}  Did the user drag the picker for the reference of this context?
 */
export function isPickerMoved(context) {
  return getPickerOffsets()[context.positionReference] !== null;
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
  await setPickerOffset(context.positionReference, toOffset(rect, base));
  return true;
}

/**
 * Go back to the default place, for the reference of the context. The other reference keeps its position.
 * @param {PickerContext} context
 */
export function resetPickerPosition(context) {
  return setPickerOffset(context.positionReference, null);
}

/**
 * @param {PickerContext} context
 * @param {{width: number, height: number}} size  The picker size.
 * @returns {{left: number, top: number}|null}  The default place now, not clamped: the viewport center, or left of the
 *                                             trigger and centered on the token or on the trigger. Null if the
 *                                             trigger is gone.
 */
function getDefaultPlace(context, size) {
  if ( context.placement === "center" ) return getViewportCenter(size, getViewportSize());
  const anchor = context.getAnchorRect();
  if ( !anchor ) return null;
  const token = (context.positionReference === "token") ? context.getTokenRect() : null;
  const centerY = token ? getTokenCenterY(token) : (anchor.top + (anchor.height / 2));
  return getBesideTrigger(anchor, centerY, size);
}
