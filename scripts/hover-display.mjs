import { SETTINGS, POSITIONS } from "./constants.mjs";
import { getSetting } from "./settings.mjs";
import { getSelectedArt, canViewArt, isVideo } from "./hover-art-data.mjs";

/*
 * The hover display is local to each client. Foundry fires the hoverToken hook only on the client of the user
 * who moves the mouse, and each client already has the token flags, because Foundry sends every document update
 * to all clients. So the display needs no socket messages.
 */

/** Distance in pixels between the display and the core UI elements. */
const MARGIN = 12;

/**
 * The element ids of the core UI parts that the display must not cover. The first id is the v11/v12 id.
 * The second id is the expected v13 id; the v13 API documentation does not state these ids.
 * A part that is not found gives no offset, so the display can then overlap it, but it still works.
 */
const UI_ELEMENT_IDS = Object.freeze({
  navigation: ["navigation", "scene-navigation"],
  controls: ["controls", "scene-controls"],
  sidebar: ["sidebar"],
  players: ["players"],
  hotbar: ["hotbar"]
});

/** @type {HTMLElement|null} */
let element = null;

/** The token that the display shows now. @type {Token|null} */
let shownToken = null;

/** The timer that hides the display after the hide delay. @type {number|null} */
let hideTimer = null;

/** Paths that are already preloaded. @type {Set<string>} */
const preloaded = new Set();

/* -------------------------------------------- */

/**
 * Handle the hoverToken hook. The display shows at once when the pointer enters a token.
 * It hides after the hide delay when the pointer leaves, so a short exit does not make it flicker.
 * @param {Token} token
 * @param {boolean} hovered
 */
export function onHoverToken(token, hovered) {
  if ( !hovered ) {
    if ( shownToken === token ) scheduleHide();
    return;
  }
  cancelHide();
  const path = resolveArt(token);
  if ( path ) showDisplay(token, path);
  else hideDisplay();
}

/**
 * Apply a change of the token's art or secret state. Preload the new art, and update the display if it shows
 * this token now.
 * @param {TokenDocument} tokenDoc
 */
export function refreshTokenDisplay(tokenDoc) {
  const path = getSelectedArt(tokenDoc);
  if ( path ) preload(path);
  if ( shownToken?.document !== tokenDoc ) return;
  const shownPath = resolveArt(shownToken);
  if ( shownPath ) showDisplay(shownToken, shownPath);
  else hideDisplay();
}

/**
 * Handle the deleteToken hook.
 * @param {TokenDocument} tokenDoc
 */
export function onDeleteToken(tokenDoc) {
  if ( shownToken?.document === tokenDoc ) hideDisplay();
}

/**
 * Preload the selected art of all tokens on the viewed scene, so the first hover shows the image at once.
 */
export function preloadSceneArt() {
  for ( const token of canvas.tokens?.placeables ?? [] ) {
    const path = getSelectedArt(token.document);
    if ( path ) preload(path);
  }
}

/**
 * Apply changed settings to the display that is visible now.
 */
export function refreshDisplay() {
  if ( !shownToken ) return;
  const path = resolveArt(shownToken);
  if ( path ) showDisplay(shownToken, path);
  else hideDisplay();
}

/**
 * Hide the display at once.
 */
export function hideDisplay() {
  cancelHide();
  shownToken = null;
  if ( !element ) return;
  element.classList.remove("visible");
  element.querySelector("video")?.pause();
}

/* -------------------------------------------- */

/**
 * @param {Token} token
 * @returns {string|null}  The art path that the current user may see for this token, or null.
 */
function resolveArt(token) {
  if ( !getSetting(SETTINGS.ENABLED) ) return null;
  if ( !token?.visible ) return null;
  const tokenDoc = token.document;
  const path = getSelectedArt(tokenDoc);
  if ( !path || !canViewArt(tokenDoc) ) return null;
  return path;
}

/**
 * Show the art of a token. A pending hide stays pending: only a new hover cancels it.
 * @param {Token} token
 * @param {string} path
 */
function showDisplay(token, path) {
  const display = getElement();
  const media = display.querySelector(".tha-media");
  if ( media.dataset.src !== path ) media.replaceChildren(createMedia(path));
  media.dataset.src = path;

  const caption = display.querySelector(".tha-caption");
  const showName = getSetting(SETTINGS.SHOW_NAME) && token._canViewMode(token.document.displayName);
  caption.textContent = showName ? token.document.name : "";
  caption.hidden = !showName;

  applyLayout(display);
  shownToken = token;
  display.classList.add("visible");
  display.querySelector("video")?.play().catch(() => {});
}

