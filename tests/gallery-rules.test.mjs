import { test } from "node:test";
import assert from "node:assert/strict";
import { mayManageGallery, canSeeNameOnHover } from "../scripts/decisions/gallery-rules.mjs";

const worldActor = {hasActor: true, isInCompendium: false, isGM: false, isOwner: false, ownersMayManage: true};

test("a GM can manage the gallery of every world actor", () => {
  assert.equal(mayManageGallery({...worldActor, isGM: true, ownersMayManage: false}), true);
});

test("an owner can manage the gallery only if the world allows it", () => {
  assert.equal(mayManageGallery({...worldActor, isOwner: true}), true);
  assert.equal(mayManageGallery({...worldActor, isOwner: true, ownersMayManage: false}), false);
});

test("a user who does not own the actor cannot manage its gallery", () => {
  assert.equal(mayManageGallery(worldActor), false);
});

test("a compendium actor or a missing actor has no gallery, also for a GM", () => {
  assert.equal(mayManageGallery({...worldActor, isGM: true, isInCompendium: true}), false);
  assert.equal(mayManageGallery({...worldActor, isGM: true, hasActor: false}), false);
});

const MODES = {NONE: 0, CONTROL: 10, OWNER_HOVER: 20, HOVER: 30, OWNER: 40, ALWAYS: 50};
const stranger = {isOwner: false, isControlled: false};
const owner = {isOwner: true, isControlled: false};

test("the name shows on hover with the modes that show the nameplate of a hovered token", () => {
  assert.equal(canSeeNameOnHover(MODES.ALWAYS, stranger, MODES), true);
  assert.equal(canSeeNameOnHover(MODES.HOVER, stranger, MODES), true);
  assert.equal(canSeeNameOnHover(MODES.NONE, owner, MODES), false);
});

test("the owner modes show the name only to owners", () => {
  for ( const mode of [MODES.OWNER, MODES.OWNER_HOVER] ) {
    assert.equal(canSeeNameOnHover(mode, owner, MODES), true);
    assert.equal(canSeeNameOnHover(mode, stranger, MODES), false);
  }
});

test("the control mode shows the name only for a controlled token", () => {
  assert.equal(canSeeNameOnHover(MODES.CONTROL, {...owner, isControlled: true}, MODES), true);
  assert.equal(canSeeNameOnHover(MODES.CONTROL, owner, MODES), false);
});
