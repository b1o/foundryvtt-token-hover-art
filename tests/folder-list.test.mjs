import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isSameFolder, hasFolder, replaceFolder, removeFolder, applyScanResults
} from "../scripts/decisions/folder-list.mjs";

const folder = (name, filter = "*.png", files = []) => ({source: "data", bucket: null, folder: name, filter, files});
const heroes = folder("art/heroes", "*.png", ["art/heroes/a.png"]);
const dragons = folder("art/dragons", "*.webp", ["art/dragons/b.webp"]);

test("the same folder with another filter is another entry", () => {
  assert.equal(isSameFolder(heroes, folder("art/heroes", "*.webp")), false);
  assert.equal(isSameFolder(heroes, folder("art/heroes", "*.png", ["other.png"])), true);
});

test("a duplicate check can ignore the entry that a change replaces", () => {
  assert.equal(hasFolder([heroes, dragons], heroes), true);
  assert.equal(hasFolder([heroes, dragons], heroes, heroes), false);
});

test("a filter change replaces only its entry, also after another entry was added during the scan", () => {
  const changed = folder("art/heroes", "*.webp", ["art/heroes/c.webp"]);
  const added = folder("art/new");
  assert.deepEqual(replaceFolder([heroes, dragons, added], heroes, changed), [changed, dragons, added]);
});

test("a filter change of an entry that another user removed writes nothing", () => {
  assert.equal(replaceFolder([dragons], heroes, folder("art/heroes", "*.webp")), null);
});

test("a removal keeps the entries that another user added", () => {
  const added = folder("art/new");
  assert.deepEqual(removeFolder([heroes, added, dragons], heroes), [added, dragons]);
  assert.equal(removeFolder([dragons], heroes), null);
});

test("scan results update the current list and keep an entry that was added during the scan", () => {
  const added = folder("art/new", "*.png", ["art/new/x.png"]);
  const result = applyScanResults([heroes, added, dragons], [
    {key: heroes, files: ["art/heroes/a.png", "art/heroes/d.png"]},
    {key: dragons, files: ["art/dragons/b.webp"]}
  ]);
  assert.deepEqual(result, [{...heroes, files: ["art/heroes/a.png", "art/heroes/d.png"]}, added, dragons]);
});

test("a scan result for a removed entry is dropped, and unchanged results write nothing", () => {
  assert.equal(applyScanResults([dragons], [{key: heroes, files: ["x.png"]}, {key: dragons, files: dragons.files}]),
    null);
});
