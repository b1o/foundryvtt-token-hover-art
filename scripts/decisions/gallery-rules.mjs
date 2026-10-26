/*
 * Rules about galleries that need no Foundry access. The adapters in data/ collect the facts and call these.
 */

/**
 * Can a user manage the gallery of an Actor (open the gallery manager, add and remove images and folders, set
 * defaults)? GMs always can. Owners can if the world allows it. Compendium Actors have no gallery.
 * Selecting the hover art of a token is a separate right: only owners of the token can do it.
 * @param {object} facts
 * @param {boolean} facts.hasActor          Is there a world Actor?
 * @param {boolean} facts.isInCompendium
 * @param {boolean} facts.isGM
 * @param {boolean} facts.isOwner           Does the user own the Actor?
 * @param {boolean} facts.ownersMayManage   The world setting "Allow owners to manage galleries".
 * @returns {boolean}
 */
export function mayManageGallery({hasActor, isInCompendium, isGM, isOwner, ownersMayManage}) {
  if ( !hasActor || isInCompendium ) return false;
  return isGM || (isOwner && ownersMayManage);
}

/**
 * Can the user see the token name on the hover display? The display shows while the pointer is on the token, so
 * this is the core nameplate rule (Token#_canViewMode in v11) for a hovered token.
 * @param {number} displayMode        The displayName mode of the token.
 * @param {object} facts
 * @param {boolean} facts.isOwner     Does the user own the token?
 * @param {boolean} facts.isControlled
 * @param {Record<string, number>} modes  CONST.TOKEN_DISPLAY_MODES.
 * @returns {boolean}
 */
export function canSeeNameOnHover(displayMode, {isOwner, isControlled}, modes) {
  switch ( displayMode ) {
    case modes.ALWAYS:
    case modes.HOVER: return true;
    case modes.CONTROL: return isControlled;
    case modes.OWNER:
    case modes.OWNER_HOVER: return isOwner;
    default: return false;
  }
}
