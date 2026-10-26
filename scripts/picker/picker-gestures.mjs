import { clampPickerSize } from "../decisions/picker-placement.mjs";
import { moveInViewport } from "../viewport.mjs";
import { runPointerDrag } from "../pointer-drag.mjs";
import { getPickerSize, setPickerSize } from "../settings.mjs";
import { reportActionError } from "../output.mjs";
import { isPickerMoved, savePickerPosition } from "./picker-position.mjs";

/*
 * The two pointer gestures of the gallery picker: a drag on the header moves it, a drag on the grip resizes it.
 * The grip is in the bottom-left corner, so a resize keeps the right edge and the top edge in place: a move to the
 * left makes the grid wider, a move down makes it taller.
 */

/**
 * @typedef {import("./gallery-picker.mjs").PickerContext} PickerContext
 */

/**
 * Starts the gestures and saves their result for the context of the open picker.
 */
export class PickerGestures {

  /** @type {HTMLElement} */
  #picker;

  /** @type {function(): (PickerContext|null)} */
  #getContext;

  /** @type {function(): void} */
  #onMoveSaved;

  /**
   * @param {object} options
   * @param {HTMLElement} options.picker                 The picker root element.
   * @param {function(): (PickerContext|null)} options.getContext  The context of the open picker now.
   * @param {function(): void} options.onMoveSaved      Called after a saved move, if the context did not change.
   */
  constructor({picker, getContext, onMoveSaved}) {
    this.#picker = picker;
    this.#getContext = getContext;
    this.#onMoveSaved = onMoveSaved;
  }

  /**
   * Start a resize (grip) or a move (header) for a pointerdown. The header buttons keep their click.
   * @param {PointerEvent} event
   */
  start(event) {
    if ( event.target.closest(".tha-picker-resize") ) {
      return runPickerResize(event, this.#picker, {
        startSize: getPickerSize(),
        onEnd: (size, rect) => this.#saveResize(size, rect).catch(reportActionError)
      });
    }
    if ( event.target.closest(".tha-picker-header") && !event.target.closest("button") ) {
      runPickerMove(event, this.#picker, rect => this.#saveMove(rect).catch(reportActionError));
    }
  }

  /**
   * Save the place where the user dragged the picker, for this user and the trigger point of the context.
   * @param {DOMRect} rect  The screen rectangle of the picker.
   */
  async #saveMove(rect) {
    const context = this.#getContext();
    const isSaved = await savePickerPosition(rect, context);
    if ( isSaved && (this.#getContext() === context) ) this.#onMoveSaved();
  }

  /**
   * Save the new size. A moved picker also saves its new position, because the resize moved its left edge.
   * @param {{width: number, height: number}} size
   * @param {DOMRect} rect
   */
  async #saveResize(size, rect) {
    const context = this.#getContext();
    await setPickerSize(size);
    if ( isPickerMoved(context) ) await savePickerPosition(rect, context);
  }
}

/**
 * Run one move drag, from the pointerdown on the header to the release. The picker stays inside the viewport.
 * @param {PointerEvent} event       The pointerdown event on the header.
 * @param {HTMLElement} picker       The picker root element.
 * @param {function(DOMRect): void} onEnd  Called with the final rectangle, only after a real drag (not a click).
 */
function runPickerMove(event, picker, onEnd) {
  event.preventDefault();
  const start = picker.getBoundingClientRect();
  runPointerDrag(event.target.closest(".tha-picker-header"), event, {
    onMove: (dx, dy) => moveInViewport(picker, start, dx, dy),
    onEnd: isMoved => {
      if ( isMoved ) onEnd(picker.getBoundingClientRect());
    }
  });
}

/**
 * Run one resize drag, from the pointerdown on the grip to the release.
 * @param {PointerEvent} event      The pointerdown event on the grip.
 * @param {HTMLElement} picker      The picker root element. It holds the size variables.
 * @param {object} options
 * @param {{width: number, height: number}} options.startSize  The grid size at the drag start.
 * @param {function({width: number, height: number}, DOMRect): void} options.onEnd  Called with the final grid size
 *                                                       and the final rectangle, only after a real drag.
 */
function runPickerResize(event, picker, {startSize, onEnd}) {
  event.preventDefault();
  const fixedRight = picker.getBoundingClientRect().right;
  let size = startSize;
  runPointerDrag(event.target, event, {
    onMove: (dx, dy) => {
      size = clampPickerSize({width: startSize.width - dx, height: startSize.height + dy});
      applyPickerSize(picker, size);
      picker.style.left = `${fixedRight - picker.getBoundingClientRect().width}px`;
    },
    onEnd: isMoved => {
      if ( isMoved ) onEnd(size, picker.getBoundingClientRect());
    }
  });
}

/**
 * The CSS reads the two variables (see token-hover-art.css).
 * @param {HTMLElement} picker
 * @param {{width: number, height: number}} size  The grid size.
 */
export function applyPickerSize(picker, {width, height}) {
  picker.style.setProperty("--tha-picker-width", `${width}px`);
  picker.style.setProperty("--tha-picker-height", `${height}px`);
}
