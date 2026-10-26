import { getPickerOffsets, setPickerOffset } from "../settings.mjs";
import { getBesideTrigger, getViewportCenter, keepInViewport } from "../decisions/picker-placement.mjs";
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

export class PickerPosition {

  /**
   * Put the picker where it belongs now. If the trigger is gone, the picker only stays inside the viewport.
   * @param {HTMLElement} picker
   * @param {PickerContext} context
   */
  apply(picker, context) {
    const rect = picker.getBoundingClientRect();
    const viewport = {width: window.innerWidth, height: window.innerHeight};
    const base = getDefaultPlace(context, rect, viewport);
    const offset = getPickerOffsets()[context.positionReference];
    let target = rect;
    if ( base ) target = offset ? fromOffset(offset, base) : base;
    const {left, top} = keepInViewport({...target, width: rect.width, height: rect.height}, viewport);
    picker.style.left = `${left}px`;
    picker.style.top = `${top}px`;
  }

  /**
   * @param {PickerContext} context
   * @returns {boolean}  Did the user drag the picker for the reference of this context?
   */
  isMoved(context) {
    return getPickerOffsets()[context.positionReference] !== null;
  }

  /**
   * Save the place where the user dragged the picker, as an offset from its default place now.
   * @param {DOMRect} rect  The screen rectangle of the picker.
   * @param {PickerContext} context
   * @returns {Promise<boolean>}  Was the position saved? It needs the trigger on the screen.
   */
  async save(rect, context) {
    const base = getDefaultPlace(context, rect, {width: window.innerWidth, height: window.innerHeight});
    if ( !base ) return false;
    await setPickerOffset(context.positionReference, toOffset(rect, base));
    return true;
  }

  /**
   * Go back to the default place, for the reference of the context. The other reference keeps its position.
   * @param {PickerContext} context
   */
  reset(context) {
    return setPickerOffset(context.positionReference, null);
  }
}

/**
 * @param {PickerContext} context
 * @param {{width: number, height: number}} size  The picker size.
 * @param {{width: number, height: number}} viewport
 * @returns {{left: number, top: number}|null}  The default place now, not clamped: the viewport center, or left of the
 *                                             trigger and centered on the token or on the trigger. Null if the
 *                                             trigger is gone.
 */
function getDefaultPlace(context, size, viewport) {
  if ( context.placement === "center" ) return getViewportCenter(size, viewport);
  const anchor = context.getAnchorRect();
  if ( !anchor ) return null;
  const token = (context.positionReference === "token") ? context.getTokenRect() : null;
  const centerY = token ? getTokenCenterY(token) : (anchor.top + (anchor.height / 2));
  return getBesideTrigger(anchor, centerY, size);
}
