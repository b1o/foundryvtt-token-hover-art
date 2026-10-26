import { clampPickerSize, keepInViewport } from "../decisions/picker-placement.mjs";
import { runPointerDrag } from "../pointer-drag.mjs";

/*
 * The two pointer gestures of the gallery picker: a drag on the header moves it, a drag on the grip resizes it.
 * The grip is in the bottom-left corner, so a resize keeps the right edge and the top edge in place: a move to the
 * left makes the grid wider, a move down makes it taller.
 */

/**
 * Run one move drag, from the pointerdown on the header to the release. The picker stays inside the viewport.
 * @param {PointerEvent} event       The pointerdown event on the header.
 * @param {HTMLElement} picker       The picker root element.
 * @param {function(DOMRect): void} onEnd  Called with the final rectangle, only after a real drag (not a click).
 */
export function runPickerMove(event, picker, onEnd) {
  event.preventDefault();
  const start = picker.getBoundingClientRect();
  runPointerDrag(event.target.closest(".tha-picker-header"), event, {
    onMove: (dx, dy) => {
      const moved = {left: start.left + dx, top: start.top + dy, width: start.width, height: start.height};
      const {left, top} = keepInViewport(moved, {width: window.innerWidth, height: window.innerHeight});
      picker.style.left = `${left}px`;
      picker.style.top = `${top}px`;
    },
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
export function runPickerResize(event, picker, {startSize, onEnd}) {
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
