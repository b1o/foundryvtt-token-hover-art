import { buildTree, getAncestors, isLocation, planMoveItems } from "../decisions/category-tree.mjs";
import { reportActionError } from "../output.mjs";
import { buildAssetMenu, buildCategoryMenu, buildCreateField, buildMarkedMenu } from "./picker-menus.mjs";
import { toMovedItems } from "../decisions/tile-marks.mjs";

/*
 * The category actions of the gallery picker: read the categories of the current user, build the tile menus, and
 * start the writes of the menus and of the drops. All writes go through the CategoryStore. The picker renders again
 * when the User update arrives (updateUser), for this client and for every other client.
 */

/**
 * @typedef {import("../data/category-store.mjs").CategoryScope} CategoryScope
 * @typedef {import("../decisions/category-tree.mjs").CategoryMap} CategoryMap
 * @typedef {import("../decisions/category-tree.mjs").CategoryTree} CategoryTree
 * @typedef {import("../decisions/category-tree.mjs").MovedItems} MovedItems
 * @typedef {import("./picker-menu.mjs").MenuSpec} MenuSpec
 */

/**
 * @typedef {object} CategoryView
 * @property {CategoryTree} tree
 * @property {string|null} categoryId  The requested category, or null if it does not exist (any more).
 * @property {string[]} ancestorIds
 */

export class PickerCategories {

  /** @type {import("../data/category-store.mjs").CategoryStore} */
  #store;

  /**
   * @param {object} options
   * @param {import("../data/category-store.mjs").CategoryStore} options.store
   */
  constructor({store}) {
    this.#store = store;
  }

  /**
   * @param {CategoryScope} scope
   * @param {string[]} paths           The gallery.
   * @param {string|null} categoryId   The category that the picker wants to show.
   * @returns {CategoryView}
   */
  read(scope, paths, categoryId) {
    const map = this.#store.read(scope);
    const shownId = isLocation(map, categoryId) ? categoryId : null;
    return {tree: buildTree(map, paths), categoryId: shownId, ancestorIds: getAncestors(map, shownId)};
  }

  /**
   * The menu of a tile. For a marked tile among other marked tiles, the menu moves all of them.
   * @param {CategoryScope} scope
   * @param {string[]} paths           The gallery.
   * @param {string|null} locationId   The shown category: it holds the tile.
   * @param {string[]} movedKeys       The keys of the tiles that a move from this menu moves (tile-marks.mjs).
   * @returns {MenuSpec|null}  Null if the category of the tile no longer exists.
   */
  buildTileMenu(scope, paths, locationId, movedKeys) {
    const tree = buildTree(this.#store.read(scope), paths);
    const commands = this.#getCommands(scope);
    const items = toMovedItems(movedKeys);
    if ( movedKeys.length > 1 ) return buildMarkedMenu({items, tree, locationId}, commands);
    const [categoryId] = items.categoryIds;
    if ( categoryId === undefined ) return buildAssetMenu({path: items.paths[0], tree, locationId}, commands);
    return tree.nodes[categoryId] ? buildCategoryMenu({id: categoryId, tree, parentId: locationId}, commands) : null;
  }

  /**
   * @param {CategoryScope} scope
   * @param {string|null} parentId  The shown category: the new category goes into it.
   * @returns {MenuSpec}
   */
  buildCreateField(scope, parentId) {
    return buildCreateField(name => this.#run(this.#store.create(scope, parentId, name)));
  }

  /**
   * @param {CategoryScope} scope
   * @param {MovedItems} items
   * @param {string|null} targetId
   * @returns {boolean}  Does a drop of the items on the target change something?
   */
  canDrop(scope, items, targetId) {
    return planMoveItems(this.#store.read(scope), items, targetId) !== null;
  }

  /**
   * @param {CategoryScope} scope
   * @param {MovedItems} items  Items that canDrop accepted.
   * @param {string|null} targetId
   */
  drop(scope, items, targetId) {
    this.#run(this.#store.moveItems(scope, items, targetId));
  }

  /**
   * @param {CategoryScope} scope
   * @returns {import("./picker-menus.mjs").CategoryCommands}
   */
  #getCommands(scope) {
    const store = this.#store;
    return {
      moveItems: (items, targetId) => this.#run(store.moveItems(scope, items, targetId)),
      renameCategory: (id, name) => this.#run(store.rename(scope, id, name)),
      deleteCategory: id => this.#run(store.delete(scope, id))
    };
  }

  /**
   * @param {Promise<boolean>} write
   */
  #run(write) {
    write.catch(reportActionError);
  }
}
