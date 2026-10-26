import { clampPickerSize } from "../decisions/picker-placement.mjs";

/*
 * The resize grip of the gallery picker. The grip is in the bottom-left corner, and the picker opens to the left of
 * its trigger, so the right edge and the top edge stay in place: a move to the left makes the grid wider, a move
 * down makes it taller.
 */

/**
 * Run one resize drag, from the pointerdown on the grip to the release.
 * @param {PointerEvent} event      The pointerdown event on the grip.
 * @param {HTMLElement} picker      The picker root element. It holds the size variables.
 * @param {object} options
 * @param {{width: number, height: number}} options.startSize  The grid size at the drag start.
 * @param {function({width: number, height: number}): void} options.onEnd  Called with the final size.
 */
export function runPickerResize(event, picker, {startSize, onEnd}) {
  event.preventDefault();
  const grip = event.target;
  const fixedRight = picker.getBoundingClientRect().right;
  let size = startSize;

  const onMove = moveEvent => {
    size = clampPickerSize({
      width: startSize.width + (event.clientX - moveEvent.clientX),
      height: startSize.height + (moveEvent.clientY - event.clientY)
    });
    applyPickerSize(picker, size);
    picker.style.left = `${fixedRight - picker.getBoundingClientRect().width}px`;
  };

  grip.setPointerCapture(event.pointerId);
  grip.addEventListener("pointermove", onMove);
  grip.addEventListener("lostpointercapture", () => {
    grip.removeEventListener("pointermove", onMove);
    onEnd(size);
  }, {once: true});
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
