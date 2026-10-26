import { MODULE_ID, FLAGS } from "../constants.mjs";
import {
  readCategoryMap, planCreateCategory, planRenameCategory, planDeleteCategory, planMoveItems
} from "../decisions/category-tree.mjs";

/*
 * All reads and writes of the picker categories (docs/design-trigger-points.md 6.1 and 6.3).
 *
 * Storage: flags.token-hover-art.categories.<baseActorId>.<categoryId> on the User who owns the categories. Every user
 * can update the own User document (common/documents/user.mjs, #canUpdate).
 *
 * Writes: each change reads the current map right before its write and writes only the changed categories, with a
 * "-=" key for a deletion. The writes of this client run one after the other, so a write always reads the result of
 * the write before it.
 */

/**
 * @typedef {import("../decisions/category-tree.mjs").CategoryMap} CategoryMap
 * @typedef {import("../decisions/category-tree.mjs").CategoryPatch} CategoryPatch
 */

/**
 * @typedef {object} CategoryScope
 * @property {string} userId   The User who owns the categories.
 * @property {string|null} actorId  The base Actor of the gallery. A token without an Actor has no categories.
 */

export class CategoryStore {

  /** The last write of this client. The next write starts when it ends. */
  #lastWrite = Promise.resolve();

  /**
   * @param {CategoryScope} scope
   * @returns {CategoryMap}  The validated categories.
   */
  read({userId, actorId}) {
    return readCategoryMap(game.users.get(userId)?.getFlag(MODULE_ID, `${FLAGS.CATEGORIES}.${actorId}`));
  }

  /**
   * @param {CategoryScope} scope
   * @param {string|null} parentId
   * @param {string} name
   * @returns {Promise<boolean>}  Was a category created?
   */
  create(scope, parentId, name) {
    const id = foundry.utils.randomID();
    return this.#write(scope, map => planCreateCategory(map, {id, name, parentId}));
  }

  /**
   * @param {CategoryScope} scope
   * @param {string} id
   * @param {string} name
   * @returns {Promise<boolean>}  Was the name changed?
   */
  rename(scope, id, name) {
    return this.#write(scope, map => planRenameCategory(map, id, name));
  }

  /**
   * @param {CategoryScope} scope
   * @param {string} id
   * @returns {Promise<boolean>}  Was the category deleted?
   */
  delete(scope, id) {
    return this.#write(scope, map => planDeleteCategory(map, id));
  }

  /**
   * Move assets and categories, one or several, in one write.
   * @param {CategoryScope} scope
   * @param {import("../decisions/category-tree.mjs").MovedItems} items
   * @param {string|null} targetId  A category id, or null for the root.
   * @returns {Promise<boolean>}  Did something move?
   */
  moveItems(scope, items, targetId) {
    return this.#write(scope, map => planMoveItems(map, items, targetId));
  }

  /**
   * Run a change after the last write of this client, on the map as it is at that moment.
   * @param {CategoryScope} scope
   * @param {function(CategoryMap): (CategoryPatch|null)} plan  Returns the patch, or null for no write.
   * @returns {Promise<boolean>}  Did the change write?
   */
  #write(scope, plan) {
    const write = this.#lastWrite.then(async () => {
      if ( !scope.actorId ) throw new Error(game.i18n.localize("TOKEN_HOVER_ART.Errors.NoActor"));
      const patch = plan(this.read(scope));
      if ( !patch ) return false;
      await game.users.get(scope.userId).update(toUpdate(scope.actorId, patch));
      return true;
    });
    // A failed write must not stop the writes after it. The caller of this write gets its error.
    this.#lastWrite = write.then(() => undefined, () => undefined);
    return write;
  }
}

/**
 * @param {string} actorId
 * @param {CategoryPatch} patch
 * @returns {object}  The User update: one key for each changed category.
 */
function toUpdate(actorId, {set, remove}) {
  const base = `flags.${MODULE_ID}.${FLAGS.CATEGORIES}.${actorId}`;
  const update = {};
  for ( const [id, category] of Object.entries(set) ) update[`${base}.${id}`] = category;
  for ( const id of remove ) update[`${base}.-=${id}`] = null;
  return update;
}
