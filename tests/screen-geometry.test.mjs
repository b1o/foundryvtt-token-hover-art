import { test } from "node:test";
import assert from "node:assert/strict";
import { toEdgePosition, isEdgePosition } from "../scripts/decisions/screen-geometry.mjs";

const viewport = {width: 1000, height: 800};
const rect = (left, top, width, height) => ({left, top, width, height, right: left + width, bottom: top + height});

test("an element in the top-left quarter keeps its distance to the top and left edges", () => {
  assert.deepEqual(toEdgePosition(rect(100, 80, 200, 100), viewport), {anchorX: "left", x: 0.1, anchorY: "top", y: 0.1});
});

test("an element in the bottom-right quarter keeps its distance to the bottom and right edges", () => {
  assert.deepEqual(toEdgePosition(rect(700, 600, 200, 120), viewport),
    {anchorX: "right", x: 0.1, anchorY: "bottom", y: 0.1});
});

test("an element partly outside the screen gets a distance of zero", () => {
  assert.deepEqual(toEdgePosition(rect(-50, -20, 200, 100), viewport), {anchorX: "left", x: 0, anchorY: "top", y: 0});
});

test("only complete positions with known edges are valid", () => {
  assert.equal(isEdgePosition({anchorX: "left", x: 0.1, anchorY: "bottom", y: 0.2}), true);
  for ( const value of [null, {}, {anchorX: "middle", x: 0, anchorY: "top", y: 0},
    {anchorX: "left", x: "0", anchorY: "top", y: 0}] ) {
    assert.equal(isEdgePosition(value), false);
  }
});
