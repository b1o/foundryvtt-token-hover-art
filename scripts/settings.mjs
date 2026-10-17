import { MODULE_ID, SETTINGS, POSITIONS } from "./constants.mjs";
import { getHookElement } from "./compat.mjs";

/**
 * The color settings, with their defaults. The defaults give the original look of the display.
 * The settings are hex strings, because the v11 settings window has no color field (see addColorPickers).
 */
export const COLOR_DEFAULTS = Object.freeze({
  [SETTINGS.BACKGROUND_COLOR]: "#000000",
  [SETTINGS.BORDER_COLOR]: "#333333"
});

/** A color value in the form "#rrggbb". */
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

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

  game.settings.register(MODULE_ID, SETTINGS.BACKGROUND_OPACITY, {
    name: "TOKEN_HOVER_ART.Settings.BackgroundOpacity.Name",
    hint: "TOKEN_HOVER_ART.Settings.BackgroundOpacity.Hint",
    scope: "world",
    config: true,
    type: Number,
    range: {min: 0, max: 100, step: 5},
    default: 60,
    onChange: onDisplayChange
  });

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

  // The position that this user dragged the display to. See display-position.mjs for the format.
  game.settings.register(MODULE_ID, SETTINGS.CUSTOM_POSITION, {
    scope: "client",
    config: false,
    type: Object,
    default: null,
    onChange: onDisplayChange
  });

  // The size of the HUD palette. Each user sets it with the resize grip of the palette.
  game.settings.register(MODULE_ID, SETTINGS.PALETTE_SIZE, {
    scope: "client",
    config: false,
    type: Object,
    default: {width: 228, height: 290}
  });
}

/**
 * @param {string} key  A value of SETTINGS.
 * @returns {*}
 */
export function getSetting(key) {
  return game.settings.get(MODULE_ID, key);
}

/**
 * @param {string} key  A key of COLOR_DEFAULTS.
 * @returns {string}    The color setting, or its default if the stored text is not a "#rrggbb" color.
 */
export function getColorSetting(key) {
  const value = getSetting(key);
  return HEX_COLOR.test(value) ? value : COLOR_DEFAULTS[key];
}

/**
 * Handle the renderSettingsConfig hook. Add a color picker next to each color setting of this module.
 * The picker and the text field change each other, and the text field is the value that core saves.
 * If a core version renders the field differently and it is not found, the text field still works alone.
 * @param {Application} app
 * @param {HTMLElement|jQuery} html  jQuery in v11 and v12, HTMLElement from v13.
 */
export function addColorPickers(app, html) {
  const root = getHookElement(html);
  for ( const key of Object.keys(COLOR_DEFAULTS) ) {
    const input = root.querySelector(`input[type="text"][name="${MODULE_ID}.${key}"]`);
    if ( !input || input.nextElementSibling?.classList.contains("tha-color-picker") ) continue;
    const picker = document.createElement("input");
    picker.type = "color";
    picker.className = "tha-color-picker";
    picker.value = HEX_COLOR.test(input.value) ? input.value : COLOR_DEFAULTS[key];
    picker.addEventListener("input", () => input.value = picker.value);
    input.addEventListener("input", () => {
      if ( HEX_COLOR.test(input.value) ) picker.value = input.value;
    });
    input.after(picker);
  }
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
