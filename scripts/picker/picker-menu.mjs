import { keepInViewport } from "../decisions/picker-placement.mjs";
import { isPointerClick } from "../keyboard-focus.mjs";

/*
 * The popup of the gallery picker: the category menu, the name field of a category, and a delete confirmation. One popup at a time, inside the picker element, so a press in it is not
 * an outside press.
 *
 * Focus: a popup that the keyboard opened takes the focus, and gives it back to its opener when it closes. A popup that
 * a pointer opened leaves the focus alone (the v11 keybinding trap, see keyboard-focus.mjs), except for a name field,
 * which needs the focus for the typing.
 */

/**
 * @typedef {object} MenuItem
 * @property {string} label
 * @property {function(): void} [onSelect]     An action. The popup closes before it runs.
 * @property {function(): MenuSpec} [next]     A next step that the popup shows instead. An item with neither only
 *                                             closes the popup.
 */

/**
 * @typedef {object} MenuSpec
 * @property {string} title                      The visible title and the accessible name.
 * @property {string} [message]
 * @property {{value: string, onSubmit: function(string): void}} [field]  A text field; Enter submits it.
 * @property {MenuItem[]} items
 */

const STATES = Object.freeze({CLOSED: "closed", OPEN: "open"});

export class PickerMenu {

  /** @type {STATES[keyof STATES]} */
  #state = STATES.CLOSED;

  /** @type {HTMLElement} */
  #element;

  /** @type {Function} */
  #template;

  /** @type {MenuSpec|null} */
  #spec = null;

  /** @type {HTMLElement|null} */
  #opener = null;

  /** Did the keyboard open the popup? */
  #isKeyboardOpen = false;

  /**
   * @param {object} options
   * @param {HTMLElement} options.container  The picker element.
   * @param {Function} options.template      The compiled picker-menu.hbs.
   */
  constructor({container, template}) {
    this.#template = template;
    const element = document.createElement("div");
    element.className = "tha-menu";
    element.hidden = true;
    element.addEventListener("click", event => this.#onClick(event));
    element.addEventListener("keydown", event => this.#onKeyDown(event));
    container.append(element);
    this.#element = element;
  }

  /** @returns {boolean} */
  isOpen() {
    return this.#state === STATES.OPEN;
  }

  /**
   * @param {Element|null} element
   * @returns {boolean}  Is the popup open, and did this element open it?
   */
  isOpenFrom(element) {
    return this.isOpen() && (element !== null) && (element === this.#opener);
  }

  /**
   * @param {HTMLElement} opener  The control that opens the popup. The popup shows below it.
   * @param {MenuSpec} spec
   * @param {MouseEvent} event    The click on the opener: a pointer click or a click from the keyboard.
   */
  open(opener, spec, event) {
    this.#opener?.setAttribute("aria-expanded", "false");
    this.#opener = opener;
    this.#isKeyboardOpen = !isPointerClick(event);
    this.#transition(STATES.OPEN, spec);
  }

  /**
   * Close the popup. After a keyboard open, the focus goes back to the opener.
   */
  close() {
    if ( this.#state === STATES.CLOSED ) return;
    const opener = this.#opener;
    const hadFocus = this.#element.contains(document.activeElement);
    this.#transition(STATES.CLOSED, null);
    if ( this.#isKeyboardOpen && hadFocus && opener.isConnected ) opener.focus();
  }

  /**
   * The only place that changes the state.
   * @param {STATES[keyof STATES]} state
   * @param {MenuSpec|null} spec
   */
  #transition(state, spec) {
    this.#state = state;
    this.#spec = spec;
    this.#opener?.setAttribute("aria-expanded", String(!!spec));
    const element = this.#element;
    element.hidden = !spec;
    if ( !spec ) {
      element.replaceChildren();
      element.removeAttribute("role");
      element.removeAttribute("aria-label");
      return;
    }
    element.innerHTML = this.#template(spec);
    element.setAttribute("role", spec.field ? "dialog" : "menu");
    element.setAttribute("aria-label", spec.title);
    this.#place();
    this.#takeFocus();
  }

  /** Below the opener, inside the viewport. */
  #place() {
    const opener = this.#opener.getBoundingClientRect();
    const {width, height} = this.#element.getBoundingClientRect();
    const viewport = {width: window.innerWidth, height: window.innerHeight};
    const {left, top} = keepInViewport({left: opener.left, top: opener.bottom + 2, width, height}, viewport);
    this.#element.style.left = `${left}px`;
    this.#element.style.top = `${top}px`;
  }

  #takeFocus() {
    const field = this.#element.querySelector(".tha-menu-field");
    if ( field ) {
      field.focus();
      field.select();
    }
    else if ( this.#isKeyboardOpen ) this.#getItems()[0]?.focus();
  }

  /**
   * @param {MouseEvent} event
   */
  #onClick(event) {
    const button = event.target.closest(".tha-menu-item");
    if ( !button ) return;
    const item = this.#spec.items[Number(button.dataset.index)];
    if ( item.next ) return this.#transition(STATES.OPEN, item.next());
    this.close();
    item.onSelect?.();
  }

  /**
   * Enter submits the field. The arrow keys move between the items. Escape is handled by the picker, which closes
   * the popup before the picker.
   * @param {KeyboardEvent} event
   */
  #onKeyDown(event) {
    if ( event.target.matches(".tha-menu-field") && (event.key === "Enter") ) {
      event.preventDefault();
      const {onSubmit} = this.#spec.field;
      const value = event.target.value;
      this.close();
      return onSubmit(value);
    }
    if ( (event.key !== "ArrowDown") && (event.key !== "ArrowUp") ) return;
    event.preventDefault();
    const items = this.#getItems();
    const index = items.indexOf(document.activeElement);
    const isDown = event.key === "ArrowDown";
    if ( index === -1 ) return items.at(isDown ? 0 : -1)?.focus();
    items[(index + (isDown ? 1 : -1) + items.length) % items.length].focus();
  }

  /** @returns {HTMLButtonElement[]}  The items, in order. */
  #getItems() {
    return [...this.#element.querySelectorAll(".tha-menu-item")];
  }
}
