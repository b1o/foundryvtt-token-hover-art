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
 * @param {MouseEvent} event  A click event.
 * @returns {boolean}  Did a pointer make the click? A click from the keyboard has detail 0.
 */
export function isPointerClick(event) {
  return event.detail > 0;
}
