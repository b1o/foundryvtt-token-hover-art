import { TEMPLATES } from "../constants.mjs";
import { areHotbarShortcutsEnabled } from "../settings.mjs";
import {
  getGallery, getSelectedArt, applyAsset, isSecret, setSecret, canManageGallery, getBaseActor, hasModuleFlagChange,
  isVideo
} from "../data/gallery-data.mjs";
import { buildPickerView } from "../decisions/picker-view.mjs";
import { getCompiledTemplate } from "../compat.mjs";
import { log, notify, reportActionError } from "../output.mjs";
import { releaseFocusAfterPointerClick } from "../keyboard-focus.mjs";
import { PickerGestures } from "./picker-gestures.mjs";
import { OpenPickerListeners } from "./open-picker-listeners.mjs";
import { PickerPosition } from "./picker-position.mjs";
import { PickerShell } from "./picker-shell.mjs";
import { PickerCategories } from "./picker-categories.mjs";
import { PickerTiles } from "./picker-tiles.mjs";

/*
 * The gallery picker: the popover where a user selects the hover art of one token. A trigger point opens it with a
 * PickerContext. The picker lives in document.body, not in the Token HUD, so it works for a token that is not
 * selected and not on the viewed scene.
 *
 * There is one picker per client. A new open() re-targets it. While it is closed, it has no content, so no image
 * or video of the gallery is loaded (FOUNDRY_MODULE_RULES.md 6). Only the tiles of the shown category are in the page.
 *
 * The open state holds the context and the shown category. The categories are those of the current user.
 */

/**
 * @typedef {object} PickerContext
 * @property {string} tokenUuid                     The token whose hover art the picker changes.
 * @property {string|null} categoryId               The category to open, or null for the root.
 * @property {"trigger"|"center"} placement         The default place: next to the trigger, or the viewport center.
 * @property {function(): (DOMRect|null)} [getAnchorRect]  For "trigger": the screen rectangle of the trigger now, or
 *                                                  null if it is gone. The picker asks again when the view changes.
 * @property {"token"|"screen"} positionReference   What a dragged position is relative to (picker-offsets.mjs).
 * @property {function(): (DOMRect|null)} [getTokenRect]  For the "token" reference: the token rectangle on the
 *                                                  screen now, or null if it is not on the screen.
 * @property {"hud"|"hotbar"} source                Which trigger point opened the picker.
 */

/**
 * @typedef {import("../data/category-store.mjs").CategoryScope} CategoryScope
 */

const STATES = Object.freeze({CLOSED: "closed", OPEN: "open"});

/** The actions of a click on a tile itself. A Ctrl or Shift click on a tile marks it instead (picker-marks.mjs). */
const TILE_ACTIONS = ["select", "clear", "open-category"];

export class GalleryPicker {

  /** @type {STATES[keyof STATES]} */
  #state = STATES.CLOSED;

  /** The context while the picker is open. @type {PickerContext|null} */
  #context = null;

  /** The shown category while the picker is open, or null for the root. @type {string|null} */
  #categoryId = null;

  /** The page elements. They are created at the first open. @type {PickerShell|null} */
  #shell = null;

  /** The marks and the drag and drop. @type {PickerTiles|null} */
  #tiles = null;

  /** @type {OpenPickerListeners|null} */
  #listeners = null;

  /** @type {Function|null} */
  #template = null;

  /** @type {Function|null} */
  #menuTemplate = null;

  /** Is a placement already scheduled for the end of the current task? */
  #isPlacementScheduled = false;

  #position = new PickerPosition();

  /** @type {function(string): (TokenDocument|null)} */
  #resolveToken;

  /** @type {function(Actor): void} */
  #openManager;

  /** @type {function(): void} */
  #onStateChange;

  /** @type {PickerCategories} */
  #categories;

