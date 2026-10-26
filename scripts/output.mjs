/*
 * All console and notification output of the module goes through this file, so that every line names the module
 * (FOUNDRY_MODULE_RULES.md 7.5).
 */

const PREFIX = "Token Hover Art";

export const log = Object.freeze({
  info: (message, ...details) => console.info(`${PREFIX} | ${message}`, ...details),
  warn: (message, ...details) => console.warn(`${PREFIX} | ${message}`, ...details),
  error: (message, ...details) => console.error(`${PREFIX} | ${message}`, ...details)
});

/** Notifications localize their text key, and start with the module name, because a toast shows no source. */
export const notify = Object.freeze({
  info: (key, data) => ui.notifications.info(`${PREFIX}: ${game.i18n.format(key, data)}`),
  warn: (key, data) => ui.notifications.warn(`${PREFIX}: ${game.i18n.format(key, data)}`),
  error: (key, data) => ui.notifications.error(`${PREFIX}: ${game.i18n.format(key, data)}`)
});

/**
 * Show a failed user action. The module throws expected failures with a localized message, so the message goes to
 * the user as it is. The error also goes to the console, because an unexpected failure needs its stack.
 * @param {Error} err
 */
export function reportActionError(err) {
  log.error("An action failed.", err);
  ui.notifications.error(`${PREFIX}: ${err.message}`);
}
