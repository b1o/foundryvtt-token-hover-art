import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SHORTCUT_TYPE, createShortcutPayload, isShortcutDrop, readShortcut, isSameShortcut, joinNameParts
} from "../scripts/decisions/shortcut-payload.mjs";

const token = "Scene.a.Token.b";

test("a payload keeps only the field of its kind", () => {
  assert.deepEqual(createShortcutPayload({kind: "gallery", tokenUuid: token, categoryId: "c", path: "p.png"}),
    {type: SHORTCUT_TYPE, kind: "gallery", tokenUuid: token, categoryId: null, path: null});
  assert.deepEqual(createShortcutPayload({kind: "asset", tokenUuid: token, categoryId: "c"}),
    {type: SHORTCUT_TYPE, kind: "asset", tokenUuid: token, categoryId: null, path: null});
});

test("only a drag of this module is a shortcut drop", () => {
  assert.equal(isShortcutDrop({type: SHORTCUT_TYPE}), true);
  assert.equal(isShortcutDrop({type: "Macro", uuid: "Macro.x"}), false);
  assert.equal(isShortcutDrop(null), false);
});

test("valid shortcut data is read with only its known fields", () => {
  assert.deepEqual(readShortcut({kind: "category", tokenUuid: token, categoryId: "c", path: "x", extra: 1}),
    {kind: "category", tokenUuid: token, categoryId: "c", path: null});
  assert.deepEqual(readShortcut({kind: "asset", tokenUuid: token, path: null}),
    {kind: "asset", tokenUuid: token, categoryId: null, path: null});
});

test("invalid shortcut data is refused", () => {
  assert.equal(readShortcut(undefined), null);
  assert.equal(readShortcut({kind: "folder", tokenUuid: token}), null);
  assert.equal(readShortcut({kind: "gallery", tokenUuid: ""}), null);
  assert.equal(readShortcut({kind: "category", tokenUuid: token, categoryId: null}), null);
  assert.equal(readShortcut({kind: "asset", tokenUuid: token, path: 5}), null);
  assert.equal(readShortcut({kind: "asset", tokenUuid: token}), null);
});

test("shortcuts are the same when all fields are equal", () => {
  const asset = readShortcut({kind: "asset", tokenUuid: token, path: "a.png"});
  assert.equal(isSameShortcut(asset, {...asset}), true);
  assert.equal(isSameShortcut(asset, {...asset, path: "b.png"}), false);
  assert.equal(isSameShortcut(asset, null), false);
});

test("the name parts join as in the breadcrumb", () => {
  assert.equal(joinNameParts(["Goblin", "Moods", "Angry"]), "Goblin › Moods › Angry");
});
