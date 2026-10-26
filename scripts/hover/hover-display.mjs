import {
  getHideDelayMs, isHoverArtEnabled, isTokenNameShown, getBackgroundColor, isBorderShown, getBorderWidth, getBorderColor
} from "../settings.mjs";
import { getSelectedArt, canViewArt } from "../data/gallery-data.mjs";
import { hasVideoExtension } from "../compat.mjs";
import { canSeeNameOnHover } from "../decisions/gallery-rules.mjs";
import { log } from "../output.mjs";
import { MODULE_ID } from "../constants.mjs";

/*
 * The hover display is local to each client. Foundry fires the hoverToken hook only on the client of the user
 * who moves the mouse, and each client already has the token flags, because Foundry sends every document update
 * to all clients. So the display needs no socket messages.
 *
 * Move mode: while the user holds the move key (Ctrl by default), the display stays open, and the user can drag it to
 * a new position or resize it with its corner handles (see display-layout.mjs). Without move mode, the display would
 * hide when the pointer leaves the token on its way to the display.
 */

/** The keybinding of move mode. The user can change the key in Configure Controls. */
const MOVE_KEYBINDING = "moveDisplay";

/**
 * @typedef {object} Timers
 * @property {function(Function, number): number} setTimeout
 * @property {function(number): void} clearTimeout
 */

export class HoverDisplay {

  /** @type {import("./display-layout.mjs").DisplayLayout} */
  #layout;

  /** @type {Timers} */
  #timers;

  /** @type {HTMLElement|null} */
  #element = null;

  /** The token that the display shows now. @type {Token|null} */
  #shownToken = null;

  /** The timer that hides the display after the hide delay. @type {number|null} */
  #hideTimer = null;

  /** Is the move key held now? */
  #moveMode = false;

  /** Paths that are already preloaded. @type {Set<string>} */
  #preloaded = new Set();

  /**
   * @param {object} options
   * @param {import("./display-layout.mjs").DisplayLayout} options.layout
   * @param {Timers} options.timers
   */
  constructor({layout, timers}) {
    this.#layout = layout;
    this.#timers = timers;
  }

