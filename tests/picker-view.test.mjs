import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPickerView, getFileName } from "../scripts/decisions/picker-view.mjs";

const facts = {
  tokenName: "Goblin",
  paths: ["art/goblin%20angry.webp", "art/goblin-idle.webm"],
  selectedPath: "art/goblin-idle.webm",
  isSecret: false,
  isGM: true,
  canManage: true,
  isVideo: path => path.endsWith(".webm")
};

test("each gallery path becomes a tile that marks the selection and the video files", () => {
  assert.deepEqual(buildPickerView(facts).images, [
    {path: "art/goblin%20angry.webp", name: "goblin angry.webp", isVideo: false, active: false},
    {path: "art/goblin-idle.webm", name: "goblin-idle.webm", isVideo: true, active: true}
  ]);
});

test("a token without hover art has no selection", () => {
  const view = buildPickerView({...facts, selectedPath: null});
  assert.equal(view.hasSelection, false);
  assert.equal(view.images.some(image => image.active), false);
});

test("the file name ignores the query and survives a broken escape", () => {
  assert.equal(getFileName("https://example.com/a/b.png?v=2"), "b.png");
  assert.equal(getFileName("art/100%.png"), "100%.png");
  assert.equal(getFileName("plain"), "plain");
});
