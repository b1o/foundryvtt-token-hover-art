/*
 * The page listeners that an open picker needs: a pointer press outside the picker closes it, Escape closes it, and a
 * window resize moves it. They exist only while the picker is open (FOUNDRY_MODULE_RULES.md 6.2).
 */

export class OpenPickerListeners {

  /** @type {HTMLElement} */
  #picker;

  /** @type {function(): void} */
  #onClose;

  /** @type {function(): void} */
  #onEscape;

  /** @type {function(): void} */
  #onViewportChange;

  /**
   * A press on a trigger is not "outside": the trigger toggles the picker itself, and a close here would make the
   * toggle open it again.
   * @param {PointerEvent} event
   */
  #onPointerDown = event => {
    if ( this.#picker.contains(event.target) || event.target.closest?.("[data-tha-trigger]") ) return;
    this.#onClose();
  };

  /**
   * Core handles Escape in a keydown listener on window (client/core/keyboard.js:17). Its "dismiss" action releases
   * the controlled tokens, which closes the HUD but not the picker. This listener runs first (document, capture) and
   * stops the event, so Escape acts only on the picker, wherever the focus is.
   * @param {KeyboardEvent} event
   */
  #onKeyDown = event => {
    if ( event.key !== "Escape" ) return;
    event.preventDefault();
    event.stopPropagation();
    this.#onEscape();
  };

  #onResize = () => this.#onViewportChange();

  /**
   * @param {object} options
   * @param {HTMLElement} options.picker                The picker root element.
   * @param {function(): void} options.onClose          Called for an outside press.
   * @param {function(): void} options.onEscape         Called for Escape.
   * @param {function(): void} options.onViewportChange Called when the window size changes.
   */
  constructor({picker, onClose, onEscape, onViewportChange}) {
    this.#picker = picker;
    this.#onClose = onClose;
    this.#onEscape = onEscape;
    this.#onViewportChange = onViewportChange;
  }

  /** Start to listen. A second call adds nothing: the browser ignores a listener that is already registered. */
  start() {
    document.addEventListener("pointerdown", this.#onPointerDown, {capture: true});
    document.addEventListener("keydown", this.#onKeyDown, {capture: true});
    window.addEventListener("resize", this.#onResize);
  }

  stop() {
    document.removeEventListener("pointerdown", this.#onPointerDown, {capture: true});
    document.removeEventListener("keydown", this.#onKeyDown, {capture: true});
    window.removeEventListener("resize", this.#onResize);
  }
}
