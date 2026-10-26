import { getPickerSize } from "../settings.mjs";
import { applyPickerSize } from "./picker-gestures.mjs";
import { PickerMenu } from "./picker-menu.mjs";

/*
 * The page elements of the gallery picker: the root in document.body, the rendered content, and the popup. The popup
 * is outside of the content, so a render does not remove the popup element. A render keeps the scroll position and
 * the keyboard focus.
 */

export class PickerShell {

  /** @type {HTMLElement} */
  #element;

  /** @type {HTMLElement} */
  #content;

  /** @type {PickerMenu} */
  #menu;

  /** @type {Function} */
  #template;

  /**
   * @param {object} options
   * @param {Function} options.template      The compiled gallery-picker.hbs.
   * @param {Function} options.menuTemplate  The compiled picker-menu.hbs.
   */
  constructor({template, menuTemplate}) {
    const element = document.createElement("section");
    element.id = "token-hover-art-picker";
    element.className = "tha-picker";
    element.setAttribute("role", "dialog");
    element.hidden = true;
    this.#content = document.createElement("div");
    element.append(this.#content);
    document.body.append(element);
    this.#element = element;
    this.#menu = new PickerMenu({container: element, template: menuTemplate});
    this.#template = template;
  }

  /** @returns {HTMLElement}  The picker root. */
  get element() {
    return this.#element;
  }

  /** @returns {HTMLElement}  The rendered content. */
  get content() {
    return this.#content;
  }

  /** @returns {PickerMenu} */
  get menu() {
    return this.#menu;
  }

  show() {
    this.#element.hidden = false;
  }

  /** Hide the picker and remove its content, so its videos stop and unload. */
  hide() {
    this.#menu.close();
    this.#element.hidden = true;
    this.#content.replaceChildren();
  }

  /**
   * Render the content. A render can remove the tile of the popup, so the popup closes first, and a keyboard user gets
   * the focus back to its opener. The focus stays in the picker, also when the focused tile went away (a move, a
   * navigation): then the first tile gets it.
   * @param {object} view    The data for gallery-picker.hbs.
   * @param {string} label   The accessible name of the picker.
   */
  render(view, label) {
    this.#menu.close();
    const element = this.#element;
    const scrollTop = this.#getGrid()?.scrollTop ?? 0;
    const hadFocus = element.contains(document.activeElement);
    const focusKey = document.activeElement?.closest("[data-tha-focus-key]")?.dataset.thaFocusKey;
    this.#content.innerHTML = this.#template(view);
    element.setAttribute("aria-label", label);
    applyPickerSize(element, getPickerSize());
    this.#getGrid().scrollTop = scrollTop;
    if ( hadFocus ) (this.#findByFocusKey(focusKey) ?? this.#content.querySelector(".tha-choice"))?.focus();
  }

  /** Show the first tiles, after a change of the shown category. */
  scrollToTop() {
    this.#getGrid().scrollTop = 0;
  }

  /**
   * Move the keyboard focus to the selected tile, so Tab and Enter start there.
   */
  focusSelection() {
    const tile = this.#content.querySelector(".tha-choice.active") ?? this.#content.querySelector(".tha-choice");
    tile?.focus({preventScroll: true});
  }

  /** @returns {HTMLElement|null} */
  #getGrid() {
    return this.#content.querySelector(".tha-picker-grid");
  }

  /**
   * @param {string|undefined} key
   * @returns {HTMLElement|null}
   */
  #findByFocusKey(key) {
    if ( key === undefined ) return null;
    return [...this.#content.querySelectorAll("[data-tha-focus-key]")].find(e => e.dataset.thaFocusKey === key) ?? null;
  }
}
