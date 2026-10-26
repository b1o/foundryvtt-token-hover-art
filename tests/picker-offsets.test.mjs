import { test } from "node:test";
import assert from "node:assert/strict";
import { getTokenCenterY, toOffset, fromOffset, isOffset } from "../scripts/decisions/picker-offsets.mjs";

const rect = (left, top, width, height) => ({left, top, width, height, right: left + width, bottom: top + height});

test("the token center height is the middle of the token rectangle", () => {
  assert.equal(getTokenCenterY(rect(300, 200, 100, 60)), 230);
});

test("an offset keeps the picker at the same distance from its default place", () => {
  const offset = toOffset({left: 420, top: 180}, {left: 400, top: 250});
  assert.deepEqual(offset, {x: 20, y: -70, from: "default"});
  assert.deepEqual(fromOffset(offset, {left: 100, top: 500}), {left: 120, top: 430});
});

test("only offsets from the default place with two numbers are valid", () => {
  assert.equal(isOffset({x: 0, y: -5, from: "default"}), true);
  // An offset of v0.5.0 (from the token center) has no mark, and it would put the picker at another place.
  assert.equal(isOffset({x: -473, y: -334}), false);
  for ( const value of [null, {}, {x: "1", y: 0, from: "default"}, {x: NaN, y: 0, from: "default"}] ) {
    assert.equal(isOffset(value), false);
  }
});
