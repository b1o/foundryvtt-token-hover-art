import { MODULE_ID, SETTINGS, TEMPLATES } from "./constants.mjs";
import { getSetting } from "./settings.mjs";
import {
  getBaseActor, getGallery, getSelectedArt, selectArt, clearArt, isSecret, setSecret, isVideo
} from "./hover-art-data.mjs";
import { HoverArtGallery } from "./gallery-sheet.mjs";
import { getCompiledTemplate, getHookElement } from "./compat.mjs";

/*
 * Foundry shows the Token HUD only to GMs and to owners of the token's Actor (Token#_canHUD).
 * So the palette needs no extra permission check. The server also checks each token update (BaseToken#canUpdate).
 *
 * The Token HUD is an Application V1 in v11 and v12, and an ApplicationV2 from v13. The module uses only what both
 * have: the renderTokenHUD hook, hud.object, hud.render(), and a "col left" element in the HUD markup.
 */

/**
 * The token whose palette is open. When the HUD shows another token, the palette of that token starts closed.
 * @type {Token|null}
 */
let paletteToken = null;

/**
 * The Token HUD instance, as the last renderTokenHUD hook received it. The module reads the HUD from the hook,
 * because its location on the canvas changed between core versions.
 * @type {TokenHUD|null}
 */
let tokenHUD = null;

/** Log the missing HUD column only once. */
let missingColumnReported = false;

/** The size limits of the palette in CSS pixels. */
const PALETTE_LIMITS = Object.freeze({minWidth: 160, maxWidth: 640, minHeight: 120, maxHeight: 640});

/**
 * The compiled palette template. The renderTokenHUD hook uses it synchronously: with an await, the HUD would show
 * without the control for a moment after each re-render, and the control would flicker on each selection.
 * @type {HandlebarsTemplateDelegate|null}
 */
let paletteTemplate = null;

/**
 * Load and compile the palette template. Call this at init, long before the first HUD render.
 * @returns {Promise<void>}
 */
export async function loadPaletteTemplate() {
  paletteTemplate = await getCompiledTemplate(TEMPLATES.HUD_PALETTE);
}

/**
 * Handle the renderTokenHUD hook. Add the hover art control to the left column of the HUD.
 * @param {TokenHUD} hud
 * @param {HTMLElement|jQuery} html  jQuery in v11 and v12, HTMLElement from v13.
 */
export function onRenderTokenHUD(hud, html) {
  tokenHUD = hud;
  const token = hud.object;
  const actor = getBaseActor(token?.actor);
  if ( !token || !actor || !paletteTemplate ) return;

  const column = getHookElement(html).querySelector(".col.left");
  if ( !column ) return reportMissingColumn();

  const tokenDoc = token.document;
  const selected = getSelectedArt(tokenDoc);
  const markup = paletteTemplate({
    open: paletteToken === token,
    isGM: game.user.isGM,
    secret: isSecret(tokenDoc),
    hasSelection: !!selected,
    size: getSetting(SETTINGS.PALETTE_SIZE),
    images: getGallery(actor).map(path => ({path, isVideo: isVideo(path), active: path === selected}))
  });

  const template = document.createElement("template");
  template.innerHTML = markup.trim();
  const control = template.content.firstElementChild;
  column.append(control);
  activatePaletteResize(control.querySelector(".tha-palette"));

  control.addEventListener("click", event => {
    const actionElement = event.target.closest("[data-tha-action]");
    if ( actionElement ) return onPaletteAction(token, actor, actionElement);
    if ( event.target.closest(".tha-palette") ) return;
    togglePalette(token, control);
  });
}

/**
 * Render the HUD again if it shows this token. Token#_onUpdate (checked in v11) re-renders the HUD only for position
 * and size changes, so a change of the module flags (by this user or by another user) needs an explicit render.
 * Gallery changes need no call: an Actor update already re-renders the HUD of its tokens.
 * @param {TokenDocument} tokenDoc
 */
export function refreshTokenHUD(tokenDoc) {
  if ( tokenHUD?.object?.document === tokenDoc ) tokenHUD.render();
}

/* -------------------------------------------- */

/**
 * A core version with a different HUD layout has no "col left" element. Then the module adds no control,
 * and it tells the developer once, instead of failing on each render.
 */
function reportMissingColumn() {
  if ( missingColumnReported ) return;
  missingColumnReported = true;
  console.warn(`${MODULE_ID} | The Token HUD has no ".col.left" element. The hover art control is not added.`);
}

/**
 * @param {Token} token
 * @param {HTMLElement} control
 */
function togglePalette(token, control) {
  paletteToken = (paletteToken === token) ? null : token;
  const open = paletteToken === token;
  control.classList.toggle("active", open);
  control.querySelector(".tha-palette").classList.toggle("active", open);
}

/**
 * Let the user resize the palette with the grip in its bottom-left corner. The palette opens to the left of
 * the HUD button, so its right edge stays fixed: a move to the left makes it wider. The new size is saved
 * for this user when the drag ends.
 * @param {HTMLElement} palette
 */
function activatePaletteResize(palette) {
  const grip = palette.querySelector(".tha-palette-resize");
  grip.addEventListener("pointerdown", event => {
    event.preventDefault();
    event.stopPropagation();

    // The HUD is scaled with the canvas zoom. Convert screen pixels to CSS pixels of the palette.
    const scale = (palette.getBoundingClientRect().width / palette.offsetWidth) || 1;
    const start = {x: event.clientX, y: event.clientY, ...getSetting(SETTINGS.PALETTE_SIZE)};
    let size = {width: start.width, height: start.height};

    const onMove = moveEvent => {
      size = clampPaletteSize({
        width: start.width + ((start.x - moveEvent.clientX) / scale),
        height: start.height + ((moveEvent.clientY - start.y) / scale)
      });
      palette.style.setProperty("--tha-palette-width", `${size.width}px`);
      palette.style.setProperty("--tha-palette-height", `${size.height}px`);
    };
    const onEnd = () => {
      grip.removeEventListener("pointermove", onMove);
      game.settings.set(MODULE_ID, SETTINGS.PALETTE_SIZE, size);
    };

    grip.setPointerCapture(event.pointerId);
    grip.addEventListener("pointermove", onMove);
    grip.addEventListener("lostpointercapture", onEnd, {once: true});
  });
}

/**
 * @param {{width: number, height: number}} size
 * @returns {{width: number, height: number}}  The size, rounded and inside PALETTE_LIMITS.
 */
function clampPaletteSize({width, height}) {
  const {minWidth, maxWidth, minHeight, maxHeight} = PALETTE_LIMITS;
  return {
    width: Math.round(clamp(width, minWidth, maxWidth)),
    height: Math.round(clamp(height, minHeight, maxHeight))
  };
}

/**
 * The core extension for this has a different name in each version (Math.clamped in v11, Math.clamp from v12).
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * @param {Token} token
 * @param {Actor} actor           The base Actor of the token.
 * @param {HTMLElement} element   The clicked element with a data-tha-action attribute.
 */
async function onPaletteAction(token, actor, element) {
  const tokenDoc = token.document;
  try {
    switch ( element.dataset.thaAction ) {
      case "select": return await selectArt(tokenDoc, element.dataset.path);
      case "clear": return await clearArt(tokenDoc);
      case "secret": return await setSecret(tokenDoc, !isSecret(tokenDoc));
      case "manage": return HoverArtGallery.open(actor);
    }
  } catch(err) {
    ui.notifications.error(err.message);
  }
}
