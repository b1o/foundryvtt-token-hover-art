/*
 * One pointer drag, from the pointerdown to the release. The hover display (move and resize) and the gallery picker
 * (header move) use it.
 */

/** A pointer move below this distance in pixels is a click, not a drag. */
const DRAG_THRESHOLD = 4;

/**
 * Run one drag on an element. The element captures the pointer, so the drag continues outside of it.
 * @param {HTMLElement} element   The element that gets the pointer capture.
 * @param {PointerEvent} event    The pointerdown event.
 * @param {object} handlers
 * @param {function(number, number): void} handlers.onMove  Called with the pointer offset from the drag start, in
 *                                                         pixels, after the move passed the threshold.
 * @param {function(boolean): void} handlers.onEnd         Called once when the drag ends. The argument says whether
 *                                                         the pointer passed the threshold (a drag) or not (a click).
 */
export function runPointerDrag(element, event, {onMove, onEnd}) {
  let isMoved = false;

  const onPointerMove = moveEvent => {
    const dx = moveEvent.clientX - event.clientX;
    const dy = moveEvent.clientY - event.clientY;
    if ( !isMoved && (Math.hypot(dx, dy) < DRAG_THRESHOLD) ) return;
    isMoved = true;
    onMove(dx, dy);
  };

  element.setPointerCapture(event.pointerId);
  element.addEventListener("pointermove", onPointerMove);
  element.addEventListener("lostpointercapture", () => {
    element.removeEventListener("pointermove", onPointerMove);
    onEnd(isMoved);
  }, {once: true});
}