  /**
   * @param {object} options
   * @param {function(string): (TokenDocument|null)} options.resolveToken  Finds a token by its UUID.
   * @param {function(Actor): void} options.openManager                   Opens the gallery manager of an Actor.
   * @param {function(): void} options.onStateChange                      Called after each open, re-target, and close.
   * @param {import("../data/category-store.mjs").CategoryStore} options.categoryStore
   */
  constructor({resolveToken, openManager, onStateChange, categoryStore}) {
    this.#resolveToken = resolveToken;
    this.#openManager = openManager;
    this.#onStateChange = onStateChange;
    this.#categories = new PickerCategories({store: categoryStore});
  }

  /**
   * Load and compile the templates. Call this at init, long before the first open. Without the templates, open() only
   * logs an error, so a failed load must be in the log too.
   * @returns {Promise<void>}
   */
  async loadTemplate() {
    try {
      [this.#template, this.#menuTemplate] = await Promise.all([
        getCompiledTemplate(TEMPLATES.GALLERY_PICKER),
        getCompiledTemplate(TEMPLATES.PICKER_MENU)
      ]);
    } catch(err) {
      log.error("Cannot load the picker templates.", err);
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
    if ( !this.#template || !this.#menuTemplate ) return log.error("The picker templates are not loaded yet.");
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
    if ( this.#state === STATES.OPEN ) this.#shell.focusSelection();
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
   * Handle the updateUser hook: render again if the categories of the current user changed (also from another client
   * of the same user).
   * @param {User} user
   * @param {object} change
   */
  onUpdateUser(user, change) {
    if ( (this.#state !== STATES.OPEN) || (user !== game.user) ) return;
    if ( hasModuleFlagChange(change) ) this.#render();
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
   * An open starts at the category of the context.
   * @param {STATES[keyof STATES]} state
   * @param {PickerContext|null} context
   */
  #transition(state, context) {
    const shell = this.#getShell();
    this.#state = state;
    this.#context = context;
    this.#categoryId = context?.categoryId ?? null;
    if ( state === STATES.OPEN ) {
      shell.menu.close();
      shell.show();
      this.#listeners.start();
    }
    else {
      shell.hide();
      this.#listeners.stop();
    }
    this.#tiles.clearMarks();
    this.#onStateChange();
  }

  /**
   * Show another category. The picker height can change, so it is placed again.
   * @param {string|null} categoryId  A category, or null for the root.
   */
  #navigate(categoryId) {
    this.#categoryId = categoryId;
    this.#tiles.clearMarks();
    this.#render();
    this.#shell.scrollToTop();
    this.#place();
  }

  /**
   * Render the content for the current context. The scroll position and the focused tile stay.
   * If the token is gone or the user lost its ownership, the picker closes. If the shown category is gone, the picker
   * shows the root.
   */
  #render() {
    const tokenDoc = this.#resolveToken(this.#context.tokenUuid);
    if ( !tokenDoc?.isOwner ) return this.close();
    const actor = tokenDoc.actor;
    const scope = this.#getScope(tokenDoc);
    const categories = this.#categories.read(scope, getGallery(actor), this.#categoryId);
    this.#categoryId = categories.categoryId;
    const view = buildPickerView({
      tokenName: tokenDoc.name,
      tree: categories.tree,
      categoryId: categories.categoryId,
      ancestorIds: categories.ancestorIds,
      selectedPath: getSelectedArt(tokenDoc),
      isSecret: isSecret(tokenDoc),
      isGM: game.user.isGM,
      canManage: canManageGallery(actor, game.user),
      isMoved: this.#position.isMoved(this.#context),
      canDragToHotbar: areHotbarShortcutsEnabled(),
      isVideo
    });
    this.#shell.render(view, game.i18n.format("TOKEN_HOVER_ART.Picker.Title", {name: tokenDoc.name}));
    this.#tiles.syncMarks();
  }

  /**
   * @param {TokenDocument} tokenDoc
   * @returns {CategoryScope}  The categories of the current user for the gallery of the token.
   */
  #getScope(tokenDoc) {
    return {userId: game.user.id, actorId: getBaseActor(tokenDoc.actor)?.id ?? null};
  }

  #place() {
    this.#position.apply(this.#shell.element, this.#context);
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
   * A press outside the popup closes it. A press on the header or on the grip starts a gesture.
   * @param {PointerEvent} event
   * @param {PickerGestures} gestures
   */
  #onPointerDown(event, gestures) {
    if ( event.button !== 0 ) return;
    const menu = this.#shell.menu;
    if ( !event.target.closest(".tha-menu") && !menu.isOpenFrom(event.target.closest("[data-tha-action]")) ) menu.close();
    gestures.start(event);
  }

  /**
   * Escape closes the popup first, then removes the marks, then closes the picker.
   */
  #onEscape() {
    if ( this.#shell.menu.isOpen() ) this.#shell.menu.close();
    else if ( this.#tiles.hasMarks() ) this.#tiles.clearMarks();
    else this.close();
  }

  /**
   * @returns {PickerShell}  The page elements. They are created on first use and stay in the page.
   */
  #getShell() {
    if ( this.#shell ) return this.#shell;
    const shell = new PickerShell({template: this.#template, menuTemplate: this.#menuTemplate});
    const element = shell.element;
    const gestures = new PickerGestures({
      picker: element,
      position: this.#position,
      getContext: () => this.#context,
      onMoveSaved: () => this.#render()
    });
    element.addEventListener("click", event => this.#onClick(event));
    element.addEventListener("pointerdown", event => this.#onPointerDown(event, gestures));
    this.#shell = shell;
    this.#tiles = new PickerTiles({
      root: element,
      getContent: () => shell.content,
      categories: this.#categories,
      getTileScope: () => this.#getTileScope()
    });
    this.#listeners = new OpenPickerListeners({
      picker: element,
      onClose: () => this.close(),
      onEscape: () => this.#onEscape(),
      onViewportChange: () => this.#place()
    });
    return shell;
  }

  /**
   * @returns {import("./picker-tiles.mjs").TileScope|null}  The open picker now, or null if it is closed or its token
   *                                                        is gone.
   */
  #getTileScope() {
    const tokenDoc = (this.#state === STATES.OPEN) ? this.#resolveToken(this.#context.tokenUuid) : null;
    if ( !tokenDoc ) return null;
    return {
      tokenUuid: tokenDoc.uuid,
      scope: this.#getScope(tokenDoc),
      categoryId: this.#categoryId,
      paths: getGallery(tokenDoc.actor)
    };
  }

  /**
   * Open a popup below its opener, or close it if this opener opened it.
   * @param {HTMLElement} opener
   * @param {MouseEvent} event
   * @param {function(): (import("./picker-menu.mjs").MenuSpec|null)} buildSpec
   */
  #toggleMenu(opener, event, buildSpec) {
    const menu = this.#shell.menu;
    if ( menu.isOpenFrom(opener) ) return menu.close();
    const spec = buildSpec();
    if ( spec ) menu.open(opener, spec, event);
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
    const scope = this.#getScope(tokenDoc);
    const action = button.dataset.thaAction;
    if ( TILE_ACTIONS.includes(action) && this.#tiles.isMarkClick(event, button) ) return;
    try {
      switch ( action ) {
        case "select": return await applyAsset(tokenDoc, button.dataset.path);
        case "clear": return await applyAsset(tokenDoc, null);
        case "secret": return await setSecret(tokenDoc, !isSecret(tokenDoc));
        case "manage": return this.#openManager(tokenDoc.actor);
        case "reset-position": return await this.#resetPosition();
        case "close": return this.close();
        case "open-category":
        case "navigate": return this.#navigate(button.dataset.categoryId || null);
        case "new-category":
          return this.#toggleMenu(button, event, () => this.#categories.buildCreateField(scope, this.#categoryId));
        case "category-menu": return this.#toggleMenu(button, event, () => this.#categories.buildCategoryMenu(scope,
          getGallery(tokenDoc.actor), button.closest(".tha-tile").dataset.categoryId));
      }
    } catch(err) {
      reportActionError(err);
    }
  }
}
