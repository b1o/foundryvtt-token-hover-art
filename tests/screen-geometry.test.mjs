import { test } from "node:test";
import assert from "node:assert/strict";
import { keepInViewport, toEdgePosition, isEdgePosition } from "../scripts/decisions/screen-geometry.mjs";

const viewport = {width: 1000, height: 800};
const rect = (left, top, width, height) => ({left, top, width, height, right: left + width, bottom: top + height});

test("the viewport limit moves an element inside, and a large element starts at the top-left corner", () => {
  assert.deepEqual(keepInViewport(rect(-208, 750, 300, 200), viewport), {left: 0, top: 600});
  assert.deepEqual(keepInViewport(rect(400, 200, 1200, 900), viewport), {left: 0, top: 0});
});

test("an element inside the viewport keeps its position, rounded", () => {
  assert.deepEqual(keepInViewport(rect(100.4, 50, 300, 200), viewport), {left: 100, top: 50});
});

test("an element moves back inside a smaller viewport", () => {
  assert.deepEqual(keepInViewport(rect(900, 700, 300, 200), viewport), {left: 700, top: 600});
});

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
