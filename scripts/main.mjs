import { TEMPLATES } from "./constants.mjs";
import { registerSettings } from "./settings.mjs";
import { addColorFields } from "./color-fields.mjs";
import { hasModuleFlagChange } from "./data/gallery-data.mjs";
import { HoverArtGallery } from "./gallery-sheet.mjs";
import { addHeaderButton, addHeaderControl } from "./sheet-header-buttons.mjs";
import { GalleryPicker } from "./picker/gallery-picker.mjs";
import { HudTrigger } from "./triggers/hud-trigger.mjs";
import { DisplayLayout } from "./hover/display-layout.mjs";
import { HoverDisplay } from "./hover/hover-display.mjs";
import { FolderSources } from "./data/folder-sources.mjs";
import { CategoryStore } from "./data/category-store.mjs";
import { findByUuid, preloadTemplates } from "./compat.mjs";

const timers = {setTimeout: (fn, ms) => window.setTimeout(fn, ms), clearTimeout: id => window.clearTimeout(id)};
const folderSources = new FolderSources();
const openManager = actor => HoverArtGallery.open(actor, folderSources);

const hoverDisplay = new HoverDisplay({layout: new DisplayLayout(), timers});

const picker = new GalleryPicker({
  resolveToken: findByUuid,
  openManager,
  onStateChange: () => hudTrigger.syncButton(),
  categoryStore: new CategoryStore()
});
const hudTrigger = new HudTrigger({picker});

Hooks.once("init", () => {
  registerSettings(() => hoverDisplay.refresh());
  preloadTemplates([TEMPLATES.GALLERY_SHEET]);
  picker.loadTemplate();
  hoverDisplay.activateMoveKey();
});

Hooks.on("renderSettingsConfig", addColorFields);

Hooks.on("getActorSheetHeaderButtons", (sheet, buttons) => addHeaderButton(sheet, buttons, openManager));
Hooks.on("getHeaderControlsActorSheetV2", (sheet, controls) => addHeaderControl(sheet, controls, openManager));

Hooks.on("renderTokenHUD", (hud, html) => hudTrigger.onRenderTokenHUD(hud, html));

/** A change of the token's art or secret state, by any user, updates the picker and the hover display. */
Hooks.on("updateToken", (tokenDoc, change) => {
  picker.onUpdateToken(tokenDoc, change);
  if ( hasModuleFlagChange(change) ) hoverDisplay.refreshToken(tokenDoc);
});
Hooks.on("updateActor", (actor, change) => picker.onUpdateActor(actor, change));
Hooks.on("updateUser", (user, change) => picker.onUpdateUser(user, change));
Hooks.on("deleteToken", tokenDoc => {
  picker.onDeleteToken(tokenDoc);
  hoverDisplay.onDeleteToken(tokenDoc);
});

Hooks.on("hoverToken", (token, hovered) => hoverDisplay.onHoverToken(token, hovered));
Hooks.on("canvasReady", () => hoverDisplay.preloadScene());
Hooks.on("canvasPan", () => picker.followTrigger());
Hooks.on("refreshToken", (token, flags) => picker.onRefreshToken(token, flags));
Hooks.on("canvasTearDown", () => {
  picker.onCanvasTearDown();
  hoverDisplay.hide();
});
