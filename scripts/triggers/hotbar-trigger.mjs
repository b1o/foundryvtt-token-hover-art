import { MODULE_ID, FLAGS } from "../constants.mjs";
import { areHotbarShortcutsEnabled } from "../settings.mjs";
import { applyAsset, isVideo } from "../data/gallery-data.mjs";
import { getAncestors, isLocation } from "../decisions/category-tree.mjs";
import { isShortcutDrop, readShortcut, isSameShortcut, joinNameParts } from "../decisions/shortcut-payload.mjs";
import { getFileName } from "../decisions/picker-view.mjs";
import { findByUuid, isHotbarLocked } from "../compat.mjs";
import { notify, reportActionError } from "../output.mjs";

/*
 * The hotbar trigger point (docs/design-trigger-points.md 7). A drop of a picker tile or of the HUD button on the
 * hotbar makes a script macro, and the macro calls runShortcut when it runs.
 *
 * Core has no public way to make a macro from custom drag data: Hotbar#_createDocumentSheetToggle and
 * #_createRollTableRollMacro are protected and take Documents only. The hotbarDrop hook is the public way, the same
 * way that the dnd5e system makes its item macros (create5eMacro). Core checks the hotbar lock after the hook
 * (client/apps/hud/hotbar.js:325), so the module repeats that check.
 *
 * The command text never contains data: the shortcut is in the macro flags, and every run validates it.
 */

/** The command of every shortcut macro. A script macro runs with this set to the Macro (macro.js:118). */
const SHORTCUT_COMMAND = `game.modules.get("${MODULE_ID}").api.runShortcut(this);`;

const ICONS = Object.freeze({
  CATEGORY: `modules/${MODULE_ID}/icons/category.svg`,
  VIDEO: "icons/svg/video.svg",
  NONE: "icons/svg/cancel.svg",
  NO_TOKEN_IMAGE: "icons/svg/mystery-man.svg"
});

/**
 * @typedef {import("../decisions/shortcut-payload.mjs").Shortcut} Shortcut
 */

export class HotbarTrigger {

  /** @type {import("../picker/gallery-picker.mjs").GalleryPicker} */
  #picker;

  /** @type {import("../data/category-store.mjs").CategoryStore} */
  #categoryStore;

  /**
   * @param {object} options
   * @param {import("../picker/gallery-picker.mjs").GalleryPicker} options.picker
   * @param {import("../data/category-store.mjs").CategoryStore} options.categoryStore
   */
  constructor({picker, categoryStore}) {
    this.#picker = picker;
    this.#categoryStore = categoryStore;
  }

  /**
   * Handle the hotbarDrop hook. Core does not wait for a promise (hotbar.js:321), so a drop of this module returns
   * false at once and makes the macro after it.
   * @param {object} data   The drag data.
   * @param {number} slot   The hotbar slot of the drop.
   * @returns {false|undefined}  False for a drop of this module, so core does not handle it.
   */
  onHotbarDrop(data, slot) {
    if ( !isShortcutDrop(data) ) return;
    this.#assignShortcut(data, slot).catch(reportActionError);
    return false;
  }

