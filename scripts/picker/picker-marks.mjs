import {
  NO_MARKS, startAt, toggleMark, markRange, addRange, keepShown, getMovedKeys
} from "../decisions/tile-marks.mjs";
import { isPointerClick } from "../keyboard-focus.mjs";

/*
 * The marked tiles of the open gallery picker (multi-select, docs/design-trigger-points.md 6.4), and their look. A
 * tile has data-tha-tile-key. A mark change only switches classes, so the images and videos of the tiles stay loaded.
 */

export class PickerMarks {

  /** @type {import("../decisions/tile-marks.mjs").TileMarks} */
  #marks = NO_MARKS;

  /** @type {function(): HTMLElement} */
  #getContent;

  /**
   * @param {object} options
   * @param {function(): HTMLElement} options.getContent  The rendered content of the picker.
   */
  constructor({getContent}) {
    this.#getContent = getContent;
  }

  /** @returns {boolean} */
  hasMarks() {
    return this.#marks.keys.length > 0;
  }

  /** Remove all marks and the anchor: after an open, a close, and a navigation. */
  clear() {
    this.#show(NO_MARKS);
  }

  /**
   * Handle a click on a tile. Ctrl (or Cmd) marks or unmarks, Shift marks a range, both add a range. A plain click
   * removes the marks and starts the next range at the tile; the caller then runs the normal action.
   * Marks are only for a drag, and only a pointer drags, so a click from the keyboard (Shift+Enter) is always plain.
   * @param {MouseEvent} event
   * @param {string|null} key  The key of the clicked tile, or null for a tile that cannot be marked ("No hover art").
   * @returns {boolean}  Was it a mark click? Then the caller does nothing else.
   */
  onTileClick(event, key) {
    const isPointer = isPointerClick(event);
    const isToggle = isPointer && (event.ctrlKey || event.metaKey);
    const isRange = isPointer && event.shiftKey;
    if ( key === null ) {
      if ( isToggle || isRange ) return true;
      this.clear();
      return false;
    }
    const order = this.#getOrder();
    if ( isToggle && isRange ) this.#show(addRange(this.#marks, order, key));
    else if ( isToggle ) this.#show(toggleMark(this.#marks, key));
    else if ( isRange ) this.#show(markRange(this.#marks, order, key));
    else {
      this.#show(startAt(key));
      return false;
    }
    return true;
  }

  /**
   * @param {string} key  A tile that is moved now (a drag or a menu).
   * @returns {string[]}  All marked tiles if it is marked, else only itself.
   */
  getMovedKeys(key) {
    return getMovedKeys(this.#marks, key);
  }

  /** Show the marks again after a render, without the tiles that are gone. */
  sync() {
    this.#show(keepShown(this.#marks, this.#getOrder()));
  }

  /**
   * @param {import("../decisions/tile-marks.mjs").TileMarks} marks
   */
  #show(marks) {
    this.#marks = marks;
    const description = game.i18n.localize("TOKEN_HOVER_ART.Picker.Marked");
    for ( const tile of this.#getTiles() ) {
      const isMarked = marks.keys.includes(tile.dataset.thaTileKey);
      tile.classList.toggle("tha-marked", isMarked);
      const choice = tile.querySelector(".tha-choice");
      if ( isMarked ) choice.setAttribute("aria-description", description);
      else choice.removeAttribute("aria-description");
    }
  }

  /** @returns {string[]}  The tile keys in screen order. */
  #getOrder() {
    return this.#getTiles().map(tile => tile.dataset.thaTileKey);
  }

  /** @returns {HTMLElement[]} */
  #getTiles() {
    return [...this.#getContent().querySelectorAll("[data-tha-tile-key]")];
  }
}

/**
 * @param {HTMLElement} element  A tile or an element in a tile.
 * @returns {string|null}  The tile key, or null for a tile that cannot be marked or moved ("No hover art").
 */
export function getTileKey(element) {
  return element.closest("[data-tha-tile-key]")?.dataset.thaTileKey ?? null;
}
