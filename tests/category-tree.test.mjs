import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readCategoryMap, buildTree, getAncestors, getDescendantIds, canMoveCategory, planCreateCategory, planRenameCategory,
  planMoveAsset, planMoveCategory, planDeleteCategory, countContent, getHolderIds, listCategories, planMoveItems
} from "../scripts/decisions/category-tree.mjs";

const category = (name, parentId = null, paths = [], sort = 0) => ({name, parentId, sort, paths});

// moods › angry › furious, and calm at the root.
const map = {
  moods: category("Moods", null, ["a.png"]),
  angry: category("Angry", "moods", ["b.png"]),
  furious: category("Furious", "angry"),
  calm: category("Calm", null, ["c.png"])
};
const gallery = ["a.png", "b.png", "c.png", "d.png"];

test("stored data without a name is dropped, and the other fields get safe values", () => {
  assert.deepEqual(readCategoryMap({
    good: {name: "Good", parentId: 5, sort: "x", paths: ["a.png", 3]},
    noName: {parentId: null},
    blank: {name: "  "},
    list: ["x"]
  }), {good: category("Good", null, ["a.png"])});
  assert.deepEqual(readCategoryMap(null), {});
  assert.deepEqual(readCategoryMap(["x"]), {});
});

test("the tree sorts categories by sort, then by name, and keeps the assets in gallery order", () => {
  const tree = buildTree({...map, zeta: category("Zeta", null, ["d.png", "a.png"], -1)}, gallery);
  assert.deepEqual(tree.rootIds, ["zeta", "calm", "moods"]);
  assert.deepEqual(tree.nodes.zeta.paths, ["a.png", "d.png"]);
  assert.deepEqual(tree.nodes.moods.paths, []);
  assert.deepEqual(tree.rootPaths, []);
});

test("a path that is in two categories stays in the first one in display order", () => {
  const tree = buildTree({...map, calm: category("Calm", null, ["a.png", "c.png"])}, gallery);
  assert.deepEqual(tree.nodes.calm.paths, ["a.png", "c.png"]);
  assert.deepEqual(tree.nodes.moods.paths, []);
});

test("the root shows the assets that are in no category; paths outside the gallery are ignored", () => {
  const tree = buildTree({...map, calm: category("Calm", null, ["gone.png", "c.png"])}, gallery);
  assert.deepEqual(tree.rootPaths, ["d.png"]);
  assert.deepEqual(tree.nodes.calm.paths, ["c.png"]);
  assert.deepEqual(tree.nodes.angry.paths, ["b.png"]);
});

test("a category with a missing parent goes to the root", () => {
  const tree = buildTree({lost: category("Lost", "gone")}, gallery);
  assert.deepEqual(tree.rootIds, ["lost"]);
  assert.equal(tree.nodes.lost.parentId, null);
});

test("a cycle breaks at the first repeated id", () => {
  const cyclic = {a: category("A", "b", ["a.png"]), b: category("B", "a"), self: category("Self", "self")};
  const tree = buildTree(cyclic, gallery);
  assert.deepEqual(tree.rootIds, ["a", "self"]);
  assert.deepEqual(tree.nodes.a.childIds, ["b"]);
  assert.deepEqual(tree.nodes.a.paths, ["a.png"]);
  assert.deepEqual(getAncestors(cyclic, "b"), ["a", "b"]);
  assert.deepEqual(getDescendantIds(cyclic, "a"), ["b"]);
});

test("the breadcrumb goes from the top category down to the category", () => {
  assert.deepEqual(getAncestors(map, "furious"), ["moods", "angry", "furious"]);
  assert.deepEqual(getAncestors(map, null), []);
  assert.deepEqual(getAncestors(map, "gone"), []);
});

test("the descendants include every depth", () => {
  assert.deepEqual(getDescendantIds(map, "moods"), ["angry", "furious"]);
  assert.deepEqual(getDescendantIds(map, "calm"), []);
});

test("a category cannot move into itself, into a descendant, or where it is now", () => {
  assert.equal(canMoveCategory(map, "moods", "moods"), false);
  assert.equal(canMoveCategory(map, "moods", "furious"), false);
  assert.equal(canMoveCategory(map, "moods", null), false);
  assert.equal(canMoveCategory(map, "moods", "gone"), false);
  assert.equal(canMoveCategory(map, "moods", "calm"), true);
  assert.equal(planMoveCategory(map, "moods", "angry"), null);
});

