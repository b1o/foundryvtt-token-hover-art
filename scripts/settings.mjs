import { MODULE_ID, SETTINGS, POSITIONS } from "./constants.mjs";
import { isEdgePosition } from "./decisions/screen-geometry.mjs";
import { clampPickerSize, DEFAULT_PICKER_SIZE } from "./decisions/picker-placement.mjs";
import { isOffset } from "./decisions/picker-offsets.mjs";

/**
 * The color settings, with their defaults. The defaults give the original look of the display
 * (the background is black at 60% opacity: 0x99 / 0xff = 0.6).
 * The settings are hex strings, because the v11 settings window has no color field (see color-fields.mjs).
 */
export const COLOR_DEFAULTS = Object.freeze({
  [SETTINGS.BACKGROUND_COLOR]: "#00000099",
  [SETTINGS.BORDER_COLOR]: "#333333ff"
});

/** A color value in the form "#rrggbb" or "#rrggbbaa". Group 1 is the color, group 2 the optional alpha. */
export const HEX_COLOR = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i;

/**
 * Register the module settings.
 * @param {function(): void} onDisplayChange  Called when a setting that changes the visible display is changed.
 */
export function registerSettings(onDisplayChange) {
  game.settings.register(MODULE_ID, SETTINGS.POSITION, {
    name: "TOKEN_HOVER_ART.Settings.Position.Name",
    hint: "TOKEN_HOVER_ART.Settings.Position.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      [POSITIONS.TOP_LEFT]: "TOKEN_HOVER_ART.Settings.Position.TopLeft",
      [POSITIONS.TOP_RIGHT]: "TOKEN_HOVER_ART.Settings.Position.TopRight",
      [POSITIONS.BOTTOM_LEFT]: "TOKEN_HOVER_ART.Settings.Position.BottomLeft",
      [POSITIONS.BOTTOM_RIGHT]: "TOKEN_HOVER_ART.Settings.Position.BottomRight"
    },
    default: POSITIONS.TOP_RIGHT,
    onChange: onDisplayChange
  });

  game.settings.register(MODULE_ID, SETTINGS.MAX_HEIGHT, {
    name: "TOKEN_HOVER_ART.Settings.MaxHeight.Name",
    hint: "TOKEN_HOVER_ART.Settings.MaxHeight.Hint",
    scope: "world",
    config: true,
    type: Number,
    range: {min: 10, max: 90, step: 5},
    default: 40,
    onChange: onDisplayChange
  });

  registerColor(SETTINGS.BACKGROUND_COLOR, "TOKEN_HOVER_ART.Settings.BackgroundColor", onDisplayChange);

  game.settings.register(MODULE_ID, SETTINGS.SHOW_BORDER, {
    name: "TOKEN_HOVER_ART.Settings.ShowBorder.Name",
    hint: "TOKEN_HOVER_ART.Settings.ShowBorder.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: onDisplayChange
  });

  game.settings.register(MODULE_ID, SETTINGS.BORDER_WIDTH, {
    name: "TOKEN_HOVER_ART.Settings.BorderWidth.Name",
    hint: "TOKEN_HOVER_ART.Settings.BorderWidth.Hint",
    scope: "world",
    config: true,
    type: Number,
    range: {min: 1, max: 10, step: 1},
    default: 1,
    onChange: onDisplayChange
  });

  registerColor(SETTINGS.BORDER_COLOR, "TOKEN_HOVER_ART.Settings.BorderColor", onDisplayChange);

  game.settings.register(MODULE_ID, SETTINGS.HIDE_DELAY, {
    name: "TOKEN_HOVER_ART.Settings.HideDelay.Name",
    hint: "TOKEN_HOVER_ART.Settings.HideDelay.Hint",
    scope: "world",
    config: true,
    type: Number,
    range: {min: 0, max: 2000, step: 50},
    default: 250
  });

  game.settings.register(MODULE_ID, SETTINGS.DEFAULT_FILTER, {
    name: "TOKEN_HOVER_ART.Settings.DefaultFilter.Name",
    hint: "TOKEN_HOVER_ART.Settings.DefaultFilter.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "*.png"
  });

  // A change takes effect after a reload, so the header buttons, the HUD, and open gallery windows all agree.
  game.settings.register(MODULE_ID, SETTINGS.OWNERS_MANAGE_GALLERY, {
    name: "TOKEN_HOVER_ART.Settings.OwnersManageGallery.Name",
    hint: "TOKEN_HOVER_ART.Settings.OwnersManageGallery.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: true
  });

  game.settings.register(MODULE_ID, SETTINGS.SHOW_NAME, {
    name: "TOKEN_HOVER_ART.Settings.ShowName.Name",
    hint: "TOKEN_HOVER_ART.Settings.ShowName.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: onDisplayChange
  });

  game.settings.register(MODULE_ID, SETTINGS.ENABLED, {
    name: "TOKEN_HOVER_ART.Settings.Enabled.Name",
    hint: "TOKEN_HOVER_ART.Settings.Enabled.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: onDisplayChange
  });

  game.settings.register(MODULE_ID, SETTINGS.USE_CUSTOM_POSITION, {
    name: "TOKEN_HOVER_ART.Settings.UseCustomPosition.Name",
    hint: "TOKEN_HOVER_ART.Settings.UseCustomPosition.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
    onChange: onDisplayChange
  });

  // The position that this user dragged the display to: an EdgePosition (see screen-geometry.mjs).
  game.settings.register(MODULE_ID, SETTINGS.CUSTOM_POSITION, {
    scope: "client",
    config: false,
    type: Object,
    default: null,
    onChange: onDisplayChange
  });

  // The image height that this user resized the display to. See display-layout.mjs for the format.
  game.settings.register(MODULE_ID, SETTINGS.CUSTOM_SIZE, {
    scope: "client",
    config: false,
    type: Object,
    default: null,
    onChange: onDisplayChange
  });

  // The grid size of the gallery picker. Each user sets it with the resize grip of the picker.
  game.settings.register(MODULE_ID, SETTINGS.PICKER_SIZE, {
    scope: "client",
    config: false,
    type: Object,
    default: {...DEFAULT_PICKER_SIZE}
  });

  // The positions that this user dragged the gallery picker to: one slot for each reference (see
  // picker-offsets.mjs). An empty slot means the automatic placement next to the trigger.
  game.settings.register(MODULE_ID, SETTINGS.PICKER_POSITION, {
    scope: "client",
    config: false,
    type: Object,
    default: {token: null, screen: null}
  });
}

