import { canManageGallery } from "./data/gallery-data.mjs";

/*
 * The "Hover Art" button in the actor sheet header. It opens the gallery manager. Only users who may manage the
 * gallery see it (see canManageGallery). For an unlinked token, the manager shows the gallery of the base Actor.
 */

/**
 * Add the button to the header of Application V1 actor sheets (all sheets in v11 and v12, and the V1 sheets that
 * some systems still use in v13).
 * @param {ActorSheet} sheet
 * @param {object[]} buttons                The header buttons of the getActorSheetHeaderButtons hook.
 * @param {function(Actor): void} openManager
 */
export function addHeaderButton(sheet, buttons, openManager) {
  if ( !canManageGallery(sheet.actor, game.user) ) return;
  buttons.unshift({
    label: "TOKEN_HOVER_ART.Gallery.Button",
    class: "token-hover-art",
    icon: "fas fa-images",
    onclick: () => openManager(sheet.actor)
  });
}

/**
 * Add the button to ApplicationV2 actor sheets. Core fires this hook from v13; v12 ApplicationV2 has no header
 * controls hook, so the hook does nothing there.
 * @param {ActorSheetV2} sheet
 * @param {object[]} controls               The controls of the getHeaderControlsActorSheetV2 hook.
 * @param {function(Actor): void} openManager
 */
export function addHeaderControl(sheet, controls, openManager) {
  if ( !canManageGallery(sheet.actor, game.user) ) return;
  controls.push({
    action: "tokenHoverArtGallery",
    icon: "fas fa-images",
    label: "TOKEN_HOVER_ART.Gallery.Button",
    onClick: () => openManager(sheet.actor)
  });
}
