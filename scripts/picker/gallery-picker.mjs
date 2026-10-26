import { TEMPLATES } from "../constants.mjs";
import { getPickerSize, setPickerSize } from "../settings.mjs";
import {
  getGallery, getSelectedArt, applyAsset, isSecret, setSecret, canManageGallery, getBaseActor, hasModuleFlagChange,
  isVideo
} from "../data/gallery-data.mjs";
import { buildPickerView } from "../decisions/picker-view.mjs";
import { getCompiledTemplate } from "../compat.mjs";
import { log, notify, reportActionError } from "../output.mjs";
import { releaseFocusAfterPointerClick } from "../keyboard-focus.mjs";
import { runPickerMove, runPickerResize, applyPickerSize } from "./picker-gestures.mjs";
import { OpenPickerListeners } from "./open-picker-listeners.mjs";
import { PickerPosition } from "./picker-position.mjs";

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
 * @property {string} tokenUuid                     The token whose hover art the picker changes.
 * @property {string|null} categoryId               The category to open, or null for the root.
 * @property {function(): (DOMRect|null)} getAnchorRect  The screen rectangle of the trigger now, or null if the
 *                                                  trigger is gone. The picker asks again when the view changes.
 * @property {"token"|"screen"} positionReference   What a dragged position is relative to (picker-offsets.mjs).
 * @property {function(): (DOMRect|null)} [getTokenRect]  For the "token" reference: the token rectangle on the
 *                                                  screen now, or null if it is not on the screen.
 * @property {"hud"} source                         Which trigger point opened the picker.
 */

const STATES = Object.freeze({CLOSED: "closed", OPEN: "open"});

export class GalleryPicker {

  /** @type {STATES[keyof STATES]} */
  #state = STATES.CLOSED;

  /** The context while the picker is open. @type {PickerContext|null} */
  #context = null;

  /** @type {HTMLElement|null} */
  #element = null;

  /** @type {OpenPickerListeners|null} */
  #listeners = null;

  /** @type {Function|null} */
  #template = null;

  /** Is a placement already scheduled for the end of the current task? */
  #isPlacementScheduled = false;

  #position = new PickerPosition();

  /** @type {function(string): (TokenDocument|null)} */
  #resolveToken;

  /** @type {function(Actor): void} */
  #openManager;

