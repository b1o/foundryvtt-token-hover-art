import { createShortcutPayload } from "../decisions/shortcut-payload.mjs";
import { toMovedItems } from "../decisions/tile-marks.mjs";
import { getTileKey } from "./picker-marks.mjs";
import { PickerDragDrop } from "./picker-drag-drop.mjs";

/*
 * The tile actions of the gallery picker that move tiles: the drag and drop and the tile menus. A move of a marked
 * tile moves all marked tiles (picker-marks.mjs). The writes go through PickerCategories.
 */

/**
 * @typedef {object} TileScope  The open picker now.
 * @property {string} tokenUuid
 * @property {import("../data/category-store.mjs").CategoryScope} scope
 * @property {string|null} categoryId  The shown category, or null for the root.
 * @property {string[]} paths          The gallery.
 */

export class PickerTiles {

  /** @type {import("./picker-marks.mjs").PickerMarks} */
  #marks;

  /** @type {import("./picker-categories.mjs").PickerCategories} */
  #categories;

  /** @type {function(): (TileScope|null)} */
  #getTileScope;

  /**
   * @param {object} options
   * @param {HTMLElement} options.root                  The picker element.
   * @param {import("./picker-marks.mjs").PickerMarks} options.marks
   * @param {import("./picker-categories.mjs").PickerCategories} options.categories
   * @param {function(): (TileScope|null)} options.getTileScope  Null while the picker is closed or its token is gone.
   */
  constructor({root, marks, categories, getTileScope}) {
    this.#marks = marks;
    this.#categories = categories;
    this.#getTileScope = getTileScope;
    new PickerDragDrop({
      root,
      getDrag: source => this.#getDrag(source),
      canDrop: (items, targetId) => this.#withScope(({scope}) => this.#categories.canDrop(scope, items, targetId))
        ?? false,
      onDrop: (items, targetId) => this.#withScope(({scope}) => this.#categories.drop(scope, items, targetId))
    });
  }

  /**
   * @param {HTMLElement} menuButton  The menu button of a tile.
   * @returns {import("./picker-menu.mjs").MenuSpec|null}
   */
  buildTileMenu(menuButton) {
    return this.#withScope(({scope, paths, categoryId}) => this.#categories.buildTileMenu(scope, paths, categoryId,
      this.#marks.getMovedKeys(getTileKey(menuButton))));
  }

  /**
   * @param {HTMLElement} source  A tile with data-tha-drag.
   * @returns {import("./picker-drag-drop.mjs").PickerDrag|null}  The payload for other targets (the hotbar) names
   *                                                             only the dragged tile.
   */
  #getDrag(source) {
    return this.#withScope(({tokenUuid}) => {
      const {thaDrag: kind, categoryId, path} = source.dataset;
      const key = getTileKey(source);
      return {
        payload: createShortcutPayload({kind, tokenUuid, categoryId, path}),
        // "No hover art" has no tile key: it goes only to the hotbar, so it moves nothing in the picker.
        items: toMovedItems(key ? this.#marks.getMovedKeys(key) : [])
      };
    });
  }

  /**
   * @param {function(TileScope): *} action
   * @returns {*}  The result of the action, or null while the picker is closed or its token is gone.
   */
  #withScope(action) {
    const tileScope = this.#getTileScope();
    return tileScope ? action(tileScope) : null;
  }
}
