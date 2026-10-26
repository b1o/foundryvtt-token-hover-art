import { POSITIONS } from "../constants.mjs";
import {
  getDisplayCorner, getMaxHeightPercent, isCustomLayoutUsed, getCustomPosition, getCustomSize, saveCustomLayout
} from "../settings.mjs";
import { clamp, toEdgePosition } from "../decisions/screen-geometry.mjs";
import { runPointerDrag } from "../pointer-drag.mjs";

/*
 * The layout of the hover display: where it is and how large its image is.
 * The default is a screen corner (world setting) and the world maximum height. Each user can move and resize the
 * display while they hold Ctrl (see hover-display.mjs). The result is saved for this user, and it replaces the
 * default while the client setting "Use my dragged position and size" is on.
 *
 * A dragged position is an EdgePosition (see screen-geometry.mjs). A dragged size is the image height as a fraction
 * of the screen height ({height}). The width follows the aspect ratio of each image, so images of different shapes
 * keep their shape at the same height.
 */

/** The smallest image height in pixels that a resize can make. */
const MIN_IMAGE_HEIGHT = 48;

/** With a dragged size, the display can use this part of the screen width, instead of the default 40vw. */
const CUSTOM_MAX_WIDTH = "95vw";

/**
 * @typedef {object} DragHandler
 * @property {function(number, number): void} onMove  Called with the pointer offset from the drag start, in pixels.
 * @property {function(): Promise<void>} save         Saves the result after a real drag.
 */

export class DisplayLayout {

  /** Is a move or a resize in progress now? */
  #isDragging = false;

  get isDragging() {
    return this.#isDragging;
  }

  /**
   * Apply the position and the size: the dragged values of this user, or else the defaults.
   * @param {HTMLElement} display
   */
  apply(display) {
    applyPosition(display);
    applySize(display);
  }

  /**
   * Let the user move the display, or resize it with a corner handle, while it has the "moving" class.
   * When the drag ends, save the new layout for this user and switch the user to the dragged layout.
   * @param {HTMLElement} display
   * @param {function(): void} onDragEnd  Called after each drag, also when the drag was only a click.
   */
  makeInteractive(display, onDragEnd) {
    display.addEventListener("pointerdown", event => {
      if ( (event.button !== 0) || !display.classList.contains("moving") ) return;
      event.preventDefault();
      const corner = event.target.closest(".tha-resize-handle")?.dataset.corner;
      const handler = corner ? createResizeHandler(display, corner) : createMoveHandler(display);
      this.#runDrag(display, event, handler, onDragEnd);
    });
  }

  /**
   * Run a pointer drag on the display with a handler. A click (no move past the drag threshold) saves nothing.
   * @param {HTMLElement} display
   * @param {PointerEvent} event      The pointerdown event.
   * @param {DragHandler} handler
   * @param {function(): void} onDragEnd
   */
  #runDrag(display, event, handler, onDragEnd) {
    this.#isDragging = true;
    runPointerDrag(display, event, {
      onMove: (dx, dy) => handler.onMove(dx, dy),
      onEnd: async isMoved => {
        this.#isDragging = false;
        if ( isMoved ) await handler.save();
        onDragEnd();
      }
    });
  }
}

/**
 * @param {HTMLElement} display
 */
function applyPosition(display) {
  clearPosition(display);
  const custom = isCustomLayoutUsed() ? getCustomPosition() : null;
  if ( custom ) {
    display.style[custom.anchorX] = `${custom.x * 100}vw`;
    display.style[custom.anchorY] = `${custom.y * 100}vh`;
    return;
  }
  const corner = getDisplayCorner();
  const isTop = [POSITIONS.TOP_LEFT, POSITIONS.TOP_RIGHT].includes(corner);
  const isLeft = [POSITIONS.TOP_LEFT, POSITIONS.BOTTOM_LEFT].includes(corner);
  display.style[isTop ? "top" : "bottom"] = "0";
  display.style[isLeft ? "left" : "right"] = "0";
}

/**
 * A dragged size sets the image height. Without it, the image keeps its natural size, limited by the world
 * maximum height. The CSS reads the three variables (see token-hover-art.css).
 * @param {HTMLElement} display
 */
