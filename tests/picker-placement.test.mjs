import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getBesideTrigger, getViewportCenter, keepInViewport, clampPickerSize, DEFAULT_PICKER_SIZE, PICKER_SIZE_LIMITS
} from "../scripts/decisions/picker-placement.mjs";

const viewport = {width: 1000, height: 800};
const rect = (left, top, width, height) => ({left, top, width, height, right: left + width, bottom: top + height});

test("the default place is left of the trigger with the picker center at the given height", () => {
  assert.deepEqual(getBesideTrigger(rect(600, 200, 40, 40), 350, {width: 300, height: 200}), {left: 292, top: 250});
});

test("the default place is not clamped, so an offset keeps its meaning near an edge", () => {
  assert.deepEqual(getBesideTrigger(rect(100, 200, 40, 40), 300, {width: 300, height: 200}), {left: -208, top: 200});
});

test("the hotbar default place has its center on the viewport center", () => {
  assert.deepEqual(getViewportCenter({width: 300, height: 200}, viewport), {left: 350, top: 300});
});

test("the last step keeps a position inside the viewport, and a large picker starts at the top-left corner", () => {
  assert.deepEqual(keepInViewport(rect(-208, 750, 300, 200), viewport), {left: 0, top: 600});
  assert.deepEqual(keepInViewport(rect(400, 200, 1200, 900), viewport), {left: 0, top: 0});
});

test("a picker without a trigger keeps its position when it is inside the viewport", () => {
  assert.deepEqual(keepInViewport(rect(100.4, 50, 300, 200), viewport), {left: 100, top: 50});
});

test("a picker without a trigger moves back inside a smaller viewport", () => {
  assert.deepEqual(keepInViewport(rect(900, 700, 300, 200), viewport), {left: 700, top: 600});
});

test("a stored size is rounded and kept inside the limits", () => {
  assert.deepEqual(clampPickerSize({width: 10, height: 999.6}), {
    width: PICKER_SIZE_LIMITS.minWidth,
    height: PICKER_SIZE_LIMITS.maxHeight
  });
  assert.deepEqual(clampPickerSize({width: 300.4, height: 200.5}), {width: 300, height: 201});
});

test("an invalid stored size gives the default size", () => {
  for ( const value of [null, undefined, {}, {width: "a", height: 10}, {width: NaN, height: 10}] ) {
    assert.deepEqual(clampPickerSize(value), DEFAULT_PICKER_SIZE);
  }
});
