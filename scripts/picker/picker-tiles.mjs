import { createShortcutPayload } from "../decisions/shortcut-payload.mjs";
import { toMovedItems } from "../decisions/tile-marks.mjs";
import { PickerMarks } from "./picker-marks.mjs";
import { PickerDragDrop } from "./picker-drag-drop.mjs";

/*
 * The tile actions of the gallery picker that move tiles: the marks (multi-select) and the drag and drop. A drag of a
 * marked tile moves all marked tiles. The writes go through PickerCategories.
 */

/**
 * @typedef {object} TileScope  The open picker now.
 * @property {string} tokenUuid
 * @property {import("../data/category-store.mjs").CategoryScope} scope
 * @property {string|null} categoryId  The shown category, or null for the root.
 * @property {string[]} paths          The gallery.
 */

export class PickerTiles {

  /** @type {PickerMarks} */
  #marks;

  /** @type {import("./picker-categories.mjs").PickerCategories} */
  #categories;

  /** @type {function(): (TileScope|null)} */
  #getTileScope;

  /**
   * @param {object} options
   * @param {HTMLElement} options.root                  The picker element.
   * @param {function(): HTMLElement} options.getContent The rendered content of the picker.
   * @param {import("./picker-categories.mjs").PickerCategories} options.categories
   * @param {function(): (TileScope|null)} options.getTileScope  Null while the picker is closed or its token is gone.
   */
  constructor({root, getContent, categories, getTileScope}) {
    this.#marks = new PickerMarks({getContent});
    this.#categories = categories;
    this.#getTileScope = getTileScope;
    new PickerDragDrop({
      root,
      getDrag: source => this.#getDrag(source),
      canDrop: (items, targetId) => this.#withScope(({scope}) => this.#categories.canDrop(scope, items, targetId)),
      onDrop: (items, targetId) => this.#withScope(({scope}) => this.#categories.drop(scope, items, targetId))
    });
  }

  /** @returns {boolean}  Are tiles marked? */
  hasMarks() {
    return this.#marks.hasMarks();
  }

  /** Remove the marks: after an open, a close, a navigation, and for Escape. */
  clearMarks() {
    this.#marks.clear();
  }

  /** Show the marks again after a render. */
  syncMarks() {
    this.#marks.sync();
  }

  /**
   * @param {MouseEvent} event
   * @param {HTMLElement} button  The clicked tile button.
   * @returns {boolean}  Was it a Ctrl or Shift click, which only changes the marks?
   */
  isMarkClick(event, button) {
    return this.#marks.onTileClick(event, getTileKey(button));
  }

  /**
   * @param {HTMLElement} source  A tile with data-tha-drag.
   * @returns {import("./picker-drag-drop.mjs").PickerDrag|null}  The payload for other targets (the hotbar) names
   *                                                             only the dragged tile.
   */
  #getDrag(source) {
    return this.#withScope(({tokenUuid}) => {
      const {thaDrag: kind, categoryId, path} = source.dataset;
      return {
        payload: createShortcutPayload({kind, tokenUuid, categoryId, path}),
        items: toMovedItems(this.#marks.getMovedKeys(getTileKey(source)))
      };
    }) || null;
  }

  /**
   * @param {function(TileScope): *} action
   * @returns {*}  The result of the action, or false while the picker is closed or its token is gone.
   */
  #withScope(action) {
    const tileScope = this.#getTileScope();
    return tileScope ? action(tileScope) : false;
  }
}

/**
 * @param {HTMLElement} element  A tile or an element in a tile.
 * @returns {string|null}  The tile key, or null for a tile that cannot be marked or moved ("No hover art").
 */
function getTileKey(element) {
  return element.closest("[data-tha-tile-key]")?.dataset.thaTileKey ?? null;
}
