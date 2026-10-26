import { getPickerOffsets, setPickerOffset } from "../settings.mjs";
import { placePicker, centerPicker, keepInViewport } from "../decisions/picker-placement.mjs";
import { SCREEN_ORIGIN, getTokenOrigin, toOffset, fromOffset } from "../decisions/picker-offsets.mjs";

/*
 * Where the gallery picker is. The context of the trigger names the reference ("token" for the Token HUD, "screen"
 * for every other trigger). If the user dragged the picker for that reference, it goes to the same translation from
 * the reference point (picker-offsets.mjs). Else it goes to its default place (picker-placement.mjs): next to the
 * trigger with its center on the token center (Token HUD), or the viewport center (hotbar). In every case it stays
 * inside the viewport.
 */

/**
 * @typedef {import("./gallery-picker.mjs").PickerContext} PickerContext
 */

export class PickerPosition {

  /**
   * Put the picker where it belongs now. Call it after each render that can change the size, and after each pan,
   * token move, and window resize.
   * @param {HTMLElement} picker
   * @param {PickerContext} context
   */
  apply(picker, context) {
    const rect = picker.getBoundingClientRect();
    const size = {width: rect.width, height: rect.height};
    const viewport = {width: window.innerWidth, height: window.innerHeight};
    const origin = getOrigin(context);
    const offset = getPickerOffsets()[context.positionReference];
    let target;
    if ( offset ) target = origin ? fromOffset(offset, origin) : rect;
    else target = this.#getDefaultTarget(context, rect, size, viewport);
    const {left, top} = keepInViewport({...target, ...size}, viewport);
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
   * Save the place where the user dragged the picker, for the reference of the context.
   * @param {DOMRect} rect  The screen rectangle of the picker.
   * @param {PickerContext} context
   * @returns {Promise<boolean>}  Was the position saved? A token reference needs the token on the screen.
   */
  async save(rect, context) {
    const origin = getOrigin(context);
    if ( !origin ) return false;
    await setPickerOffset(context.positionReference, toOffset(rect, origin));
    return true;
  }

  /**
   * Go back to the default place, for the reference of the context. The other reference keeps its position.
   * @param {PickerContext} context
   */
  reset(context) {
    return setPickerOffset(context.positionReference, null);
  }

  /**
   * @param {PickerContext} context
   * @param {DOMRect} rect
   * @param {{width: number, height: number}} size
   * @param {{width: number, height: number}} viewport
   * @returns {{left: number, top: number}}  The viewport center, or left of the trigger and centered on the token or
   *                                         on the trigger. If the trigger is gone, the picker stays where it is.
   */
  #getDefaultTarget(context, rect, size, viewport) {
    if ( context.placement === "center" ) return centerPicker(size, viewport);
    const anchor = context.getAnchorRect();
    if ( !anchor ) return rect;
    const token = (context.positionReference === "token") ? context.getTokenRect() : null;
    const centerY = token ? getTokenOrigin(token).y : (anchor.top + (anchor.height / 2));
    return placePicker(anchor, centerY, size, viewport);
  }
}

/**
 * @param {PickerContext} context
 * @returns {{x: number, y: number}|null}  The reference point now, or null if the token is not on the screen.
 */
function getOrigin(context) {
  if ( context.positionReference === "screen" ) return SCREEN_ORIGIN;
  const token = context.getTokenRect();
  return token ? getTokenOrigin(token) : null;
}
