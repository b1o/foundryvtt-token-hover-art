import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPickerView, getFileName } from "../scripts/decisions/picker-view.mjs";
import { buildTree } from "../scripts/decisions/category-tree.mjs";

const paths = ["art/goblin%20angry.webp", "art/goblin-idle.webm", "art/goblin-calm.png"];
const categories = {
  moods: {name: "Moods", parentId: null, sort: 0, paths: []},
  angry: {name: "Angry", parentId: "moods", sort: 0, paths: ["art/goblin%20angry.webp"]}
};

const facts = {
  tokenName: "Goblin",
  tree: buildTree({}, paths),
  categoryId: null,
  ancestorIds: [],
  selectedPath: "art/goblin-idle.webm",
  isSecret: false,
  isGM: true,
  canManage: true,
  isMoved: false,
  canDragToHotbar: true,
  isVideo: path => path.endsWith(".webm")
};

test("each gallery path becomes a tile that marks the selection and the video files", () => {
  assert.deepEqual(buildPickerView(facts).images.slice(0, 2), [
    {path: "art/goblin%20angry.webp", tileKey: "asset:art/goblin%20angry.webp", name: "goblin angry.webp",
      isVideo: false, active: false},
    {path: "art/goblin-idle.webm", tileKey: "asset:art/goblin-idle.webm", name: "goblin-idle.webm", isVideo: true,
      active: true}
  ]);
});

test("a token without hover art has no selection", () => {
  const view = buildPickerView({...facts, selectedPath: null});
  assert.equal(view.hasSelection, false);
  assert.equal(view.images.some(image => image.active), false);
});

test("the root shows the top categories and the assets that are in no category", () => {
  const view = buildPickerView({...facts, tree: buildTree(categories, paths), selectedPath: "art/goblin%20angry.webp"});
  assert.equal(view.isRoot, true);
  assert.deepEqual(view.categories, [{id: "moods", tileKey: "category:moods", name: "Moods", containsSelection: true}]);
  assert.deepEqual(view.images.map(image => image.name), ["goblin-idle.webm", "goblin-calm.png"]);
  assert.deepEqual(view.breadcrumb, [{id: "", name: null, isRoot: true, isCurrent: true}]);
});

test("a category shows its sub-categories, its assets, and the breadcrumb down to it", () => {
  const view = buildPickerView({...facts, tree: buildTree(categories, paths), categoryId: "angry",
    ancestorIds: ["moods", "angry"]});
  assert.equal(view.isRoot, false);
  assert.deepEqual(view.categories, []);
  assert.deepEqual(view.images.map(image => image.name), ["goblin angry.webp"]);
  assert.deepEqual(view.breadcrumb.map(part => [part.id, part.isCurrent]), [["", false], ["moods", false],
    ["angry", true]]);
  assert.equal(view.isEmpty, false);
});

test("an empty category is empty", () => {
  const tree = buildTree({...categories, empty: {name: "Empty", parentId: null, sort: 0, paths: []}}, paths);
  assert.equal(buildPickerView({...facts, tree, categoryId: "empty", ancestorIds: ["empty"]}).isEmpty, true);
});

test("the file name ignores the query and survives a broken escape", () => {
  assert.equal(getFileName("https://example.com/a/b.png?v=2"), "b.png");
  assert.equal(getFileName("art/100%.png"), "100%.png");
  assert.equal(getFileName("plain"), "plain");
});