  /**
   * Register the move key, as core registers its "highlight" key (client/core/keybindings.js:347). Call this once, at
   * init. Core runs no keybinding while a text field has the focus, and it releases the held keys (with onUp) when a
   * form element gets the focus (client/core/keyboard.js:412). The handlers return false, so other actions of the key
   * still run.
   */
  activateMoveKey() {
    game.keybindings.register(MODULE_ID, MOVE_KEYBINDING, {
      name: "TOKEN_HOVER_ART.Keybindings.MoveDisplay.Name",
      hint: "TOKEN_HOVER_ART.Keybindings.MoveDisplay.Hint",
      editable: [{key: "ControlLeft"}, {key: "ControlRight"}],
      onDown: () => {
        this.#setMoveMode(true);
        return false;
      },
      onUp: () => {
        this.#setMoveMode(false);
        return false;
      }
    });
    // The browser sends no keyup when the window loses the focus while the key is held. Core has no blur handler: it
    // forgets its held keys only when the page is hidden, and without onUp (client/core/keyboard.js:19, :352).
    window.addEventListener("blur", () => this.#setMoveMode(false));
  }

  /**
   * Handle the hoverToken hook. The display shows at once when the pointer enters a token.
   * It hides after the hide delay when the pointer leaves, so a short exit does not make it flicker.
   * In move mode it stays open, so the user can reach it with the pointer.
   * @param {Token} token
   * @param {boolean} hovered
   */
  onHoverToken(token, hovered) {
    if ( !hovered ) {
      if ( (this.#shownToken === token) && !this.#moveMode ) this.#scheduleHide();
      return;
    }
    this.#cancelHide();
    this.#showOrHide(token);
  }

  /**
   * Apply a change of the token's art or secret state. Preload the new art, and update the display if it shows
   * this token now.
   * @param {TokenDocument} tokenDoc
   */
  refreshToken(tokenDoc) {
    this.#preloadToken(tokenDoc);
    if ( this.#shownToken?.document === tokenDoc ) this.#showOrHide(this.#shownToken);
  }

  /**
   * Handle the deleteToken hook.
   * @param {TokenDocument} tokenDoc
   */
  onDeleteToken(tokenDoc) {
    if ( this.#shownToken?.document === tokenDoc ) this.hide();
  }

  /**
   * Preload the art that this user may see for the tokens on the viewed scene, so the first hover shows the image
   * at once.
   */
  preloadScene() {
    for ( const token of canvas.tokens?.placeables ?? [] ) this.#preloadToken(token.document);
  }

  /**
   * Apply changed settings to the display that is visible now.
   */
  refresh() {
    if ( this.#shownToken ) this.#showOrHide(this.#shownToken);
  }

  /**
   * Hide the display at once.
   */
  hide() {
    this.#cancelHide();
    this.#shownToken = null;
    if ( !this.#element ) return;
    this.#element.classList.remove("visible", "moving");
    this.#element.querySelector("video")?.pause();
  }

  /**
   * Turn move mode on or off. When it turns off, the display hides after the hide delay, unless the pointer is
   * on the shown token again or a drag still runs (the drag end checks again).
   * @param {boolean} active
   */
  #setMoveMode(active) {
    if ( this.#moveMode === active ) return;
    this.#moveMode = active;
    this.#element?.classList.toggle("moving", active && !!this.#shownToken);
    if ( active ) this.#cancelHide();
    else this.#hideIfNotHovered();
  }

  /**
   * Hide the display after the hide delay if the pointer is not on the shown token and no drag runs.
   */
  #hideIfNotHovered() {
    const token = this.#shownToken;
    if ( token && !token.hover && !this.#moveMode && !this.#layout.isDragging ) this.#scheduleHide();
  }

  /**
   * Show the art of a token, or hide the display if this user may not see art for it.
   * @param {Token} token
   */
  #showOrHide(token) {
    const path = token.visible ? getViewableArt(token.document) : null;
    if ( path ) this.#show(token, path);
    else this.hide();
  }

  /**
   * Show the art of a token. A pending hide stays pending: only a new hover cancels it.
   * @param {Token} token
   * @param {string} path
   */
  #show(token, path) {
    const display = this.#getElement();
    const media = display.querySelector(".tha-media");
    if ( media.dataset.src !== path ) media.replaceChildren(this.#createMedia(path));
    media.dataset.src = path;

    const caption = display.querySelector(".tha-caption");
    const showName = isTokenNameShown() && canSeeNameOnHover(token.document.displayName, {
      isOwner: token.document.isOwner,
      isControlled: token.controlled
    }, CONST.TOKEN_DISPLAY_MODES);
    caption.textContent = showName ? token.document.name : "";
    caption.hidden = !showName;

    if ( !this.#layout.isDragging ) this.#layout.apply(display);
    applyAppearance(display);
    this.#shownToken = token;
    display.classList.add("visible");
    display.classList.toggle("moving", this.#moveMode);
    const video = display.querySelector("video");
    if ( video ) playVideo(video);
  }

  /**
   * @param {string} path
   * @returns {HTMLImageElement|HTMLVideoElement}
   */
  #createMedia(path) {
    let media;
    if ( hasVideoExtension(path) ) {
      media = document.createElement("video");
      Object.assign(media, {autoplay: true, loop: true, muted: true, playsInline: true});
    }
    else {
      media = document.createElement("img");
      media.alt = "";
    }
    media.addEventListener("error", () => this.#onMediaError(path), {once: true});
    media.src = path;
    return media;
  }

  /**
   * A selected file can be missing, for example after a folder scan removed it. Hide the display instead of
   * a broken image, and forget the element, so the next hover tries the file again.
   * @param {string} path
   */
  #onMediaError(path) {
    const media = this.#element?.querySelector(".tha-media");
    if ( media?.dataset.src !== path ) return;
    log.warn(`Cannot load the hover art "${path}".`);
    delete media.dataset.src;
    media.replaceChildren();
    this.hide();
  }

  /**
   * @returns {HTMLElement}  The display element. It is created on first use.
   */
  #getElement() {
    if ( this.#element ) return this.#element;
    const element = document.createElement("div");
    element.id = "token-hover-art-display";
    const handles = ["nw", "ne", "sw", "se"].map(c => `<div class="tha-resize-handle" data-corner="${c}"></div>`);
    element.innerHTML = `<div class="tha-media"></div><div class="tha-caption" hidden></div>${handles.join("")}`;
    document.body.append(element);
    this.#layout.makeInteractive(element, () => this.#hideIfNotHovered());
    this.#element = element;
    return element;
  }

  /**
   * Preload the art of a token, if this user may see it. A preload is a load, so it follows the same rules as the
   * display (FOUNDRY_MODULE_RULES.md 5.2).
   * @param {TokenDocument} tokenDoc
   */
  #preloadToken(tokenDoc) {
    const path = getViewableArt(tokenDoc);
    if ( !path || this.#preloaded.has(path) || hasVideoExtension(path) ) return;
    this.#preloaded.add(path);
    const img = new Image();
    img.src = path;
  }

  /**
   * Hide the display after the hide delay.
   */
  #scheduleHide() {
    this.#cancelHide();
    const delay = getHideDelayMs();
    if ( delay > 0 ) this.#hideTimer = this.#timers.setTimeout(() => this.hide(), delay);
    else this.hide();
  }

  #cancelHide() {
    if ( this.#hideTimer === null ) return;
    this.#timers.clearTimeout(this.#hideTimer);
    this.#hideTimer = null;
  }
}

/**
 * The art path that the current user may load and see for a token document, or null. The token must also be
 * visible on the canvas for the display; the caller checks that, because a preload runs before the vision is ready.
 * A GM-hidden token shows art only to its owners.
 * @param {TokenDocument} tokenDoc
 * @returns {string|null}
 */
function getViewableArt(tokenDoc) {
  if ( !isHoverArtEnabled() ) return null;
  const path = getSelectedArt(tokenDoc);
  if ( !path || !canViewArt(tokenDoc) ) return null;
  if ( tokenDoc.hidden && !tokenDoc.isOwner ) return null;
  return path;
}

/**
 * Apply the background and border settings to the display. The size is part of the layout (display-layout.mjs).
 * @param {HTMLElement} display
 */
function applyAppearance(display) {
  // The colors are "#rrggbb" or "#rrggbbaa"; CSS reads both forms, so the alpha needs no conversion.
  display.style.setProperty("--tha-display-background", getBackgroundColor());

  // Without a border, the display has no frame at all: no padding and no shadow, so only the image shows.
  const showBorder = isBorderShown();
  const border = showBorder ? `${getBorderWidth()}px solid ${getBorderColor()}` : "none";
  display.style.setProperty("--tha-display-border", border);
  display.classList.toggle("frameless", !showBorder);
}

/**
 * Start a video. A pause or a removal during the start rejects play() with an AbortError: that is the normal end of
 * a short hover, not a failure. Any other rejection goes to the log.
 * @param {HTMLVideoElement} video
 */
function playVideo(video) {
  video.play().catch(err => {
    if ( err.name !== "AbortError" ) log.warn(`Cannot play the video "${video.src}".`, err);
  });
}
