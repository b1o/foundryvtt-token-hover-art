import { test } from "node:test";
import assert from "node:assert/strict";
import {
  placePicker, centerPicker, keepInViewport, clampPickerSize, DEFAULT_PICKER_SIZE, PICKER_SIZE_LIMITS
} from "../scripts/decisions/picker-placement.mjs";

const viewport = {width: 1000, height: 800};
const rect = (left, top, width, height) => ({left, top, width, height, right: left + width, bottom: top + height});

test("the picker opens to the left of the trigger with its center at the given height", () => {
  assert.deepEqual(placePicker(rect(600, 200, 40, 40), 350, {width: 300, height: 200}, viewport),
    {left: 292, top: 250});
});

test("a trigger near the left edge keeps the picker inside the viewport", () => {
  assert.deepEqual(placePicker(rect(100, 200, 40, 40), 300, {width: 300, height: 200}, viewport),
    {left: 0, top: 200});
});

test("a center near the top or the bottom edge moves the picker into the viewport", () => {
  assert.deepEqual(placePicker(rect(600, 750, 40, 40), 770, {width: 300, height: 200}, viewport),
    {left: 292, top: 600});
  assert.deepEqual(placePicker(rect(600, 10, 40, 40), 30, {width: 300, height: 200}, viewport),
    {left: 292, top: 0});
});

test("a picker larger than the viewport starts at the top-left corner", () => {
  assert.deepEqual(placePicker(rect(600, 200, 40, 40), 220, {width: 1200, height: 900}, viewport),
    {left: 0, top: 0});
});

test("a centered picker has its center on the viewport center, and a large picker starts at the corner", () => {
  assert.deepEqual(centerPicker({width: 300, height: 201}, viewport), {left: 350, top: 300});
  assert.deepEqual(centerPicker({width: 1200, height: 900}, viewport), {left: 0, top: 0});
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
