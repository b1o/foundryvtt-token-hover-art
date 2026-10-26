import { getHolderIds } from "./category-tree.mjs";

/*
 * The template data of the gallery picker. No Foundry access: the picker collects the facts and passes them in.
 */

/**
 * @typedef {object} PickerFacts
 * @property {string} tokenName
 * @property {import("./category-tree.mjs").CategoryTree} tree  The categories of the user, with the gallery.
 * @property {string|null} categoryId     The shown category, or null for the root. It must be in the tree.
 * @property {string[]} ancestorIds       The breadcrumb of the shown category (getAncestors).
 * @property {string|null} selectedPath   The hover art of the token, or null.
 * @property {boolean} isSecret           Is the hover art of the token secret?
 * @property {boolean} isGM
 * @property {boolean} canManage          Can the user open the gallery manager?
 * @property {boolean} isMoved            Did the user drag the picker away from its default place?
 * @property {boolean} canDragToHotbar    Are hotbar shortcuts on? "No hover art" is a drag source only then.
 * @property {function(string): boolean} isVideo
 */

/**
 * @param {PickerFacts} facts
 * @returns {object}  The data for gallery-picker.hbs.
 */
export function buildPickerView(facts) {
  const {tree, categoryId, selectedPath, isVideo} = facts;
  const isRoot = categoryId === null;
  const holderIds = (selectedPath === null) ? [] : getHolderIds(tree, selectedPath);
  const categoryIds = isRoot ? tree.rootIds : tree.nodes[categoryId].childIds;
  const paths = isRoot ? tree.rootPaths : tree.nodes[categoryId].paths;
  const categories = categoryIds.map(id => ({
    id,
    name: tree.nodes[id].name,
    containsSelection: holderIds.includes(id)
  }));
  return {
    tokenName: facts.tokenName,
    isGM: facts.isGM,
    canManage: facts.canManage,
    isMoved: facts.isMoved,
    canDragToHotbar: facts.canDragToHotbar,
    secret: facts.isSecret,
    isRoot,
    hasSelection: selectedPath !== null,
    breadcrumb: [
      {id: "", name: null, isRoot: true, isCurrent: isRoot},
      ...facts.ancestorIds.map(id => ({id, name: tree.nodes[id].name, isRoot: false, isCurrent: id === categoryId}))
    ],
    categories,
    images: paths.map(path => ({
      path,
      name: getFileName(path),
      isVideo: isVideo(path),
      active: path === selectedPath
    })),
    isEmpty: !categories.length && !paths.length
  };
}

/**
 * @param {string} path  A file path or URL.
 * @returns {string}     The last path segment, decoded, as the accessible name of an image tile.
 */
export function getFileName(path) {
  const name = path.split(/[?#]/)[0].split("/").pop() || path;
  try {
    return decodeURIComponent(name);
  } catch {
    // A "%" that is not an escape sequence makes decodeURIComponent throw. The raw name is still a usable name.
    return name;
  }
}
