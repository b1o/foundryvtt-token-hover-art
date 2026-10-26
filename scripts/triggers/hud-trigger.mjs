import { getTokenHudColumn, findByUuid, getTokenScreenRect } from "../compat.mjs";
import { log } from "../output.mjs";
import { areHotbarShortcutsEnabled } from "../settings.mjs";
import { createShortcutPayload } from "../decisions/shortcut-payload.mjs";
import { isPointerClick, releaseFocusAfterPointerClick, releaseFocusOnDragStart } from "../keyboard-focus.mjs";

/*
 * The Token HUD trigger point: a button in the left column of the HUD that opens the gallery picker for the HUD
 * token. Foundry shows the Token HUD only to GMs and to owners of the token (Token#_canHUD), and the picker checks
 * the ownership again, so the button needs no permission check.
 *
 * A drag of the button to the hotbar makes a gallery shortcut (hotbar-trigger.mjs), if hotbar shortcuts are on.
 *
 * The HUD is rendered again for many reasons (a token move, a selection change). Each render creates a new button,
 * and the button state comes from the picker, so it is always correct.
 */

export class HudTrigger {

  /** @type {import("../picker/gallery-picker.mjs").GalleryPicker} */
  #picker;

  /** The button of the last HUD render. @type {HTMLButtonElement|null} */
  #button = null;

  /** The token of the last HUD render. @type {string|null} */
  #tokenUuid = null;

  /** Log the missing HUD column only once. */
  #isMissingColumnReported = false;

  /**
   * @param {object} options
   * @param {import("../picker/gallery-picker.mjs").GalleryPicker} options.picker
   */
  constructor({picker}) {
    this.#picker = picker;
  }

  /**
   * Handle the renderTokenHUD hook. Add the button to the left column of the HUD.
   * @param {TokenHUD} hud
   * @param {HTMLElement|jQuery} html  jQuery in v11 and v12, HTMLElement from v13.
   */
  onRenderTokenHUD(hud, html) {
    const tokenDoc = hud.object?.document;
    if ( !tokenDoc ) return;
    const column = getTokenHudColumn(html);
    if ( !column ) return this.#reportMissingColumn();

    const tokenUuid = tokenDoc.uuid;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "control-icon tha-control";
    button.dataset.thaTrigger = "hud";
    button.dataset.tooltip = "TOKEN_HOVER_ART.Picker.Open";
    button.setAttribute("aria-label", game.i18n.localize("TOKEN_HOVER_ART.Picker.Open"));
    button.innerHTML = '<i class="fas fa-images" aria-hidden="true"></i>';
    button.addEventListener("click", event => this.#onClick(event, tokenUuid));
    if ( areHotbarShortcutsEnabled() ) {
      button.draggable = true;
      button.addEventListener("dragstart", event => onDragStart(event, tokenUuid));
    }
    column.append(button);

    this.#button = button;
    this.#tokenUuid = tokenUuid;
    this.syncButton();

    // Core renders the HUD again after a token move. The picker of this token follows the new button position.
    if ( this.#picker.isOpenFor(tokenUuid) ) this.#picker.followTrigger();
  }

  /**
   * Show on the button whether the picker is open for the HUD token. The picker calls this after each change.
   */
  syncButton() {
    if ( !this.#button?.isConnected ) return;
    const isOpen = this.#picker.isOpenFor(this.#tokenUuid);
    this.#button.classList.toggle("active", isOpen);
    this.#button.setAttribute("aria-pressed", String(isOpen));
  }

  /**
   * Toggle the picker. After a mouse click, no element keeps the focus, so the core keys keep working. After a click
   * from the keyboard, the focus goes into the picker.
   * @param {MouseEvent} event
   * @param {string} tokenUuid
   */
  #onClick(event, tokenUuid) {
    this.#picker.toggle({
      tokenUuid,
      categoryId: null,
      trigger: "hud",
      getAnchorRect: () => this.#getButtonRect(tokenUuid),
      getTokenRect: () => this.#getTokenRect(tokenUuid)
    });
    releaseFocusAfterPointerClick(event, event.currentTarget);
    if ( !isPointerClick(event) ) this.#picker.focusSelection();
  }

  /**
   * The picker asks for the anchor again after each canvas pan, so it follows the HUD.
   * @param {string} tokenUuid
   * @returns {DOMRect|null}  The screen rectangle of the button for this token, or null if the HUD shows another
   *                          token or no token.
   */
  #getButtonRect(tokenUuid) {
    if ( (this.#tokenUuid !== tokenUuid) || !this.#button?.isConnected ) return null;
    return this.#button.getBoundingClientRect();
  }

  /**
   * @param {string} tokenUuid
   * @returns {object|null}  The screen rectangle of this token, or null if it is not on the viewed canvas.
   */
  #getTokenRect(tokenUuid) {
    const token = findByUuid(tokenUuid)?.object;
    if ( !canvas.ready || !token || token.destroyed ) return null;
    return getTokenScreenRect(token);
  }

  /**
   * A core version with a different HUD layout has no left column. Then the module adds no button, and it tells the
   * developer once, instead of failing on each render.
   */
  #reportMissingColumn() {
    if ( this.#isMissingColumnReported ) return;
    this.#isMissingColumnReported = true;
    log.warn("The Token HUD has no left column. The hover art button is not added.");
  }
}

/**
 * Start a drag of a gallery shortcut.
 * @param {DragEvent} event
 * @param {string} tokenUuid
 */
function onDragStart(event, tokenUuid) {
  event.dataTransfer.setData("text/plain", JSON.stringify(createShortcutPayload({kind: "gallery", tokenUuid})));
  event.dataTransfer.effectAllowed = "copy";
  releaseFocusOnDragStart(event.currentTarget);
}
