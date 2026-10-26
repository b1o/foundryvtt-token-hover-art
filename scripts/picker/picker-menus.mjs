import { countContent } from "../decisions/category-tree.mjs";

/*
 * The content of each popup of the gallery picker (picker-menu.mjs): the category menu and the name field. A move is a
 * drag only, with no menu path (FOUNDRY_MODULE_RULES.md 9.3, temporary exception).
 */

/**
 * @typedef {import("./picker-menu.mjs").MenuSpec} MenuSpec
 * @typedef {import("./picker-menu.mjs").MenuItem} MenuItem
 * @typedef {import("../decisions/category-tree.mjs").CategoryTree} CategoryTree
 */

/**
 * @typedef {object} CategoryCommands  Each command starts a write. The picker renders again on the User update.
 * @property {function(string, string): void} renameCategory
 * @property {function(string): void} deleteCategory
 */

const localize = key => game.i18n.localize(`TOKEN_HOVER_ART.Picker.${key}`);
const format = (key, data) => game.i18n.format(`TOKEN_HOVER_ART.Picker.${key}`, data);

/**
 * @param {string} id
 * @param {CategoryTree} tree
 * @param {CategoryCommands} commands
 * @returns {MenuSpec}
 */
export function buildCategoryMenu(id, tree, commands) {
  const name = tree.nodes[id].name;
  return {
    title: name,
    items: [
      {
        label: localize("Rename"),
        next: () => buildNameField(format("RenameTitle", {name}), name, value => commands.renameCategory(id, value))
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
