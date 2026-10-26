import { TEMPLATES } from "../constants.mjs";
import { getPickerSize, setPickerSize } from "../settings.mjs";
import {
  getGallery, getSelectedArt, applyAsset, isSecret, setSecret, canManageGallery, getBaseActor, hasModuleFlagChange,
  isVideo
} from "../data/gallery-data.mjs";
import { buildPickerView } from "../decisions/picker-view.mjs";
import { placePicker } from "../decisions/picker-placement.mjs";
import { getCompiledTemplate } from "../compat.mjs";
import { log, notify, reportActionError } from "../output.mjs";
import { runPickerResize, applyPickerSize } from "./picker-resize.mjs";

/*
 * The gallery picker: the popover where a user selects the hover art of one token. A trigger point opens it with a
 * PickerContext. The picker lives in document.body, not in the Token HUD, so it works for a token that is not
 * selected and not on the viewed scene.
 *
 * There is one picker per client. A new open() re-targets it. While it is closed, it has no content, so no image
 * or video of the gallery is loaded (FOUNDRY_MODULE_RULES.md 6).
 */

/**
 * @typedef {object} PickerContext
 * @property {string} tokenUuid           The token whose hover art the picker changes.
 * @property {string|null} categoryId     The category to open, or null for the root.
 * @property {DOMRect} anchorRect         The screen rectangle of the trigger, for the placement.
 * @property {"hud"} source               Which trigger point opened the picker.
 */

const STATES = Object.freeze({CLOSED: "closed", OPEN: "open"});

export class GalleryPicker {

  /** @type {STATES[keyof STATES]} */
  #state = STATES.CLOSED;

  /** The context while the picker is open. @type {PickerContext|null} */
  #context = null;

  /** @type {HTMLElement|null} */
  #element = null;

  /** @type {Function|null} */
  #template = null;

  /** @type {function(string): (TokenDocument|null)} */
  #resolveToken;

  /** @type {function(Actor): void} */
  #openManager;

  /** @type {function(): void} */
  #onStateChange;

  /** Close the picker on a pointer press outside of it and outside of every trigger. */
  #onOutsidePointerDown = event => {
    if ( this.#element.contains(event.target) || event.target.closest?.("[data-tha-trigger]") ) return;
    this.close();
  };

  /**
   * @param {object} options
   * @param {function(string): (TokenDocument|null)} options.resolveToken  Finds a token by its UUID.
   * @param {function(Actor): void} options.openManager                   Opens the gallery manager of an Actor.
   * @param {function(): void} options.onStateChange                      Called after each open, re-target, and close.
   */
  constructor({resolveToken, openManager, onStateChange}) {
    this.#resolveToken = resolveToken;
    this.#openManager = openManager;
    this.#onStateChange = onStateChange;
  }

  /**
   * Load and compile the template. Call this at init, long before the first open. Without the template, open() only
   * logs an error, so a failed load must be in the log too.
   * @returns {Promise<void>}
   */
  async loadTemplate() {
    try {
      this.#template = await getCompiledTemplate(TEMPLATES.GALLERY_PICKER);
    } catch(err) {
      log.error("Cannot load the picker template.", err);
    }
  }

