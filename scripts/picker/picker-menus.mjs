import { listCategories, countContent } from "../decisions/category-tree.mjs";
import { getFileName } from "../decisions/picker-view.mjs";

/*
 * The content of each popup of the gallery picker (picker-menu.mjs): the tile menus with "Move to…", the name field,
 * and the delete confirmation. "Move to…" is a feature of its own; it also gives the keyboard a way to move a tile,
 * but a drag needs no keyboard path (FOUNDRY_MODULE_RULES.md 9.3, temporary exception).
 */

/**
 * @typedef {import("./picker-menu.mjs").MenuSpec} MenuSpec
 * @typedef {import("./picker-menu.mjs").MenuItem} MenuItem
 * @typedef {import("../decisions/category-tree.mjs").CategoryTree} CategoryTree
 * @typedef {import("../decisions/category-tree.mjs").MovedItems} MovedItems
 */

/**
 * @typedef {object} CategoryCommands  Each command starts a write. The picker renders again on the User update.
 * @property {function(MovedItems, string|null): void} moveItems  The target is a category, or null for the root.
 * @property {function(string, string): void} renameCategory
 * @property {function(string): void} deleteCategory
 */

const localize = key => game.i18n.localize(`TOKEN_HOVER_ART.Picker.${key}`);
const format = (key, data) => game.i18n.format(`TOKEN_HOVER_ART.Picker.${key}`, data);

/**
 * @param {object} asset
 * @param {string} asset.path
 * @param {CategoryTree} asset.tree
 * @param {string|null} asset.locationId  The category that holds the asset, or null for the root.
 * @param {CategoryCommands} commands
 * @returns {MenuSpec}
 */
export function buildAssetMenu({path, tree, locationId}, commands) {
  return {
    title: getFileName(path),
    items: [{
      label: localize("MoveTo"),
      next: () => buildMoveTargets(tree, [], locationId,
        targetId => commands.moveItems({paths: [path], categoryIds: []}, targetId))
    }]
  };
}

/**
 * The menu of two or more marked tiles: only the move, for all of them.
 * @param {object} marked
 * @param {MovedItems} marked.items
 * @param {CategoryTree} marked.tree
 * @param {string|null} marked.locationId  The shown category: it holds the marked tiles.
 * @param {CategoryCommands} commands
 * @returns {MenuSpec}
 */
export function buildMarkedMenu({items, tree, locationId}, commands) {
  const count = items.paths.length + items.categoryIds.length;
  return {
    title: format("MarkedTitle", {count}),
    items: [{
      label: localize("MoveTo"),
      next: () => buildMoveTargets(tree, items.categoryIds, locationId, targetId => commands.moveItems(items, targetId))
    }]
  };
}

/**
 * @param {object} category
 * @param {string} category.id
 * @param {CategoryTree} category.tree
 * @param {string|null} category.parentId
 * @param {CategoryCommands} commands
 * @returns {MenuSpec}
 */
export function buildCategoryMenu({id, tree, parentId}, commands) {
  const name = tree.nodes[id].name;
  return {
    title: name,
    items: [
      {
        label: localize("Rename"),
        next: () => buildNameField(format("RenameTitle", {name}), name, value => commands.renameCategory(id, value))
      },
      {
        label: localize("MoveTo"),
        next: () => buildMoveTargets(tree, [id], parentId,
          targetId => commands.moveItems({paths: [], categoryIds: [id]}, targetId))
      },
      buildDeleteItem(id, tree, commands)
    ]
  };
}

/**
 * @param {function(string): void} onSubmit  Called with the typed name.
 * @returns {MenuSpec}
 */
export function buildCreateField(onSubmit) {
  return buildNameField(localize("NewCategory"), "", onSubmit);
}

/**
 * The root and every category, as an indented list. The current place shows, but cannot be selected.
 * @param {CategoryTree} tree
 * @param {string[]} excludedIds   The moved categories: they cannot go into themselves or below themselves.
 * @param {string|null} currentId  Where the moved tiles are now.
 * @param {function(string|null): void} onMove
 * @returns {MenuSpec}
 */
function buildMoveTargets(tree, excludedIds, currentId, onMove) {
  const root = {label: localize("Root"), depth: 0, isDisabled: currentId === null, onSelect: () => onMove(null)};
  const categories = listCategories(tree, excludedIds).map(({id, name, depth}) => ({
    label: name,
    depth: depth + 1,
    isDisabled: id === currentId,
    onSelect: () => onMove(id)
  }));
  return {title: localize("MoveTo"), items: [root, ...categories]};
}

/**
 * A delete asks first if the category has content: the categories in it go away too.
 * @param {string} id
 * @param {CategoryTree} tree
 * @param {CategoryCommands} commands
 * @returns {MenuItem}
 */
function buildDeleteItem(id, tree, commands) {
  const label = localize("Delete");
  const onSelect = () => commands.deleteCategory(id);
  const {categories, assets} = countContent(tree, id);
  if ( !categories && !assets ) return {label, onSelect};
  return {
    label,
    next: () => ({
      title: format("DeleteTitle", {name: tree.nodes[id].name}),
      message: [
        categories ? format("DeleteCategories", {count: categories}) : "",
        assets ? format("DeleteImages", {count: assets}) : ""
      ].filter(Boolean).join(" "),
      // Cancel comes first, so a keyboard user starts on the safe choice.
      items: [{label: localize("Cancel")}, {label, onSelect}]
    })
  };
}

/**
 * @param {string} title
 * @param {string} value
 * @param {function(string): void} onSubmit
 * @returns {MenuSpec}
 */
function buildNameField(title, value, onSubmit) {
  return {title, field: {value, onSubmit}, items: []};
}
