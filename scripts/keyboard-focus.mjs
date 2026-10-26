/*
 * v11 fact: KeyboardManager#hasFocus is true while any element has the focus, and then no core keybinding runs
 * (client/core/keyboard.js:124 and :312). A native button keeps the focus after a mouse click, so after a click on a
 * module button the canvas keys (pan, Delete, pause) would stop until the user clicks somewhere else.
 */

/**
 * Give the focus back after a click with a pointer, so the core keys keep working. A click from the keyboard
 * (Enter or Space) has no pointer, and keeps the focus where the keyboard user expects it.
 * @param {MouseEvent} event      The click event.
 * @param {HTMLElement} element   The clicked control.
 */
export function releaseFocusAfterPointerClick(event, element) {
  if ( isPointerClick(event) ) element.blur();
}

/**
 * Give the focus back at the start of an HTML5 drag. The pointer press focused the control, and a drag ends with no
 * click, so no click handler gives the focus back. Only a pointer can start a drag, so the focus always goes.
 * @param {HTMLElement} source  The drag source.
 */
export function releaseFocusOnDragStart(source) {
  if ( source.contains(document.activeElement) ) document.activeElement.blur();
}

/**
 * @param {MouseEvent} event  A click event.
 * @returns {boolean}  Did a pointer make the click? A click from the keyboard has detail 0.
 */
export function isPointerClick(event) {
  return event.detail > 0;
}
