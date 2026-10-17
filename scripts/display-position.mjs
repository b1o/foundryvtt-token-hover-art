import { MODULE_ID, SETTINGS, POSITIONS } from "./constants.mjs";
import { getSetting } from "./settings.mjs";

/*
 * The position of the hover display: a screen corner (world setting) or a position that the user dragged the
 * display to (client setting). Each user can drag the display while they hold Ctrl (see hover-display.mjs).
 */

/**
 * A dragged position. The display keeps its distance to the nearest horizontal and vertical screen edge, so
 * a taller or wider image grows away from that edge, toward the screen center. The distances are fractions of
 * the screen size, so the position stays in the same place relative to the screen after a window resize.
 * @typedef {object} CustomPosition
 * @property {"left"|"right"} anchorX  The horizontal screen edge that the display keeps its distance to.
 * @property {number} x                The distance to that edge, as a fraction of the screen width (0 to 1).
 * @property {"top"|"bottom"} anchorY  The vertical screen edge that the display keeps its distance to.
 * @property {number} y                The distance to that edge, as a fraction of the screen height (0 to 1).
 */

/** A pointer move below this distance in pixels is a click, not a drag. A click does not save a position. */
const DRAG_THRESHOLD = 4;

/** Is a drag in progress now? */
let dragging = false;

/**
 * @returns {boolean}  Is the user dragging the display now?
 */
export function isDragging() {
  return dragging;
}

/**
 * Put the display at the dragged position of this user, or else in the configured screen corner.
 * @param {HTMLElement} display
 */
export function applyDisplayPosition(display) {
  clearPosition(display);
  const custom = getCustomPosition();
  if ( custom ) {
    display.style[custom.anchorX] = `${custom.x * 100}vw`;
    display.style[custom.anchorY] = `${custom.y * 100}vh`;
    return;
  }
  const corner = getSetting(SETTINGS.POSITION);
  const isTop = [POSITIONS.TOP_LEFT, POSITIONS.TOP_RIGHT].includes(corner);
  const isLeft = [POSITIONS.TOP_LEFT, POSITIONS.BOTTOM_LEFT].includes(corner);
  display.style[isTop ? "top" : "bottom"] = "0";
  display.style[isLeft ? "left" : "right"] = "0";
}

/**
 * Let the user drag the display while it has the "moving" class. When the drag ends, save the new position for
 * this user and switch the user to the dragged position.
 * @param {HTMLElement} display
 * @param {function(): void} onDragEnd  Called after the drag, also when the drag was only a click.
 */
export function makeDisplayDraggable(display, onDragEnd) {
  display.addEventListener("pointerdown", event => {
    if ( (event.button !== 0) || !display.classList.contains("moving") ) return;
    event.preventDefault();
    const start = display.getBoundingClientRect();
    const grab = {x: event.clientX - start.left, y: event.clientY - start.top};
    let moved = false;
    dragging = true;

    const onMove = moveEvent => {
      const dx = moveEvent.clientX - event.clientX;
      const dy = moveEvent.clientY - event.clientY;
      if ( !moved && (Math.hypot(dx, dy) < DRAG_THRESHOLD) ) return;
      moved = true;
      clearPosition(display);
      display.style.left = `${clamp(moveEvent.clientX - grab.x, 0, window.innerWidth - start.width)}px`;
      display.style.top = `${clamp(moveEvent.clientY - grab.y, 0, window.innerHeight - start.height)}px`;
    };
    const onEnd = async () => {
      display.removeEventListener("pointermove", onMove);
      dragging = false;
      if ( moved ) await saveCustomPosition(toCustomPosition(display.getBoundingClientRect()));
      onDragEnd();
    };

    display.setPointerCapture(event.pointerId);
    display.addEventListener("pointermove", onMove);
    display.addEventListener("lostpointercapture", onEnd, {once: true});
  });
}

/* -------------------------------------------- */

/**
 * @returns {CustomPosition|null}  The dragged position, if the user uses it and it is valid.
 */
function getCustomPosition() {
  if ( !getSetting(SETTINGS.USE_CUSTOM_POSITION) ) return null;
  const position = getSetting(SETTINGS.CUSTOM_POSITION);
  const valid = ["left", "right"].includes(position?.anchorX) && ["top", "bottom"].includes(position?.anchorY)
    && Number.isFinite(position.x) && Number.isFinite(position.y);
  return valid ? position : null;
}

/**
 * Save the position, and switch this user to the dragged position.
 * @param {CustomPosition} position
 */
async function saveCustomPosition(position) {
  await game.settings.set(MODULE_ID, SETTINGS.CUSTOM_POSITION, position);
  await game.settings.set(MODULE_ID, SETTINGS.USE_CUSTOM_POSITION, true);
}

/**
 * @param {DOMRect} rect  The screen rectangle of the display after the drag.
 * @returns {CustomPosition}
 */
function toCustomPosition(rect) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const anchorX = ((rect.left + (rect.width / 2)) < (width / 2)) ? "left" : "right";
  const anchorY = ((rect.top + (rect.height / 2)) < (height / 2)) ? "top" : "bottom";
  const x = (anchorX === "left") ? rect.left : (width - rect.right);
  const y = (anchorY === "top") ? rect.top : (height - rect.bottom);
  return {anchorX, x: clamp(x / width, 0, 1), anchorY, y: clamp(y / height, 0, 1)};
}

/**
 * @param {HTMLElement} display
 */
function clearPosition(display) {
  for ( const side of ["top", "right", "bottom", "left"] ) display.style[side] = "";
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
