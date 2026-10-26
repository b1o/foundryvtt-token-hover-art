/*
 * The category rules of the gallery picker (docs/design-trigger-points.md 6.2). A user keeps the categories of one
 * Actor gallery as a flat map with parent ids. The tree comes from the map on each read, so invalid stored data never
 * reaches the UI: a missing parent puts a category at the root, a cycle breaks at the first repeated id, a path that is
 * not in the gallery is ignored, and a path that is in two categories stays in the first one.
 *
 * A change returns a patch with only the changed categories, so the store can write narrow updates. A null patch means
 * that the change writes nothing: it is refused, or it changes nothing.
 */

/**
 * @typedef {object} Category
 * @property {string} name
 * @property {string|null} parentId   The parent category, or null for the root.
 * @property {number} sort            Categories sort by this value, then by name.
 * @property {string[]} paths         The assets in this category.
 */

/**
 * @typedef {Record<string, Category>} CategoryMap  Categories by id.
 */

/**
 * @typedef {object} CategoryPatch
 * @property {Record<string, Category>} set   The categories to write, complete.
 * @property {string[]} remove                The ids to delete.
 */

/**
 * @typedef {object} TreeNode
 * @property {string} id
 * @property {string} name
 * @property {string|null} parentId   The parent after the repair of missing parents and cycles.
 * @property {string[]} childIds      In display order.
 * @property {string[]} paths         The gallery assets of this category, in gallery order.
 */

/**
 * @typedef {object} CategoryTree
 * @property {Record<string, TreeNode>} nodes
 * @property {string[]} rootIds        The top categories, in display order.
 * @property {string[]} rootPaths      The gallery assets that are in no category, in gallery order.
 */

/**
 * Validate stored category data (FOUNDRY_MODULE_RULES.md 7.4). An entry without a name is dropped; the other fields
 * get safe values.
 * @param {unknown} stored  The flag value.
 * @returns {CategoryMap}
 */
export function readCategoryMap(stored) {
  const map = {};
  if ( !isPlainObject(stored) ) return map;
  for ( const [id, entry] of Object.entries(stored) ) {
    if ( !isPlainObject(entry) || (typeof entry.name !== "string") || !entry.name.trim() ) continue;
    map[id] = {
      name: entry.name,
      parentId: (typeof entry.parentId === "string") ? entry.parentId : null,
      sort: Number.isFinite(entry.sort) ? entry.sort : 0,
      paths: Array.isArray(entry.paths) ? entry.paths.filter(path => typeof path === "string") : []
    };
  }
  return map;
}

/**
 * @param {CategoryMap} map
 * @param {string[]} galleryPaths  The gallery, in gallery order.
 * @returns {CategoryTree}
 */
export function buildTree(map, galleryPaths) {
  const parents = resolveParents(map);
  const nodes = {};
  for ( const id of Object.keys(map) ) {
    nodes[id] = {id, name: map[id].name, parentId: parents.get(id), childIds: [], paths: []};
  }
  const rootIds = [];
  for ( const id of sortIds(map, Object.keys(map)) ) {
    const parentId = parents.get(id);
    if ( parentId === null ) rootIds.push(id);
    else nodes[parentId].childIds.push(id);
  }

  const owners = new Map();
  const claimPaths = id => {
    for ( const path of map[id].paths ) if ( !owners.has(path) ) owners.set(path, id);
    nodes[id].childIds.forEach(claimPaths);
  };
  rootIds.forEach(claimPaths);

  const rootPaths = [];
  for ( const path of new Set(galleryPaths) ) {
    const owner = owners.get(path);
    if ( owner === undefined ) rootPaths.push(path);
    else nodes[owner].paths.push(path);
  }
  return {nodes, rootIds, rootPaths};
}

/**
 * The breadcrumb of a category.
 * @param {CategoryMap} map
 * @param {string|null} id
 * @returns {string[]}  The ids from the top category down to the category itself. Empty for the root or a missing id.
 */
export function getAncestors(map, id) {
  if ( !hasCategory(map, id) ) return [];
  const parents = resolveParents(map);
  const ids = [];
  for ( let current = id; current !== null; current = parents.get(current) ) ids.unshift(current);
  return ids;
}