function applySize(display) {
  const custom = isCustomLayoutUsed() ? getCustomSize() : null;
  if ( custom ) {
    setSizeVariables(display, {imageHeight: `${custom.height * 100}vh`, maxHeight: "none", maxWidth: CUSTOM_MAX_WIDTH});
  }
  else setSizeVariables(display, {imageHeight: "auto", maxHeight: `${getMaxHeightPercent()}vh`});
}

/**
 * @param {HTMLElement} display
 * @param {{imageHeight: string, maxHeight: string, maxWidth?: string}} size  maxWidth undefined means the CSS default.
 */
function setSizeVariables(display, {imageHeight, maxHeight, maxWidth}) {
  display.style.setProperty("--tha-image-height", imageHeight);
  display.style.setProperty("--tha-max-height", maxHeight);
  if ( maxWidth ) display.style.setProperty("--tha-max-width", maxWidth);
  else display.style.removeProperty("--tha-max-width");
}

/**
 * Move the whole display. The display stays inside the screen.
 * @param {HTMLElement} display
 * @returns {DragHandler}
 */
function createMoveHandler(display) {
  const start = display.getBoundingClientRect();
  return {
    onMove(dx, dy) {
      clearPosition(display);
      display.style.left = `${clamp(start.left + dx, 0, window.innerWidth - start.width)}px`;
      display.style.top = `${clamp(start.top + dy, 0, window.innerHeight - start.height)}px`;
    },
    save: () => saveCustomLayout({position: toEdgePosition(display.getBoundingClientRect(), getViewport())})
  };
}

/**
 * Resize the image from a corner. The opposite corner of the display stays in place, and the image keeps its
 * aspect ratio: the larger of the horizontal and the vertical pointer movement sets the new size. The display
 * stays inside the screen.
 * @param {HTMLElement} display
 * @param {"nw"|"ne"|"sw"|"se"} corner  The corner that the user drags.
 * @returns {DragHandler}
 */
function createResizeHandler(display, corner) {
  const media = display.querySelector(".tha-media img, .tha-media video");
  const start = display.getBoundingClientRect();
  const image = media.getBoundingClientRect();
  const aspect = image.width / image.height;

  // The frame is the padding and the border around the image. It keeps its size during the resize.
  const frame = {width: start.width - image.width, height: start.height - image.height};

  // A drag away from the fixed corner makes the image larger. The sign gives that direction for each corner.
  const signX = corner.includes("w") ? -1 : 1;
  const signY = corner.includes("n") ? -1 : 1;
  const fixedX = (signX < 0) ? start.right : start.left;
  const fixedY = (signY < 0) ? start.bottom : start.top;

  // The largest image height that keeps the display inside the screen, seen from the fixed corner.
  const roomX = (signX < 0) ? fixedX : (window.innerWidth - fixedX);
  const roomY = (signY < 0) ? fixedY : (window.innerHeight - fixedY);
  const maxImageHeight = Math.min(roomY - frame.height, (roomX - frame.width) / aspect);

  return {
    onMove(dx, dy) {
      const scale = Math.max((image.width + (signX * dx)) / image.width, (image.height + (signY * dy)) / image.height);
      const height = clamp(image.height * scale, MIN_IMAGE_HEIGHT, Math.max(maxImageHeight, MIN_IMAGE_HEIGHT));
      setSizeVariables(display, {imageHeight: `${height}px`, maxHeight: "none", maxWidth: "none"});
      const width = (height * aspect) + frame.width;
      clearPosition(display);
      display.style.left = `${(signX < 0) ? (fixedX - width) : fixedX}px`;
      display.style.top = `${(signY < 0) ? (fixedY - (height + frame.height)) : fixedY}px`;
    },
    save: () => saveCustomLayout({
      position: toEdgePosition(display.getBoundingClientRect(), getViewport()),
      size: {height: clamp(media.getBoundingClientRect().height / window.innerHeight, 0, 1)}
    })
  };
}

/** @returns {{width: number, height: number}} */
function getViewport() {
  return {width: window.innerWidth, height: window.innerHeight};
}

/**
 * @param {HTMLElement} display
 */
function clearPosition(display) {
  for ( const side of ["top", "right", "bottom", "left"] ) display.style[side] = "";
}
