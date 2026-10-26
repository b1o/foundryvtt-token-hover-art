import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SCREEN_ORIGIN, getTokenOrigin, toOffset, fromOffset, isOffset
} from "../scripts/decisions/picker-offsets.mjs";

const rect = (left, top, width, height) => ({left, top, width, height, right: left + width, bottom: top + height});

test("the token origin is the token center", () => {
  assert.deepEqual(getTokenOrigin(rect(300, 200, 100, 60)), {x: 350, y: 230});
});

test("a token offset moves the picker with the token center", () => {
  const offset = toOffset({left: 420, top: 180}, getTokenOrigin(rect(300, 200, 100, 60)));
  assert.deepEqual(offset, {x: 70, y: -50});
  assert.deepEqual(fromOffset(offset, getTokenOrigin(rect(600, 500, 100, 60))), {left: 720, top: 480});
});

test("a screen offset is the screen position", () => {
  assert.deepEqual(toOffset({left: 120, top: 80}, SCREEN_ORIGIN), {x: 120, y: 80});
  assert.deepEqual(fromOffset({x: 120, y: 80}, SCREEN_ORIGIN), {left: 120, top: 80});
});

test("only stored offsets with two numbers are valid", () => {
  assert.equal(isOffset({x: 0, y: -5}), true);
  for ( const value of [null, {}, {x: "1", y: 0}, {x: NaN, y: 0}] ) assert.equal(isOffset(value), false);
});
