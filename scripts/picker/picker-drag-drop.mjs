/*
 * The drag sources and the drop targets of the gallery picker (HTML5 drag and drop). A source has data-tha-drag, a
 * target has data-tha-drop and data-category-id (empty for the root).
 *
 * The drag data goes into "text/plain" as JSON, the format that the core hotbar and canvas read
 * (TextEditor.getDragEventData). The browser does not let a page read the drag data before the drop, so a target
 * decides with the drag that this picker remembered at the drag start. A drag from another page or window has no
 * remembered drag and finds no target. A drag of a marked tile moves all marked tiles (picker-marks.mjs).
 */

/**
 * @typedef {object} PickerDrag
 * @property {import("../decisions/shortcut-payload.mjs").ShortcutPayload} payload  The drag data for other targets.
 * @property {import("../decisions/category-tree.mjs").MovedItems} items  What a drop in the picker moves.
 */

export class PickerDragDrop {

  /** @type {function(HTMLElement): (PickerDrag|null)} */
  #getDrag;

  /** @type {function(PickerDrag["items"], string|null): boolean} */
  #canDrop;

  /** @type {function(PickerDrag["items"], string|null): void} */
  #onDrop;

  /** The drag that started in the picker. @type {PickerDrag|null} */
  #drag = null;

  /** The marked drop target. @type {HTMLElement|null} */
  #target = null;

  /**
   * @param {object} options
   * @param {HTMLElement} options.root  The picker element.
   * @param {function(HTMLElement): (PickerDrag|null)} options.getDrag  The drag of a source, or null if it cannot be
   *                                                                   dragged now.
   * @param {function(PickerDrag["items"], string|null): boolean} options.canDrop  Can the items go to the category
   *                                                                             (null for the root)?
   * @param {function(PickerDrag["items"], string|null): void} options.onDrop
   */
  constructor({root, getDrag, canDrop, onDrop}) {
    this.#getDrag = getDrag;
    this.#canDrop = canDrop;
    this.#onDrop = onDrop;
    root.addEventListener("dragstart", event => this.#onDragStart(event));
    root.addEventListener("dragover", event => this.#onDragOver(event));
    root.addEventListener("dragleave", event => this.#onDragLeave(event, root));
    root.addEventListener("drop", event => this.#onDropEvent(event));
    root.addEventListener("dragend", () => this.#onDragEnd());
  }

  /**
   * @param {DragEvent} event
   */
  #onDragStart(event) {
    const source = event.target.closest?.("[data-tha-drag]");
    if ( !source ) return;
    const drag = this.#getDrag(source);
    if ( !drag ) return event.preventDefault();
    this.#drag = drag;
    // The pointer press focused the tile button, and a drag ends in no click, so no click handler gives the focus back.
    // Only a pointer starts a drag, so the focus goes away here (the v11 keybinding trap, see keyboard-focus.mjs).
    if ( source.contains(document.activeElement) ) document.activeElement.blur();
    event.dataTransfer.setData("text/plain", JSON.stringify(drag.payload));
    event.dataTransfer.effectAllowed = "copyMove";
  }

  /**
   * @param {DragEvent} event
   */
  #onDragOver(event) {
    const target = this.#findTarget(event);
    this.#mark(target);
    if ( !target ) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  /**
   * @param {DragEvent} event
   * @param {HTMLElement} root
   */
  #onDragLeave(event, root) {
    if ( !root.contains(event.relatedTarget) ) this.#mark(null);
  }

  /**
   * @param {DragEvent} event
   */
  #onDropEvent(event) {
    const target = this.#findTarget(event);
    const drag = this.#drag;
    // The drop can render the picker again before dragend, and a removed source sends its dragend to no listener.
    this.#onDragEnd();
    if ( !target ) return;
    event.preventDefault();
    this.#onDrop(drag.items, getCategoryId(target));
  }

  #onDragEnd() {
    this.#drag = null;
    this.#mark(null);
  }

  /**
   * @param {DragEvent} event
   * @returns {HTMLElement|null}  The drop target under the pointer, if the dragged items can go there.
   */
  #findTarget(event) {
    const target = event.target.closest?.("[data-tha-drop]");
    if ( !target || !this.#drag ) return null;
    return this.#canDrop(this.#drag.items, getCategoryId(target)) ? target : null;
  }

  /**
   * @param {HTMLElement|null} target
   */
  #mark(target) {
    if ( target === this.#target ) return;
    this.#target?.classList.remove("tha-drop-target");
    target?.classList.add("tha-drop-target");
    this.#target = target;
  }
}

/**
 * @param {HTMLElement} target
 * @returns {string|null}
 */
function getCategoryId(target) {
  return target.dataset.categoryId || null;
}