/**
 * @param {CategoryMap} map
 * @param {string} id
 * @returns {string[]}  The ids of all categories below the category, at every depth.
 */
export function getDescendantIds(map, id) {
  const parents = resolveParents(map);
  const childIds = parentId => Object.keys(map).filter(childId => parents.get(childId) === parentId);
  const result = [];
  const visit = parentId => {
    for ( const childId of childIds(parentId) ) {
      result.push(childId);
      visit(childId);
    }
  };
  if ( hasCategory(map, id) ) visit(id);
  return result;
}

/**
 * @param {CategoryTree} tree
 * @param {string} id
 * @returns {{categories: number, assets: number}}  What a delete of the category gives back to the root: the
 *                                                  categories below it and the assets in it and below it.
 */
export function countContent(tree, id) {
  const count = {categories: 0, assets: 0};
  const visit = nodeId => {
    count.assets += tree.nodes[nodeId].paths.length;
    for ( const childId of tree.nodes[nodeId].childIds ) {
      count.categories += 1;
      visit(childId);
    }
  };
  if ( tree.nodes[id] ) visit(id);
  return count;
}

/**
 * @param {CategoryTree} tree
 * @param {string} path
 * @returns {string[]}  The category that holds the asset and the categories above it. Empty for an asset at the root.
 */
export function getHolderIds(tree, path) {
  const holder = Object.values(tree.nodes).find(node => node.paths.includes(path));
  const ids = [];
  for ( let id = holder?.id ?? null; id !== null; id = tree.nodes[id].parentId ) ids.push(id);
  return ids;
}

/**
 * @param {CategoryMap} map
 * @param {string|null} id  A category id, or null for the root.
 * @returns {boolean}  Is it the root or an existing category?
 */
export function isLocation(map, id) {
  return (id === null) || hasCategory(map, id);
}

/**
 * @param {CategoryMap} map
 * @param {string} id
 * @param {string|null} targetParentId
 * @returns {boolean}  Can the category move into the target? Not into itself, not into one of its descendants, and
 *                     not where it is now.
 */
export function canMoveCategory(map, id, targetParentId) {
  if ( !hasCategory(map, id) || !isLocation(map, targetParentId) ) return false;
  if ( targetParentId === resolveParents(map).get(id) ) return false;
  return (targetParentId !== id) && !getDescendantIds(map, id).includes(targetParentId);
}

/**
 * @param {CategoryMap} map
 * @param {{id: string, name: string, parentId: string|null}} category  The id comes from the caller.
 * @returns {CategoryPatch|null}  Null if the name is empty, the id exists, or the parent is missing.
 */
export function planCreateCategory(map, {id, name, parentId}) {
  const trimmed = name.trim();
  if ( !trimmed || hasCategory(map, id) || !isLocation(map, parentId) ) return null;
  return {set: {[id]: {name: trimmed, parentId, sort: 0, paths: []}}, remove: []};
}

/**
 * @param {CategoryMap} map
 * @param {string} id
 * @param {string} name
 * @returns {CategoryPatch|null}  Null if the category is missing, or the name is empty or the same.
 */
export function planRenameCategory(map, id, name) {
  const trimmed = name.trim();
  if ( !hasCategory(map, id) || !trimmed || (map[id].name === trimmed) ) return null;
  return {set: {[id]: {...map[id], name: trimmed}}, remove: []};
}

/**
 * Move an asset into a category, or to the root. The asset leaves every category that holds it, so the move also
 * repairs a path that is in two categories.
 * @param {CategoryMap} map
 * @param {string} path
 * @param {string|null} targetId  A category id, or null for the root.
 * @returns {CategoryPatch|null}  Null if the target is missing or the asset is there already.
 */
export function planMoveAsset(map, path, targetId) {
  if ( !isLocation(map, targetId) ) return null;
  const set = {};
  for ( const [id, category] of Object.entries(map) ) {
    if ( (id !== targetId) && category.paths.includes(path) ) {
      set[id] = {...category, paths: category.paths.filter(p => p !== path)};
    }
  }
  if ( (targetId !== null) && !map[targetId].paths.includes(path) ) {
    set[targetId] = {...map[targetId], paths: [...map[targetId].paths, path]};
  }
  return isEmpty(set) ? null : {set, remove: []};
}

