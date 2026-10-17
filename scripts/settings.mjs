import { MODULE_ID, SETTINGS, POSITIONS } from "./constants.mjs";

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
