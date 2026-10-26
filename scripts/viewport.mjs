import { keepInViewport } from "./decisions/screen-geometry.mjs";

/*
 * The browser viewport, for the elements that the module puts on the screen: the hover display, the gallery picker,
 * and the popup of the picker.
 */

/** @returns {import("./decisions/screen-geometry.mjs").Size} */
export function getViewportSize() {
  return {width: window.innerWidth, height: window.innerHeight};
}

/**
 * Put a fixed element at a screen position, with the whole element inside the viewport.
 * @param {HTMLElement} element
 * @param {import("./decisions/screen-geometry.mjs").Rect} rect  The wanted screen rectangle of the element.
 */
export function placeInViewport(element, rect) {
  const {left, top} = keepInViewport(rect, getViewportSize());
  element.style.left = `${left}px`;
  element.style.top = `${top}px`;
}

/**
 * One step of a move drag: the element follows the pointer and stays inside the viewport. The hover display and the
 * gallery picker use it.
 * @param {HTMLElement} element
 * @param {DOMRect} start  The screen rectangle of the element at the drag start.
 * @param {number} dx      The pointer offset from the drag start, in pixels.
 * @param {number} dy
 */
export function moveInViewport(element, start, dx, dy) {
  placeInViewport(element, {left: start.left + dx, top: start.top + dy, width: start.width, height: start.height});
}
