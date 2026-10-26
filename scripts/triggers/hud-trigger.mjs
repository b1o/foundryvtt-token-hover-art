import { getTokenHudColumn } from "../compat.mjs";
import { log } from "../output.mjs";

/*
 * The Token HUD trigger point: a button in the left column of the HUD that opens the gallery picker for the HUD
 * token. Foundry shows the Token HUD only to GMs and to owners of the token (Token#_canHUD), and the picker checks
 * the ownership again, so the button needs no permission check.
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

    const button = document.createElement("button");
    button.type = "button";
    button.className = "control-icon tha-control";
    button.dataset.thaTrigger = "hud";
    button.dataset.tooltip = "TOKEN_HOVER_ART.Picker.Open";
    button.setAttribute("aria-label", game.i18n.localize("TOKEN_HOVER_ART.Picker.Open"));
    button.innerHTML = '<i class="fas fa-images" aria-hidden="true"></i>';
    button.addEventListener("click", () => this.#picker.toggle({
      tokenUuid: tokenDoc.uuid,
      categoryId: null,
      anchorRect: button.getBoundingClientRect(),
      source: "hud"
    }));
    column.append(button);

    this.#button = button;
    this.#tokenUuid = tokenDoc.uuid;
    this.syncButton();
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
   * A core version with a different HUD layout has no left column. Then the module adds no button, and it tells the
   * developer once, instead of failing on each render.
   */
  #reportMissingColumn() {
    if ( this.#isMissingColumnReported ) return;
    this.#isMissingColumnReported = true;
    log.warn("The Token HUD has no left column. The hover art button is not added.");
  }
}
