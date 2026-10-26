/*
 * The template data of the gallery picker. No Foundry access: the picker collects the facts and passes them in.
 */

/**
 * @typedef {object} PickerFacts
 * @property {string} tokenName
 * @property {string[]} paths             The gallery of the token's Actor, in gallery order.
 * @property {string|null} selectedPath   The hover art of the token, or null.
 * @property {boolean} isSecret           Is the hover art of the token secret?
 * @property {boolean} isGM
 * @property {boolean} canManage          Can the user open the gallery manager?
 * @property {boolean} isMoved            Did the user drag the picker away from its default place?
 * @property {function(string): boolean} isVideo
 */

/**
 * @param {PickerFacts} facts
 * @returns {object}  The data for gallery-picker.hbs.
 */
export function buildPickerView({tokenName, paths, selectedPath, isSecret, isGM, canManage, isMoved, isVideo}) {
  return {
    tokenName,
    isGM,
    canManage,
    isMoved,
    secret: isSecret,
    hasSelection: selectedPath !== null,
    images: paths.map(path => ({
      path,
      name: getFileName(path),
      isVideo: isVideo(path),
      active: path === selectedPath
    }))
  };
}

/**
 * @param {string} path  A file path or URL.
 * @returns {string}     The last path segment, decoded, as the accessible name of an image tile.
 */
export function getFileName(path) {
  const name = path.split(/[?#]/)[0].split("/").pop() || path;
  try {
    return decodeURIComponent(name);
  } catch {
    // A "%" that is not an escape sequence makes decodeURIComponent throw. The raw name is still a usable name.
    return name;
  }
}