test("a category move writes only the moved category", () => {
  assert.deepEqual(planMoveCategory(map, "furious", null), {set: {furious: category("Furious")}, remove: []});
});

test("an asset move removes the asset from its old category and adds it to the target", () => {
  assert.deepEqual(planMoveAsset(map, "a.png", "calm"), {
    set: {moods: category("Moods"), calm: category("Calm", null, ["c.png", "a.png"])},
    remove: []
  });
});

test("an asset move to the root only removes it, and a move to its own category writes nothing", () => {
  assert.deepEqual(planMoveAsset(map, "b.png", null), {set: {angry: category("Angry", "moods")}, remove: []});
  assert.equal(planMoveAsset(map, "b.png", "angry"), null);
  assert.equal(planMoveAsset(map, "d.png", null), null);
  assert.equal(planMoveAsset(map, "d.png", "gone"), null);
});

test("an asset move also removes the duplicate from a second category", () => {
  const duplicated = {...map, calm: category("Calm", null, ["a.png"])};
  assert.deepEqual(planMoveAsset(duplicated, "a.png", "moods"), {set: {calm: category("Calm")}, remove: []});
});

test("a move of several items is one patch and skips the items that are at the target", () => {
  assert.deepEqual(planMoveItems(map, {paths: ["a.png", "b.png", "c.png"], categoryIds: ["furious"]}, "calm"), {
    set: {
      furious: category("Furious", "calm"),
      moods: category("Moods"),
      angry: category("Angry", "moods"),
      calm: category("Calm", null, ["c.png", "a.png", "b.png"])
    },
    remove: []
  });
  assert.equal(planMoveItems(map, {paths: ["c.png"], categoryIds: []}, "calm"), null);
});

test("a move of several items into a moved category or below one is refused", () => {
  assert.equal(planMoveItems(map, {paths: ["c.png"], categoryIds: ["moods"]}, "moods"), null);
  assert.equal(planMoveItems(map, {paths: ["c.png"], categoryIds: ["moods"]}, "furious"), null);
  assert.equal(planMoveItems(map, {paths: ["c.png"], categoryIds: []}, "gone"), null);
});

test("a delete removes the category and its descendants, and keeps the other categories", () => {
  assert.deepEqual(planDeleteCategory(map, "moods"), {set: {}, remove: ["moods", "angry", "furious"]});
  assert.equal(planDeleteCategory(map, "gone"), null);
});

test("a new category needs a name and an existing parent", () => {
  assert.deepEqual(planCreateCategory(map, {id: "new", name: " Happy ", parentId: "moods"}),
    {set: {new: category("Happy", "moods")}, remove: []});
  assert.equal(planCreateCategory(map, {id: "new", name: "  ", parentId: null}), null);
  assert.equal(planCreateCategory(map, {id: "new", name: "X", parentId: "gone"}), null);
  assert.equal(planCreateCategory(map, {id: "calm", name: "X", parentId: null}), null);
});

test("the choice list follows the tree and leaves out an excluded category with its descendants", () => {
  const tree = buildTree(map, gallery);
  assert.deepEqual(listCategories(tree, []), [
    {id: "calm", name: "Calm", depth: 0},
    {id: "moods", name: "Moods", depth: 0},
    {id: "angry", name: "Angry", depth: 1},
    {id: "furious", name: "Furious", depth: 2}
  ]);
  assert.deepEqual(listCategories(tree, ["angry"]).map(entry => entry.id), ["calm", "moods"]);
});

test("the content count includes every depth", () => {
  const tree = buildTree(map, gallery);
  assert.deepEqual(countContent(tree, "moods"), {categories: 2, assets: 2});
  assert.deepEqual(countContent(tree, "furious"), {categories: 0, assets: 0});
});

test("the holders of an asset go from its category up to the top", () => {
  const tree = buildTree(map, gallery);
  assert.deepEqual(getHolderIds(tree, "b.png"), ["angry", "moods"]);
  assert.deepEqual(getHolderIds(tree, "d.png"), []);
});

test("a rename needs a new, non-empty name", () => {
  assert.deepEqual(planRenameCategory(map, "calm", "Quiet"), {set: {calm: category("Quiet", null, ["c.png"])}, remove: []});
  assert.equal(planRenameCategory(map, "calm", "Calm"), null);
  assert.equal(planRenameCategory(map, "calm", " "), null);
  assert.equal(planRenameCategory(map, "gone", "X"), null);
});