  /**
   * Run a shortcut macro: open the picker, or set the hover art of an asset shortcut.
   * @param {Macro} macro  The macro that runs.
   * @returns {Promise<void>}
   */
  async runShortcut(macro) {
    if ( !areHotbarShortcutsEnabled() ) return notify.warn("TOKEN_HOVER_ART.Hotbar.Disabled");
    const shortcut = readShortcut(macro?.getFlag?.(MODULE_ID, FLAGS.SHORTCUT));
    if ( !shortcut ) return notify.warn("TOKEN_HOVER_ART.Hotbar.InvalidShortcut");
    const tokenDoc = findByUuid(shortcut.tokenUuid);
    if ( !tokenDoc ) return notify.warn("TOKEN_HOVER_ART.Hotbar.TokenMissing");
    if ( !tokenDoc.isOwner ) return notify.warn("TOKEN_HOVER_ART.Errors.NotOwner");
    if ( shortcut.kind === "asset" ) {
      try {
        await applyAsset(tokenDoc, shortcut.path);
      } catch(err) {
        reportActionError(err);
      }
      return;
    }
    this.#picker.open({
      tokenUuid: tokenDoc.uuid,
      categoryId: this.#getExistingCategory(shortcut, tokenDoc),
      // User decision 2026-10-26: a picker from the hotbar opens in the screen center, not next to the slot.
      placement: "center",
      positionReference: "screen",
      source: "hotbar"
    });
  }

  /**
   * @param {object} data
   * @param {number} slot
   * @returns {Promise<void>}
   */
  async #assignShortcut(data, slot) {
    if ( !areHotbarShortcutsEnabled() ) return notify.warn("TOKEN_HOVER_ART.Hotbar.Disabled");
    if ( !game.user.can("MACRO_SCRIPT") ) return notify.warn("TOKEN_HOVER_ART.Hotbar.NoScriptPermission");
    const shortcut = readShortcut(data);
    if ( !shortcut ) return notify.warn("TOKEN_HOVER_ART.Hotbar.InvalidShortcut");
    // The core text of the same check, with the module name in front (output.mjs).
    if ( game.macros.has(game.user.hotbar[slot]) && isHotbarLocked() ) return notify.warn("MACRO.CannotOverwrite");
    const tokenDoc = findByUuid(shortcut.tokenUuid);
    if ( !tokenDoc ) return notify.warn("TOKEN_HOVER_ART.Hotbar.TokenMissing");
    const macro = this.#findMacro(shortcut) ?? await CONFIG.Macro.documentClass.create(this.#buildMacroData(shortcut, tokenDoc));
    await game.user.assignHotbarMacro(macro, slot);
  }

  /**
   * @param {Shortcut} shortcut
   * @returns {Macro|undefined}  A shortcut macro of this user for the same shortcut. A new drop reuses it.
   */
  #findMacro(shortcut) {
    return game.macros.find(macro => macro.isAuthor
      && isSameShortcut(readShortcut(macro.getFlag(MODULE_ID, FLAGS.SHORTCUT)), shortcut));
  }

  /**
   * @param {Shortcut} shortcut
   * @param {TokenDocument} tokenDoc
   * @returns {object}  The data of a new script macro.
   */
  #buildMacroData(shortcut, tokenDoc) {
    const parts = [tokenDoc.name, ...this.#getNameDetail(shortcut, tokenDoc)];
    return {
      name: game.i18n.format("TOKEN_HOVER_ART.Hotbar.MacroName", {name: joinNameParts(parts)}),
      type: "script",
      scope: "global",
      img: getIcon(shortcut, tokenDoc),
      command: SHORTCUT_COMMAND,
      flags: {[MODULE_ID]: {[FLAGS.SHORTCUT]: shortcut}}
    };
  }

  /**
   * @param {Shortcut} shortcut
   * @param {TokenDocument} tokenDoc
   * @returns {string[]}  The category path of a category shortcut, or the file name of an asset shortcut.
   */
  #getNameDetail(shortcut, tokenDoc) {
    if ( shortcut.kind === "asset" ) {
      return [(shortcut.path === null) ? game.i18n.localize("TOKEN_HOVER_ART.Picker.None") : getFileName(shortcut.path)];
    }
    if ( shortcut.kind !== "category" ) return [];
    const map = this.#categoryStore.read(this.#categoryStore.scopeOf(tokenDoc));
    return getAncestors(map, shortcut.categoryId).map(id => map[id].name);
  }

  /**
   * @param {Shortcut} shortcut
   * @param {TokenDocument} tokenDoc
   * @returns {string|null}  The category of a category shortcut. If it no longer exists, the user gets a message, and
   *                         the picker opens at the root.
   */
  #getExistingCategory(shortcut, tokenDoc) {
    if ( shortcut.kind !== "category" ) return null;
    const map = this.#categoryStore.read(this.#categoryStore.scopeOf(tokenDoc));
    if ( isLocation(map, shortcut.categoryId) ) return shortcut.categoryId;
    notify.info("TOKEN_HOVER_ART.Hotbar.CategoryMissing");
    return null;
  }
}

/**
 * The hotbar shows the icon with an img element, so a video cannot be the icon.
 * @param {Shortcut} shortcut
 * @param {TokenDocument} tokenDoc
 * @returns {string}
 */
function getIcon(shortcut, tokenDoc) {
  switch ( shortcut.kind ) {
    case "category": return ICONS.CATEGORY;
    case "asset": return toIconImage(shortcut.path, ICONS.NONE);
    default: return toIconImage(tokenDoc.texture.src, ICONS.NO_TOKEN_IMAGE);
  }
}

/**
 * @param {string|null} path  An image or a video.
 * @param {string} fallback   The icon if there is no path.
 * @returns {string}  The path, or the video icon for a video.
 */
function toIconImage(path, fallback) {
  if ( !path ) return fallback;
  return isVideo(path) ? ICONS.VIDEO : path;
}