/**
 * @param {CategoryMap} map
 * @param {string} id
 * @param {string|null} targetParentId  A category id, or null for the root.
 * @returns {CategoryPatch|null}  Null if canMoveCategory refuses the move.
 */
export function planMoveCategory(map, id, targetParentId) {
  if ( !canMoveCategory(map, id, targetParentId) ) return null;
  return {set: {[id]: {...map[id], parentId: targetParentId}}, remove: []};
}

/**
 * @typedef {object} MovedItems
 * @property {string[]} paths
 * @property {string[]} categoryIds
 */

/**
 * Move several assets and categories in one patch (multi-select). Each item follows the rule of its single move, and
 * an item that is at the target already is skipped.
 * @param {CategoryMap} map
 * @param {MovedItems} items
 * @param {string|null} targetId  A category id, or null for the root.
 * @returns {CategoryPatch|null}  Null if the target is missing, is a moved category or below one, or nothing changes.
 */
export function planMoveItems(map, {paths, categoryIds}, targetId) {
  if ( !isLocation(map, targetId) ) return null;
  const isInsideMoved = categoryIds.some(id => (id === targetId) || getDescendantIds(map, id).includes(targetId));
  if ( isInsideMoved ) return null;
  let current = map;
  const set = {};
  const patches = [
    ...categoryIds.map(id => () => planMoveCategory(current, id, targetId)),
    ...paths.map(path => () => planMoveAsset(current, path, targetId))
  ];
  for ( const plan of patches ) {
    const patch = plan();
    if ( !patch ) continue;
    Object.assign(set, patch.set);
    current = {...current, ...patch.set};
  }
  return isEmpty(set) ? null : {set, remove: []};
}

/**
 * Delete a category and all categories below it. Their assets go back to the root: a category action never removes an
 * asset from the gallery.
 * @param {CategoryMap} map
 * @param {string} id
 * @returns {CategoryPatch|null}  Null if the category is missing.
 */
export function planDeleteCategory(map, id) {
  if ( !hasCategory(map, id) ) return null;
  return {set: {}, remove: [id, ...getDescendantIds(map, id)]};
}

/**
 * The parent of each category after the repair: a missing parent becomes the root, and a cycle breaks at the first
 * repeated id, which goes to the root. The ids are visited in a fixed order, so every client repairs the same way.
 * @param {CategoryMap} map
 * @returns {Map<string, string|null>}
 */
function resolveParents(map) {
  const parents = new Map();
  for ( const id of Object.keys(map).sort() ) {
    const chain = [];
    let current = id;
    while ( (current !== null) && !parents.has(current) ) {
      if ( chain.includes(current) ) {
        parents.set(current, null);
        break;
      }
      chain.push(current);
      const parentId = map[current].parentId;
      current = hasCategory(map, parentId) ? parentId : null;
    }
    for ( const chainId of chain ) {
      if ( parents.has(chainId) ) continue;
      const parentId = map[chainId].parentId;
      parents.set(chainId, hasCategory(map, parentId) ? parentId : null);
    }
  }
  return parents;
}

/**
 * @param {CategoryMap} map
 * @param {string[]} ids
 * @returns {string[]}  By sort, then by name, then by id, so the order is the same on every client.
 */
function sortIds(map, ids) {
  return [...ids].sort((a, b) => (map[a].sort - map[b].sort)
    || map[a].name.localeCompare(map[b].name)
    || a.localeCompare(b));
}

/**
 * @param {CategoryMap} map
 * @param {unknown} id
 * @returns {boolean}
 */
function hasCategory(map, id) {
  return (typeof id === "string") && Object.hasOwn(map, id);
}

function isPlainObject(value) {
  return (typeof value === "object") && (value !== null) && !Array.isArray(value);
}

function isEmpty(object) {
  return Object.keys(object).length === 0;
}