const get = key => game.settings.get(MODULE_ID, key);
const set = (key, value) => game.settings.set(MODULE_ID, key, value);

/** @returns {string}  A value of POSITIONS: the screen corner of the hover display. */
export const getDisplayCorner = () => get(SETTINGS.POSITION);

/** @returns {number}  The maximum image height of the hover display, in percent of the screen height. */
export const getMaxHeightPercent = () => get(SETTINGS.MAX_HEIGHT);

/** @returns {string}  "#rrggbb" or "#rrggbbaa". */
export const getBackgroundColor = () => getColor(SETTINGS.BACKGROUND_COLOR);

export const isBorderShown = () => get(SETTINGS.SHOW_BORDER);

/** @returns {number}  The border width in pixels. */
export const getBorderWidth = () => get(SETTINGS.BORDER_WIDTH);

/** @returns {string}  "#rrggbb" or "#rrggbbaa". */
export const getBorderColor = () => getColor(SETTINGS.BORDER_COLOR);

/** @returns {number}  The time in milliseconds between the end of a hover and the hide of the display. */
export const getHideDelayMs = () => get(SETTINGS.HIDE_DELAY);

/** @returns {string}  The file name filter of a new folder source when the user types none. */
export const getDefaultFilter = () => get(SETTINGS.DEFAULT_FILTER);