/**
 * @param {string} path
 * @returns {HTMLImageElement|HTMLVideoElement}
 */
function createMedia(path) {
  let media;
  if ( isVideo(path) ) {
    media = document.createElement("video");
    Object.assign(media, {autoplay: true, loop: true, muted: true, playsInline: true});
  }
  else {
    media = document.createElement("img");
    media.alt = "";
  }
  media.addEventListener("error", () => onMediaError(path), {once: true});
  media.src = path;
  return media;
}

/**
 * A selected file can be missing, for example after a folder scan removed it. Hide the display instead of
 * a broken image, and forget the element, so the next hover tries the file again.
 * @param {string} path
 */
function onMediaError(path) {
  const media = element?.querySelector(".tha-media");
  if ( media?.dataset.src !== path ) return;
  delete media.dataset.src;
  media.replaceChildren();
  hideDisplay();
}

/**
 * Put the display in the configured corner, next to the core UI elements and not on top of them.
 * @param {HTMLElement} display
 */
function applyLayout(display) {
  const position = getSetting(SETTINGS.POSITION);
  const isTop = [POSITIONS.TOP_LEFT, POSITIONS.TOP_RIGHT].includes(position);
  const isLeft = [POSITIONS.TOP_LEFT, POSITIONS.BOTTOM_LEFT].includes(position);
  const insets = getInsets();

  display.style.top = isTop ? `${insets.top}px` : "";
  display.style.bottom = isTop ? "" : `${isLeft ? insets.bottomLeft : insets.bottomRight}px`;
  display.style.left = isLeft ? `${insets.left}px` : "";
  display.style.right = isLeft ? "" : `${insets.right}px`;
  display.style.setProperty("--tha-max-height", `${getSetting(SETTINGS.MAX_HEIGHT)}vh`);
}

/**
 * Measure the core UI elements. A hidden element has an empty rectangle, so it gives no offset.
 * A large image in a bottom corner can reach the hotbar, so both bottom corners stay above the hotbar.
 * @returns {{top: number, left: number, right: number, bottomLeft: number, bottomRight: number}}
 */
function getInsets() {
  const heightFromBottom = r => (r?.height ? window.innerHeight - r.top : 0);
  const navigation = getUIRect("navigation");
  const controls = getUIRect("controls");
  const sidebar = getUIRect("sidebar");
  const hotbar = heightFromBottom(getUIRect("hotbar"));
  return {
    top: (navigation?.height ? navigation.bottom : 0) + MARGIN,
    left: (controls?.width ? controls.right : 0) + MARGIN,
    right: (sidebar?.width ? window.innerWidth - sidebar.left : 0) + MARGIN,
    bottomLeft: Math.max(heightFromBottom(getUIRect("players")), hotbar) + MARGIN,
    bottomRight: hotbar + MARGIN
  };
}

/**
 * @param {keyof UI_ELEMENT_IDS} part
 * @returns {DOMRect|undefined}  The screen rectangle of the first element of this UI part that exists.
 */
function getUIRect(part) {
  for ( const id of UI_ELEMENT_IDS[part] ) {
    const element = document.getElementById(id);
    if ( element ) return element.getBoundingClientRect();
  }
}

/**
 * @returns {HTMLElement}  The display element. It is created on first use.
 */
function getElement() {
  if ( element ) return element;
  element = document.createElement("div");
  element.id = "token-hover-art-display";
  element.innerHTML = `<div class="tha-media"></div><div class="tha-caption" hidden></div>`;
  document.body.append(element);
  return element;
}

/**
 * @param {string} path
 */
function preload(path) {
  if ( preloaded.has(path) || isVideo(path) ) return;
  preloaded.add(path);
  const img = new Image();
  img.src = path;
}

/**
 * Hide the display after the hide delay.
 */
function scheduleHide() {
  cancelHide();
  const delay = getSetting(SETTINGS.HIDE_DELAY);
  if ( delay > 0 ) hideTimer = window.setTimeout(hideDisplay, delay);
  else hideDisplay();
}

function cancelHide() {
  if ( hideTimer === null ) return;
  window.clearTimeout(hideTimer);
  hideTimer = null;
}