  /**
   * @param {string} tokenUuid
   * @returns {boolean}  Does the picker show this token now?
   */
  isOpenFor(tokenUuid) {
    return (this.#state === STATES.OPEN) && (this.#context.tokenUuid === tokenUuid);
  }

  /**
   * Close the picker if it shows the token of the context. Otherwise open it for that token.
   * @param {PickerContext} context
   */
  toggle(context) {
    if ( this.isOpenFor(context.tokenUuid) ) this.close();
    else this.open(context);
  }

  /**
   * Open the picker for a context, or re-target the open picker. The user must own the token.
   * @param {PickerContext} context
   */
  open(context) {
    const tokenDoc = this.#resolveToken(context.tokenUuid);
    if ( !tokenDoc ) return notify.warn("TOKEN_HOVER_ART.Errors.TokenMissing");
    if ( !tokenDoc.isOwner ) return notify.warn("TOKEN_HOVER_ART.Errors.NotOwner");
    if ( !this.#template ) return log.error("The picker template is not loaded yet.");
    this.#transition(STATES.OPEN, context);
    this.#render();
    this.#place();
    this.#focusSelection();
  }

  close() {
    if ( this.#state === STATES.CLOSED ) return;
    this.#transition(STATES.CLOSED, null);
  }

  /**
   * Handle the updateToken hook: render again if the hover art, the secret state, or the name of the shown token
   * changed.
   * @param {TokenDocument} tokenDoc
   * @param {object} change
   */
  onUpdateToken(tokenDoc, change) {
    if ( !this.isOpenFor(tokenDoc.uuid) ) return;
    if ( hasModuleFlagChange(change) || ("name" in change) ) this.#render();
  }

  /**
   * Handle the updateActor hook: render again if the gallery or the ownership of the shown token's Actor changed.
   * @param {Actor} actor
   * @param {object} change
   */
  onUpdateActor(actor, change) {
    if ( this.#state !== STATES.OPEN ) return;
    if ( !hasModuleFlagChange(change) && !("ownership" in change) ) return;
    const tokenDoc = this.#resolveToken(this.#context.tokenUuid);
    if ( getBaseActor(tokenDoc?.actor) === actor ) this.#render();
  }

  /**
   * Handle the deleteToken hook.
   * @param {TokenDocument} tokenDoc
   */
  onDeleteToken(tokenDoc) {
    if ( this.isOpenFor(tokenDoc.uuid) ) this.close();
  }

  /**
   * The only place that changes the state. A close removes the content, so its videos stop and unload.
   * @param {STATES[keyof STATES]} state
   * @param {PickerContext|null} context
   */
  #transition(state, context) {
    const element = this.#getElement();
    this.#state = state;
    this.#context = context;
    const isOpen = state === STATES.OPEN;
    element.hidden = !isOpen;
    if ( isOpen ) document.addEventListener("pointerdown", this.#onOutsidePointerDown, {capture: true});
    else {
      document.removeEventListener("pointerdown", this.#onOutsidePointerDown, {capture: true});
      element.replaceChildren();
    }
    this.#onStateChange();
  }

  /**
   * Render the content for the current context. The scroll position and the focused tile stay.
   * If the token is gone or the user lost its ownership, the picker closes.
   */
  #render() {
    const tokenDoc = this.#resolveToken(this.#context.tokenUuid);
    if ( !tokenDoc?.isOwner ) return this.close();
    const actor = tokenDoc.actor;
    const view = buildPickerView({
      tokenName: tokenDoc.name,
      paths: getGallery(actor),
      selectedPath: getSelectedArt(tokenDoc),
      isSecret: isSecret(tokenDoc),
      isGM: game.user.isGM,
      canManage: canManageGallery(actor, game.user),
      isVideo
    });

    const element = this.#element;
    const scrollTop = element.querySelector(".tha-picker-grid")?.scrollTop ?? 0;
    const focusKey = document.activeElement?.closest?.("[data-tha-focus-key]")?.dataset.thaFocusKey;
    element.innerHTML = this.#template(view);
    element.setAttribute("aria-label", game.i18n.format("TOKEN_HOVER_ART.Picker.Title", {name: tokenDoc.name}));
    applyPickerSize(element, getPickerSize());
    element.querySelector(".tha-picker-grid").scrollTop = scrollTop;
    if ( focusKey !== undefined ) this.#findByFocusKey(focusKey)?.focus();
  }

  /**
   * Put the picker next to its trigger.
   */
  #place() {
    const element = this.#element;
    const rect = element.getBoundingClientRect();
    const viewport = {width: window.innerWidth, height: window.innerHeight};
    const {left, top} = placePicker(this.#context.anchorRect, {width: rect.width, height: rect.height}, viewport);
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
  }

  /**
   * Move the keyboard focus to the selected tile, so the arrow and Tab keys start there and Escape closes the picker.
   */
  #focusSelection() {
    const active = this.#element.querySelector(".tha-choice.active") ?? this.#element.querySelector(".tha-choice");
    active?.focus({preventScroll: true});
  }

  /**
   * @param {string} key
   * @returns {HTMLElement|null}
   */
  #findByFocusKey(key) {
    return [...this.#element.querySelectorAll("[data-tha-focus-key]")].find(e => e.dataset.thaFocusKey === key) ?? null;
  }

  /**
   * @returns {HTMLElement}  The root element. It is created on first use and stays in the page.
   */
  #getElement() {
    if ( this.#element ) return this.#element;
    const element = document.createElement("section");
    element.id = "token-hover-art-picker";
    element.className = "tha-picker";
    element.setAttribute("role", "dialog");
    element.hidden = true;
    element.addEventListener("click", event => this.#onClick(event));
    element.addEventListener("keydown", event => {
      if ( event.key !== "Escape" ) return;
      event.stopPropagation();
      this.close();
    });
    element.addEventListener("pointerdown", event => {
      if ( !event.target.closest(".tha-picker-resize") ) return;
      runPickerResize(event, element, {startSize: getPickerSize(), onEnd: size => setPickerSize(size)});
    });
    document.body.append(element);
    this.#element = element;
    return element;
  }

  /**
   * @param {MouseEvent} event
   */
  async #onClick(event) {
    const button = event.target.closest("[data-tha-action]");
    if ( !button ) return;
    const tokenDoc = this.#resolveToken(this.#context.tokenUuid);
    if ( !tokenDoc ) return this.close();
    try {
      switch ( button.dataset.thaAction ) {
        case "select": return await applyAsset(tokenDoc, button.dataset.path);
        case "clear": return await applyAsset(tokenDoc, null);
        case "secret": return await setSecret(tokenDoc, !isSecret(tokenDoc));
        case "manage": return this.#openManager(tokenDoc.actor);
        case "close": return this.close();
      }
    } catch(err) {
      reportActionError(err);
    }
  }
}
