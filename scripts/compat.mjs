/*
 * Core APIs that moved between Foundry versions. The module supports v11 and later.
 *
 * Each getter tries the new namespaced location first and falls back to the v11/v12 global. The order matters:
 * from v13, a deprecated global logs a compatibility warning when it is read, so the global is read only when
 * the namespaced location does not exist.
 *
 * Sources: v11 and v12 from the installed client source. v13 from the official API documentation.
 */

/**
 * The Application V1 DocumentSheet. v13 moved it to foundry.appv1.api and deprecated Application V1.
 * @returns {typeof DocumentSheet}
 */
export function getDocumentSheetClass() {
  return foundry.appv1?.api?.DocumentSheet ?? DocumentSheet;
}

/**
 * The configured FilePicker class. v13 moved it to foundry.applications.apps and made it an ApplicationV2.
 * @returns {typeof FilePicker}
 */
export function getFilePickerClass() {
  return foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
}

/**
 * Load and compile a Handlebars template. v13 moved the template functions to foundry.applications.handlebars.
 * @param {string} path
 * @returns {Promise<Function>}
 */
export function getCompiledTemplate(path) {
  const fn = foundry.applications?.handlebars?.getTemplate ?? getTemplate;
  return fn(path);
}

/**
 * Load and compile several Handlebars templates.
 * @param {string[]} paths
 * @returns {Promise<Function[]>}
 */
export function preloadTemplates(paths) {
  const fn = foundry.applications?.handlebars?.loadTemplates ?? loadTemplates;
  return fn(paths);
}

/**
 * @param {string} path
 * @returns {boolean}  Is the path a video file? v13 moved VideoHelper to foundry.helpers.media.
 */
export function hasVideoExtension(path) {
  const helper = foundry.helpers?.media?.VideoHelper ?? VideoHelper;
  return helper.hasVideoExtension(path);
}

/**
 * Find a document by its UUID without a server request. v13 also offers it in foundry.utils.
 * @param {string} uuid
 * @returns {foundry.abstract.Document|null}
 */
export function findByUuid(uuid) {
  const fn = foundry.utils.fromUuidSync ?? fromUuidSync;
  return fn(uuid) ?? null;
}

/**
 * The screen rectangle of a token on the viewed canvas. It uses the same math as the core HUD container
 * (client/apps/hud/container.js:69 and hud.js:104 in v11): the global position of the primary canvas group plus the
 * token position times the stage scale. The public canvas.clientCoordinatesFromCanvas (pixi/board.js:1444) reads
 * stage.worldTransform, which is old until the next canvas render. getGlobalPosition updates the PIXI transforms first,
 * so the result does not depend on the render order. token.x and token.y follow a move animation.
 * @param {Token} token
 * @returns {{left: number, top: number, right: number, bottom: number, width: number, height: number}}
 */
export function getTokenScreenRect(token) {
  const origin = canvas.primary.getGlobalPosition();
  const scale = canvas.stage.scale.x;
  const left = origin.x + (token.x * scale);
  const top = origin.y + (token.y * scale);
  const width = token.w * scale;
  const height = token.h * scale;
  return {left, top, right: left + width, bottom: top + height, width, height};
}

/**
 * The left column of the Token HUD. The only selector into the core HUD markup (FOUNDRY_MODULE_RULES.md 8.3).
 * It is "div.col.left" in v11 (templates/hud/token-hud.html) and later versions.
 * @param {HTMLElement|jQuery} html  The element of the renderTokenHUD hook.
 * @returns {HTMLElement|null}
 */
export function getTokenHudColumn(html) {
  return getHookElement(html).querySelector(".col.left");
}

/**
 * @returns {boolean}  Is the hotbar locked? Core refuses to replace a macro in a locked hotbar (Hotbar#locked, v11).
 */
export function isHotbarLocked() {
  return ui.hotbar?.locked === true;
}

/**
 * Get the root HTML element of a render hook. Application V1 hooks pass a jQuery object;
 * ApplicationV2 hooks (the Token HUD from v13) pass an HTMLElement.
 * @param {HTMLElement|jQuery} html
 * @returns {HTMLElement}
 */
export function getHookElement(html) {
  return (html instanceof HTMLElement) ? html : html[0];
}
