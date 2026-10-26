import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NO_MARKS, startAt, toggleMark, markRange, addRange, keepShown, toMovedItems, getMovedKeys
} from "../scripts/decisions/tile-marks.mjs";

const order = ["category:a", "asset:1.png", "asset:2.png", "asset:3.png", "asset:4.png"];

test("ctrl+click marks a tile and removes its mark again", () => {
  const marked = toggleMark(NO_MARKS, "asset:2.png");
  assert.deepEqual(marked, {keys: ["asset:2.png"], anchor: "asset:2.png"});
  assert.deepEqual(toggleMark(marked, "asset:2.png"), {keys: [], anchor: "asset:2.png"});
});

test("shift+click marks the range from the anchor in both directions and replaces the marks", () => {
  const marks = {keys: ["category:a"], anchor: "asset:3.png"};
  assert.deepEqual(markRange(marks, order, "asset:1.png").keys, ["asset:1.png", "asset:2.png", "asset:3.png"]);
  assert.deepEqual(markRange(startAt("asset:1.png"), order, "asset:4.png").keys,
    ["asset:1.png", "asset:2.png", "asset:3.png", "asset:4.png"]);
});

test("shift+click without an anchor on the screen marks only the tile", () => {
  assert.deepEqual(markRange({keys: [], anchor: "asset:gone.png"}, order, "asset:2.png"),
    {keys: ["asset:2.png"], anchor: "asset:2.png"});
});

test("ctrl+shift+click adds the range to the marks and keeps the anchor", () => {
  const marks = {keys: ["category:a"], anchor: "asset:2.png"};
  assert.deepEqual(addRange(marks, order, "asset:3.png"),
    {keys: ["category:a", "asset:2.png", "asset:3.png"], anchor: "asset:2.png"});
});

test("marks of tiles that left the screen are dropped", () => {
  assert.deepEqual(keepShown({keys: ["asset:1.png", "asset:9.png"], anchor: "asset:9.png"}, order),
    {keys: ["asset:1.png"], anchor: null});
});

test("a move of a marked tile moves all marks; a move of another tile moves only that tile", () => {
  const marks = {keys: ["asset:1.png", "category:a"], anchor: null};
  assert.deepEqual(getMovedKeys(marks, "asset:1.png"), ["asset:1.png", "category:a"]);
  assert.deepEqual(getMovedKeys(marks, "asset:2.png"), ["asset:2.png"]);
  assert.deepEqual(toMovedItems(["asset:1.png", "category:a", "asset:a:b.png"]),
    {paths: ["1.png", "a:b.png"], categoryIds: ["a"]});
});