  /** @type {function(): void} */
  #onStateChange;

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
   * The picker does not take the focus: a trigger that the keyboard used calls focusSelection().
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
  }

  close() {
    if ( this.#state === STATES.CLOSED ) return;
    this.#transition(STATES.CLOSED, null);
  }

  /**
   * Move the keyboard focus to the selected tile, so Tab and Enter start there.
   */
  focusSelection() {
    if ( this.#state !== STATES.OPEN ) return;
    const tile = this.#element.querySelector(".tha-choice.active") ?? this.#element.querySelector(".tha-choice");
    tile?.focus({preventScroll: true});
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
   * Place the picker again after its trigger or its token moved on the screen: a canvas pan or zoom, a token move,
   * a HUD render. The placement runs once, in the next animation frame, because core moves the HUD after these
   * events: canvasPan comes before HUD#align (client/pixi/board.js:1234 and :1240), and the renderTokenHUD hook
   * comes before the HUD#setPosition at the end of the render (client/apps/hud/hud.js:84).
   */
  followTrigger() {
    if ( (this.#state !== STATES.OPEN) || this.#isPlacementScheduled ) return;
    this.#isPlacementScheduled = true;
    window.requestAnimationFrame(() => {
      this.#isPlacementScheduled = false;
      if ( this.#state === STATES.OPEN ) this.#place();
    });
  }

  /**
   * Handle the refreshToken hook: a picker from the HUD follows its token during a
   * move animation.
   * @param {Token} token
   * @param {object} flags  The render flags of the refresh.
   */
  onRefreshToken(token, flags) {
    if ( !flags.refreshPosition && !flags.refreshSize ) return;
    if ( this.isOpenFor(token.document.uuid) ) this.followTrigger();
  }

  /**
   * Handle the canvasTearDown hook. A picker from the Token HUD belongs to the viewed scene: its trigger and its
   * token leave with the scene. This is the only rule that depends on the source of the context.
   */
  onCanvasTearDown() {
    if ( (this.#state === STATES.OPEN) && (this.#context.source === "hud") ) this.close();
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
    if ( isOpen ) this.#listeners.start();
    else {
      this.#listeners.stop();
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
      isMoved: this.#position.isMoved(this.#context),
      isVideo
    });

    const element = this.#element;
    const scrollTop = element.querySelector(".tha-picker-grid")?.scrollTop ?? 0;
    const focusKey = element.contains(document.activeElement)
      ? document.activeElement.closest("[data-tha-focus-key]")?.dataset.thaFocusKey
      : undefined;
    element.innerHTML = this.#template(view);
    element.setAttribute("aria-label", game.i18n.format("TOKEN_HOVER_ART.Picker.Title", {name: tokenDoc.name}));
    applyPickerSize(element, getPickerSize());
    element.querySelector(".tha-picker-grid").scrollTop = scrollTop;
    if ( focusKey !== undefined ) this.#findByFocusKey(focusKey)?.focus();
  }

  #place() {
    this.#position.apply(this.#element, this.#context);
  }

  /**
   * Save the place where the user dragged the picker, for this user and the reference of the context. Render again,
   * so the reset button shows.
   * @param {DOMRect} rect  The screen rectangle of the picker.
   */
  async #saveMove(rect) {
    const context = this.#context;
    const isSaved = await this.#position.save(rect, context);
    if ( isSaved && (this.#context === context) ) this.#render();
  }

  /**
   * Forget the dragged place, and put the picker at its default place again.
   */
  async #resetPosition() {
    const context = this.#context;
    await this.#position.reset(context);
    if ( this.#context !== context ) return;
    this.#render();
    this.#place();
  }

  /**
   * Start a move (header) or a resize (grip) drag. The header buttons keep their click.
   * @param {PointerEvent} event
   */
  #onPointerDown(event) {
    if ( event.button !== 0 ) return;
    const element = this.#element;
    if ( event.target.closest(".tha-picker-resize") ) {
      return runPickerResize(event, element, {
        startSize: getPickerSize(),
        onEnd: (size, rect) => this.#onResizeEnd(size, rect)
      });
    }
    if ( event.target.closest(".tha-picker-header") && !event.target.closest("button") ) {
      runPickerMove(event, element, rect => this.#saveMove(rect).catch(reportActionError));
    }
  }

  /**
   * Save the new size. A moved picker also saves its new position, because the resize moved its left edge.
   * @param {{width: number, height: number}} size
   * @param {DOMRect} rect
   */
  async #onResizeEnd(size, rect) {
    const context = this.#context;
    try {
      await setPickerSize(size);
      if ( this.#position.isMoved(context) ) await this.#position.save(rect, context);
    } catch(err) {
      reportActionError(err);
    }
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
    element.addEventListener("pointerdown", event => this.#onPointerDown(event));
    document.body.append(element);
    this.#element = element;
    this.#listeners = new OpenPickerListeners({
      picker: element,
      onClose: () => this.close(),
      onViewportChange: () => this.#place()
    });
    return element;
  }

  /**
   * @param {MouseEvent} event
   */
  async #onClick(event) {
    const button = event.target.closest("[data-tha-action]");
    if ( !button ) return;
    releaseFocusAfterPointerClick(event, button);
    const tokenDoc = this.#resolveToken(this.#context.tokenUuid);
    if ( !tokenDoc ) return this.close();
    try {
      switch ( button.dataset.thaAction ) {
        case "select": return await applyAsset(tokenDoc, button.dataset.path);
        case "clear": return await applyAsset(tokenDoc, null);
        case "secret": return await setSecret(tokenDoc, !isSecret(tokenDoc));
        case "manage": return this.#openManager(tokenDoc.actor);
        case "reset-position": return await this.#resetPosition();
        case "close": return this.close();
      }
    } catch(err) {
      reportActionError(err);
    }
  }
}