export const mayOwnersManageGallery = () => get(SETTINGS.OWNERS_MANAGE_GALLERY);

export const isTokenNameShown = () => get(SETTINGS.SHOW_NAME);

/** @returns {boolean}  Does this user want to see hover art? */
export const isHoverArtEnabled = () => get(SETTINGS.ENABLED);

/** @returns {boolean}  Does this user use the dragged position and size instead of the world defaults? */
export const isCustomLayoutUsed = () => get(SETTINGS.USE_CUSTOM_POSITION);

/**
 * @returns {import("./decisions/screen-geometry.mjs").EdgePosition|null}  The dragged position, or null if none is
 *                                                                          stored or the stored value is invalid.
 */
export function getCustomPosition() {
  const position = get(SETTINGS.CUSTOM_POSITION);
  return isEdgePosition(position) ? position : null;
}

/** @returns {{height: number}|null}  The dragged size, or null if none is stored or the stored value is invalid. */
export function getCustomSize() {
  const size = get(SETTINGS.CUSTOM_SIZE);
  return (Number.isFinite(size?.height) && (size.height > 0)) ? size : null;
}

/**
 * Save a dragged layout, and switch this user to the dragged layout. A move saves only the position; a resize
 * saves the position and the size.
 * @param {{position: import("./decisions/screen-geometry.mjs").EdgePosition, size?: {height: number}}} layout
 */
export async function saveCustomLayout({position, size}) {
  await set(SETTINGS.CUSTOM_POSITION, position);
  if ( size ) await set(SETTINGS.CUSTOM_SIZE, size);
  await set(SETTINGS.USE_CUSTOM_POSITION, true);
}

/** @returns {{width: number, height: number}}  The grid size of the gallery picker, inside the size limits. */
export const getPickerSize = () => clampPickerSize(get(SETTINGS.PICKER_SIZE));

/** @param {{width: number, height: number}} size */
export const setPickerSize = size => set(SETTINGS.PICKER_SIZE, clampPickerSize(size));

/**
 * @typedef {object} PickerOffsets
 * @property {import("./decisions/picker-offsets.mjs").PickerOffset|null} token   For a picker from the Token HUD.
 * @property {import("./decisions/picker-offsets.mjs").PickerOffset|null} screen  For every other trigger.
 */

/** @returns {PickerOffsets}  The dragged picker positions. An invalid stored slot counts as empty. */
export function getPickerOffsets() {
  const stored = get(SETTINGS.PICKER_POSITION);
  return {
    token: isOffset(stored?.token) ? stored.token : null,
    screen: isOffset(stored?.screen) ? stored.screen : null
  };
}

/**
 * Change one slot. The other slot is read right before the write, so it stays.
 * @param {keyof PickerOffsets} reference
 * @param {object|null} offset  The new offset, or null to go back to the automatic placement.
 */
export const setPickerOffset = (reference, offset) => {
  return set(SETTINGS.PICKER_POSITION, {...getPickerOffsets(), [reference]: offset});
};

/**
 * @param {string} key  A key of COLOR_DEFAULTS.
 * @returns {string}    The color setting ("#rrggbb" or "#rrggbbaa"), or its default if the stored text is invalid.
 */
function getColor(key) {
  const value = get(key);
  return HEX_COLOR.test(value) ? value : COLOR_DEFAULTS[key];
}

/**
 * Register a world color setting.
 * @param {string} key                  A key of COLOR_DEFAULTS.
 * @param {string} i18nPrefix           The localization prefix; ".Name" and ".Hint" are added.
 * @param {function(): void} onChange
 */
function registerColor(key, i18nPrefix, onChange) {
  game.settings.register(MODULE_ID, key, {
    name: `${i18nPrefix}.Name`,
    hint: `${i18nPrefix}.Hint`,
    scope: "world",
    config: true,
    type: String,
    default: COLOR_DEFAULTS[key],
    onChange
  });
}
