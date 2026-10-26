# Design: trigger points, categories, picker position, hotbar shortcuts

Status: draft for review. Target: v11.314 and later. Rule 1.6 of `FOUNDRY_MODULE_RULES.md` applies: this
document describes the full feature before the first commit.

## 1. Terms

| Term | Meaning |
|---|---|
| Gallery | The assets of one Actor: the manual images and the files of the folder sources. Shared by all users. |
| Asset | One gallery entry (a path), or "No hover art" (`null`). |
| Gallery picker | The window where a user selects the hover art of one token. Today it is the "palette" in the Token HUD. |
| Gallery manager | The `HoverArtGallery` window. Adds images and folder sources. Not part of this work. |
| Category | A user-defined group of assets in the picker. It is not a Foundry folder and not a folder source. |
| Trigger point | An entry point that builds a picker context and opens the picker, or runs an action. It has no gallery logic. |
| Picker context | The data that a trigger point gives to the picker (section 3). |
| Shortcut | A Macro on the hotbar that a trigger point created. |

## 2. Decisions (agreed 2026-10-26)

1. A shortcut saves the token (TokenDocument UUID), not the Actor.
2. Categories can contain categories, with no fixed depth limit. The tree is small (tens, not thousands).
3. ~~GM override: the GM can view and edit the categories of any user.~~ Removed by the user on 2026-10-26: each
   user sees and edits only their own categories.
4. Categories belong to one Actor gallery and one user.
5. An asset is in at most one category of a user (folder behavior).
6. Shortcuts are Macro documents. The module settings explain the macro permission that players need.
7. Categories exist only in the picker.

## 3. Trigger point contract

```js
/**
 * @typedef {object} PickerContext
 * @property {string} tokenUuid                        The token whose hover art the picker changes.
 * @property {string|null} categoryId                  The category to open, or null for the root.
 * @property {"trigger"|"center"} placement           The default place: next to the trigger, or the viewport center.
 * @property {function(): (DOMRect|null)} [getAnchorRect]  For "trigger": the trigger rectangle now.
 * @property {"token"|"screen"} positionReference      What a pinned position is relative to (section 5.2).
 * @property {function(): (Rect|null)} [getTokenRect]  For "token": the token rectangle on the screen now.
 * @property {"hud"|"hotbar"} source                   Which trigger point opened the picker.
 */
```

- A trigger point calls `picker.open(context)` and does nothing else.
- The trigger point decides the position reference: the Token HUD uses "token", every other trigger uses "screen".
- `source` is read in one place only: a picker from the HUD closes on a scene change.
- An asset shortcut does not open the picker. It calls `applyAsset(tokenDoc, path)`, the same function that the
  picker uses for a click on an asset. So both paths have one owner (rule 3.1).

Trigger points in this work:

| Trigger point | Opens |
|---|---|
| Token HUD button (exists) | Picker for the HUD token, root category. |
| Hotbar gallery shortcut | Picker for the saved token, root category. |
| Hotbar category shortcut | Picker for the saved token, saved category. |
| Hotbar asset shortcut | No UI. Sets the saved asset on the saved token. |

## 4. Gallery picker as a standalone popover

Today the picker is markup inside the Token HUD, so it exists only while the HUD shows a token. A hotbar shortcut
must open it for a token that is not selected or not on the viewed scene. So the picker moves out of the HUD.

- **Implementation:** a plain DOM popover owned by a `GalleryPicker` class, rendered from a compiled Handlebars
  template. It does not use Application V1, so a later move to v13 does not touch it (rule 8.4).
- **One picker per client.** A new `open(context)` re-targets the open picker. A click on the HUD button for the
  token that the picker shows now closes the picker (toggle, as today).
- **States** (rule 1.5): `closed` and `open`. `open` holds the context and the current category id. One method,
  `#transition`, changes the state.
- **Close:** the close button, Escape (also when the focus is not in the picker), a pointer press outside the
  picker, the deletion of the token, and a scene change for a picker that the HUD opened. Closing pauses and
  removes all video elements (rule 6.2).
  - Every user action that moves the HUD to another token, or closes it, starts with a press on the canvas: a
    left-click selects a token, a right-click opens its HUD, a click on empty canvas releases the tokens. That
    press closes the picker too. So a picker from the HUD closes together with the HUD, and the HUD button never
    re-targets an open picker. Only trigger points without a canvas press (hotbar, phase D) re-target it.
- **Follow the trigger:** a picker from the HUD stays next to the HUD button when the canvas pans or zooms (mouse
  wheel, keyboard pan) and when the window size changes, as the old HUD palette did.
- **Keyboard focus** (v11 fact: `KeyboardManager#hasFocus` is true while any element has focus, and then no core
  keybinding runs; `client/core/keyboard.js:124` and `:312`):
  - A mouse click on the HUD button or on a picker button does not leave the focus on the button, so the core keys
    (pan, Delete, pause) keep working.
  - An open with the keyboard (Enter or Space on the HUD button) moves the focus to the selected tile.
  - Escape is caught before core while the picker is open. Without that, core would release the token and close
    the HUD, and the picker would stay open.
- **Live update:** the picker renders again on `updateToken` (selection or secret of its token), `updateActor`
  (gallery change), and `updateUser` (category change of the user whose categories it shows).
- **Missing token:** if `fromUuidSync(tokenUuid)` returns nothing, the picker does not open and the user gets a
  notification with a next step (rule 7.2).
- **Permission:** the picker opens only if the current user owns the token (`tokenDoc.isOwner`). The server also
  checks each update.
- **Accessibility:** assets, categories, and header actions are `<button type="button">` with localized names.
  A category tile has a menu button with "Rename" and "Delete". Decision (user, 2026-10-26): a move and a hotbar
  shortcut are drag and drop only, with no keyboard path for now (temporary exception in rule 9.3). All other
  actions stay keyboard reachable: create, rename, delete, open a category, and the breadcrumb. The marks
  (multi-select) exist only for a drag, so they have no keyboard path either.
- **Videos:** only the tiles of the current category are in the DOM. Their videos play while the picker is open
  and stop when it closes or changes category.
- **Size:** the existing resize grip and the `paletteSize` client setting stay. The grip moves to the corner that
  is opposite to the anchor (section 5).

### Picker layout

```
┌ Hover art: <token name> ──────────────── [eye] [gear] [x] ┐
│ Root › Moods › Angry                         [+ category] │   breadcrumb: each part is a drop target
│ [▢ Calm] [▢ Happy]                                        │   sub-categories of the current category
│ [∅ none] [img] [img] [img] [img]                          │   assets of the current category
└───────────────────────────────────────────────────────◢──┘
```

"No hover art" shows at the root only.

## 5. Picker position

### 5.1 Default placement

`placePicker(anchor, centerY, size, viewport)` in `picker-placement.mjs` puts the picker to the left of the trigger
and keeps it inside the viewport. Decision (2026-10-26): its vertical center is on the token center for a picker
from the Token HUD. The picker follows the trigger and the token on each canvas pan, token move, and window resize
(section 4). Decision (user, 2026-10-26): a picker from the hotbar has no trigger place; `centerPicker` puts it in
the center of the viewport. The trigger point chooses with `placement` ("trigger" or "center", section 3).

Decision (2026-10-26): no token avoidance and no candidate sides. The user tested the clamped placement, and a
picker that covers the token is not a problem.

| Source | Anchor |
|---|---|
| HUD | The HUD button rectangle. |
| Hotbar (also a macro run from the directory) | None. Decision (user, 2026-10-26): the picker opens in the center of the viewport (`placement: "center"`). |

### 5.2 Header drag and saved position

Decision (2026-10-26): the picker header is the drag handle, as in a window. No modifier key.

- A drag on the header (not on its buttons) moves the picker. A move below 4 pixels is a click and changes nothing.
- Decision (2026-10-26): a dragged position is a plain translation in screen pixels from a reference point to the
  picker top-left corner, with no further math: position = point + offset (`decisions/picker-offsets.mjs`). The
  trigger point names the reference:

  | Reference | Used by | Point |
  |---|---|---|
  | `token` | Token HUD | The token center on the screen (`compat.getTokenScreenRect`, the same math as the core HUD) |
  | `screen` | Every other trigger | The viewport top-left corner: the offset is the screen position |

  The offsets are screen pixels, not canvas units: the distance to the token center stays the same at every zoom.
- One slot for each reference, in the client setting `pickerPosition`: `{token, screen}`. One shared value would
  move a picker from the hotbar to a place that the user chose relative to a token. A drag saves only the slot of the
  current reference, and the other slot is read right before the write (rule 4.1). The token slot is one value for
  all tokens of the user.
- An empty slot means the default placement (5.1).
- A picker from the HUD follows its token: canvas pan and zoom, token move animation (`refreshToken`), and the HUD
  render after a move. The placement runs once, in the next animation frame, because core moves the HUD after these
  events.
- A resize of a moved picker saves the new offset too, because the resize moves its left edge.
- The saved position is clamped into the viewport each time it is applied, not only at the drag (rule 3.2).
- The move cursor on the header is the only sign of the drag. No tooltip (rule 9.4).
- A reset button (pin icon) shows in the header only while the slot of the current reference is set, as a pressed
  toggle. A click clears that slot only, and the picker goes back to its default place.
- The drag loop (pointer capture and the 4-pixel threshold) is shared with the hover display (`pointer-drag.mjs`,
  rule 3.3).
- Keyboard: no keyboard move. A keyboard user gets the automatic placement and the reset button. Core windows
  also have no keyboard move in v11.

### 5.3 Not in scope

No settings for the origin and the grow direction. 5.1 and 5.2 cover that need (rule 10.3).

## 6. Categories

### 6.1 Storage

On the User document of the category owner:

```
flags.token-hover-art.categories.<baseActorId>.<categoryId> = {
  name: string,
  parentId: string|null,   // null: at the root
  sort: number,
  paths: string[]          // the assets in this category
}
```

- A flat map with `parentId` is the storage. The tree is built from it on read. A flat map allows narrow updates
  of one category (rule 4.1), and a move cannot create two copies of a subtree.
- `categoryId` comes from `foundry.utils.randomID()`. Asset paths contain dots, so paths are values, never keys.
- Every user can update their own User document (`common/documents/user.mjs:205`).
- Every client receives these flags (rule 4.3). Category names are not secret.

### 6.2 Rules (pure functions in `category-tree.mjs`)

| Function | Rule |
|---|---|
| `buildTree(map, galleryPaths)` | Builds the tree. Drops a category whose parent is missing to the root. Breaks a cycle at the first repeated id. Removes paths that are not in the gallery. Keeps the first category for a path that is in two categories. |
| `getAncestors(map, id)` | The breadcrumb, root first. |
| `getDescendantIds(map, id)` | All ids below a category (recursive). |
| `planMoveAsset(map, path, targetId)` | The narrow update: remove the path from its old category, add it to the target (or to none for the root). |
| `planMoveCategory(map, id, targetParentId)` | Refused if the target is the category or one of its descendants. |
| `planDeleteCategory(map, id)` | Deletes the category and its descendants. Their assets go back to the root of the gallery (an asset is never deleted by a category action). |
| `planMoveItems(map, {paths, categoryIds}, targetId)` | Several moves in one patch (multi-select, 6.4). Refused if the target is a moved category or below one. |

`buildTree` runs on every read, so invalid stored data never reaches the UI (rules 3.2 and 7.4).

### 6.3 Writes

One class, `CategoryStore`, owns all writes (rule 4.2). It reads the current map right before each write and
writes only the changed category keys, with `-=` keys for deletions. It serializes its own writes in a queue.

### 6.4 Picker interaction

- **Create:** the "+ category" button creates a category in the current category, with an inline name field.
- **Rename and delete:** in the menu of a category tile. Delete asks for a confirmation if the category has
  content. Asset tiles have no menu.
- **Open:** a click on a category tile. The breadcrumb goes back.
- **Drag and drop** (HTML5 drag and drop, one payload format for the picker and the hotbar, section 7.2):

| Drag | Drop on | Result |
|---|---|---|
| Asset | Category tile | Asset moves into the category. |
| Asset | Breadcrumb part | Asset moves into that category, or to the root. |
| Category | Category tile | Category moves into it (cycle refused). |
| Category | Breadcrumb part | Category moves there. |
| Asset, category, HUD button | Hotbar slot | Creates a shortcut (section 7). |

- **Order:** categories sort by `sort`, then by name. Assets keep the gallery order.
- **Multi-select** (user request, 2026-10-26; no box selection). The code calls a multi-selected tile "marked",
  because "selection" already means the hover art of a token.
  - A plain click keeps its function (an asset sets the hover art, a category opens) and clears the marks.
  - Ctrl+click (Cmd+click on macOS) marks a tile or removes its mark. Shift+click marks the range from the anchor
    (the tile of the last plain click or Ctrl+click) to the clicked tile, and replaces the marks. Ctrl+Shift+click
    adds the range. Only a pointer click marks: a click from the keyboard (for example Shift+Enter) is a plain
    click. After a pointer click no element keeps the focus (section 4), so Ctrl+arrow keys pan the canvas, as in
    core.
  - Asset tiles and category tiles can be marked together. "No hover art" cannot be marked, and a Ctrl or Shift
    click on it does nothing.
  - Only tiles of the shown category can be marked. A navigation and a close
    clear the marks. Escape clears them before it closes the picker (popup, then marks, then picker).
  - A drag of a marked tile moves all marked tiles. A drag of a tile that is not marked moves only that tile.
    Rename and delete stay single.
  - A move of several tiles is one write (`planMoveItems`). A target that is a moved category, or that is below
    one, is refused for the full move. A tile that is already at the target is skipped.
  - A hotbar drop (phase D) uses only the dragged tile.

### 6.5 GM override (removed)

Removed by the user on 2026-10-26. The picker always shows the categories of the current user, also for a GM.

## 7. Hotbar trigger point

### 7.1 Facts (v11 source)

- A hotbar slot holds only a Macro (`client/data/documents/user.js:68`, `assignHotbarMacro`).
- `Hotbar#_onDrop` calls the `hotbarDrop` hook first. A handler that returns `false` stops the default drop
  (`client/apps/hud/hotbar.js:321`). The hook does not wait for a promise, so the handler returns `false` at once
  and starts the async work.
- The core lock check runs after the hook (`hotbar.js:325`). The module repeats it: if the slot has a macro and
  `ui.hotbar.locked` is true, it shows the core warning and stops.
- A script macro runs with `this` set to the Macro (`client/data/documents/macro.js:118`).
- A script macro runs only for a user with "Use Script Macros" (`MACRO_SCRIPT`, default role Player;
  `client/data/documents/macro.js:31`).
- Players can create Macros (`permissions.create: "PLAYER"`), but not Folders (default `ASSISTANT`,
  `common/abstract/document.mjs:114`). So player shortcuts are loose in the Macro directory.

### 7.2 Drag payload

```js
{
  type: "token-hover-art.Shortcut",
  kind: "gallery" | "category" | "asset",
  tokenUuid: string,
  categoryId: string | null,  // kind "category"
  path: string | null         // kind "asset"; null means "No hover art"
}
```

Drag sources: the HUD button (kind `gallery`), a category tile, and an asset tile (including "No hover art").
Decision (user, 2026-10-26): the picker header is not a drag source; it stays the move handle of phase B.

### 7.3 Shortcut macro

- `type: "script"`, `command: 'game.modules.get("token-hover-art").api.runShortcut(this);'`.
- The shortcut data goes into `flags.token-hover-art.shortcut` (the payload without `type`). The command text never
  contains data, so no data is ever run as code.
- Name: `Hover art: <token>`, `Hover art: <token> › <category path>`, or `Hover art: <token> › <file name>`.
- Image (the hotbar shows it with `<img>`, so a video cannot show):
  - gallery: the token image, or `icons/svg/video.svg` for a video token image;
  - category: `modules/token-hover-art/icons/category.svg` (v11 has no folder icon in `icons/svg`);
  - asset: the image itself, `icons/svg/video.svg` for a video, `icons/svg/cancel.svg` for "No hover art".
- Reuse: if the user already has a module macro with the same shortcut flags, the drop reuses it.
- A shortcut is made only by a drag (rule 9.3, temporary exception). There is no "Add to hotbar" menu entry.

### 7.4 `runShortcut(macro)`

0. Setting "Hotbar shortcuts" off: notification, stop.
1. Validate the flags (rule 7.4). Invalid data: notification, stop.
2. Resolve the token with `fromUuidSync`. Missing: "The token of this shortcut no longer exists. Drag a new
   shortcut from the hover art picker." Stop.
3. Check `tokenDoc.isOwner`. Not owner: notification, stop.
4. By kind:
   - `gallery`: `picker.open({tokenUuid, categoryId: null, placement: "center", positionReference: "screen",
     source: "hotbar"})`. The picker opens in the viewport center (5.1).
   - `category`: the same, with `categoryId`. If the category no longer exists, open the root and tell the user.
   - `asset`: `applyAsset(tokenDoc, path)`. The path must still be in the gallery, or be `null`. If not:
     notification, no change (rule 3.2).

The token can be on a scene that the user does not view. The update still works, because every scene and its
tokens exist on each client.

### 7.5 Setting

New world setting "Hotbar shortcuts" (Boolean, default on). Its hint: "Players can drag the picker, a category, or
an asset to the hotbar. A shortcut is a script macro, so players need the core permission 'Use Script Macros'."
When it is off, the drag sources that exist only for the hotbar (the HUD button and "No hover art") are not
draggable, a drop on the hotbar gives a notification, and `runShortcut` tells the user that the GM turned shortcuts
off. Category and asset tiles stay draggable, because a drag also moves them between categories (6.4). A drop by a
user without `MACRO_SCRIPT` gives a notification that names the permission.

## 8. Foundation work (before the features)

The new features change these files, so these fixes come first:

| Finding | Rule | Fix |
|---|---|---|
| Module-level state in `token-hud.mjs`, `hover-display.mjs`, `display-layout.mjs`. | 1.4 | Move into class instances that `main.mjs` creates. |
| `display-layout.mjs` exports `isDragging()` for `hover-display.mjs`. | 1.4 | The layout instance is injected. |
| Generic `getSetting(SETTINGS.X)`. | 10.1 | One typed accessor per setting. |
| Direct `console.*` and `ui.notifications` calls. | 7.5 | New `output.mjs`. |
| `.play().catch(() => {})`, rescan error only in `console.warn`. | 7.1 | Errors go to the user or the log with a prefix. |
| `token._canViewMode` (private API). | 8.1 | Public check, or a documented reason. |
| Palette markup: clickable `div` and `a`, autoplay videos. | 6, 9 | Replaced by the new picker (section 4). |
| No ESLint config. | 13 | Add the flat config. |

## 9. Files

Status after phase D: all files exist.

```
scripts/
  main.mjs                     composition root (creates and connects, no logic)
  constants.mjs
  settings.mjs                 registration and typed accessors
  output.mjs                   prefixed log and notifications
  compat.mjs                   version differences; the Token HUD column; findByUuid; the hotbar lock
  sheet-header-buttons.mjs     the "Hover Art" button in actor sheet headers (opens the gallery manager)
  keyboard-focus.mjs           give the focus back after a pointer click (v11 keybinding trap)
  pointer-drag.mjs             one pointer drag with a click threshold (hover display and picker)
  gallery-sheet.mjs            the gallery manager
  color-fields.mjs
  data/
    gallery-data.mjs           gallery, selection (applyAsset is the only writer), secret, defaults
    folder-sources.mjs         class FolderSources: folder scans, writes one after the other
    category-store.mjs         User flag reads and serialized writes of the categories
  decisions/                   pure, no Foundry or DOM globals (ESLint enforces this)
    gallery-rules.mjs          who may manage a gallery; token name visibility on hover
    folder-list.mjs            changes to the folder list, applied to the list as it is at the write
    picker-placement.mjs       picker size limits, placement next to the trigger, clamp into the viewport
    picker-offsets.mjs         dragged position: translation from the token center or the screen origin
    picker-view.mjs            template data of the picker
    screen-geometry.mjs        edges, fractions, clamp (shared by the hover display and the picker)
    category-tree.mjs          tree rules (6.2)
    tile-marks.mjs             multi-select: marks, ranges, the items of a move (6.4)
    shortcut-payload.mjs       the drag payload, its validation, and the parts of a macro name
  picker/
    gallery-picker.mjs         state, open, close, render, actions
    picker-gestures.mjs        header move and grip resize
    picker-position.mjs        class PickerPosition: dragged or default placement, save and reset per reference
    open-picker-listeners.mjs  page listeners while open: outside press, Escape, window resize
    picker-shell.mjs           the page elements: root, rendered content (keeps scroll and focus), popup
    picker-menu.mjs            class PickerMenu: the popup (menu, choice list, name field, confirmation)
    picker-menus.mjs           the content of each popup: category menu, name field, user choice
    picker-categories.mjs      category reads and writes for the picker (through CategoryStore)
    picker-tiles.mjs           marks and drag and drop together (a drag of a marked tile moves all marks)
    picker-marks.mjs           class PickerMarks: the marked tiles and their look
    picker-drag-drop.mjs       drag sources and drop targets in the picker
  triggers/
    hud-trigger.mjs            the HUD button only
    hotbar-trigger.mjs         hotbarDrop, runShortcut, macro reuse
  hover/
    hover-display.mjs          the hover display (class HoverDisplay)
    display-layout.mjs         its position and size (class DisplayLayout)
templates/
  gallery-picker.hbs           replaces hud-palette.hbs
  picker-menu.hbs              the popup of the picker
icons/
  category.svg                 the icon of a category shortcut (v11 has no folder icon in icons/svg)
  gallery-sheet.hbs
tests/                         node:test unit tests for decisions/
```

## 10. Open points

None. Decision 5 (folder behavior) was confirmed on 2026-10-26.

## 11. Phases and test plan

| Phase | Content | Manual test (port 30011) |
|---|---|---|
| A | Foundation (section 8), standalone picker with the HUD trigger | The user flows in 11.1. |
| B | Header drag and pinned position | The user flows in 11.2. |
| C | Categories | Create nested, move assets and categories by drag and by menu, cycle refused, delete subtree, folder rescan removes a file, GM edits a player's tree. |
| D | Hotbar | Drag each kind; locked hotbar; token deleted; token on another scene; player without `MACRO_SCRIPT`; setting off. |

Pure modules (`decisions/`) get unit tests that run without Foundry (rule 2).

### 11.1 Phase A user flows

Run each flow with real input: right-click and left-click on tokens and on the canvas, the mouse wheel, and keys.
Do not open the HUD from a script. A script bind skips the canvas press, and the canvas press is what closes the
picker in real use.

| # | User action | Expected result |
|---|---|---|
| A1 | Right-click a token, then click the hover art button in the HUD. | The picker opens next to the button, inside the screen. The button shows as active. |
| A2 | Click an image tile, then "No hover art". | The token flag changes each time, and the active tile follows. The picker stays open. |
| A3 | After A2, press W (or an arrow key). | The canvas pans: the click did not leave the focus on a button. |
| A4 | GM: click the eye button twice. | The secret flag turns on, then off. |
| A5 | Click the HUD button again. | The picker closes; the HUD stays; the button is not active. |
| A6 | Open the picker, then press Escape. | Only the picker closes. The token stays selected and the HUD stays open. |
| A7 | Open the picker, then turn the mouse wheel over the canvas. | The picker moves with the HUD button and stays inside the screen. |
| A8 | Open the picker, then left-click another token. | The picker and the HUD close; the other token is selected. |
| A9 | Open the picker, then right-click another token. | The picker closes; the HUD opens for the other token, with its button not active. |
| A10 | Open the picker, then click empty canvas. | The picker and the HUD close. |
| A11 | Open the picker, then click the chat or the sidebar. | The picker closes. |
| A12 | Open the picker, then click the gear button. | The gallery manager opens; the picker stays open until the next click outside. |
| A13 | Open the picker, then a second user changes the art or the gallery. | The open picker shows the change. |
| A14 | Open the picker, then delete the token (other client or Delete key after a click on the canvas). | The picker closes. |
| A15 | Open the picker, then switch the scene. | The picker closes. |
| A16 | Open the picker, then resize the browser window. | The picker stays next to the button, inside the screen. |
| A17 | Drag the resize grip. | The grid grows to the left and down; the right edge stays. After a reload the size stays. |
| A18 | Keyboard: focus the HUD button, press Enter, then Tab, Enter, and Escape. | The picker opens with the focus on the selected tile; Enter selects; Escape closes. |
| A19 | Hover tokens while the picker is open and closed. | The hover display shows and hides as before. |
| A20 | Player who owns a token: A1, A2, A6. | Same results; no eye button. A non-owned token has no HUD. |

### 11.2 Phase B user flows

| # | User action | Expected result |
|---|---|---|
| B0 | Open the picker from the HUD, with no saved position. | It opens left of the HUD button, with its vertical center on the token center. |
| B1 | Drag its header to another place. | The picker follows the pointer and stays inside the screen. After the release, the reset button (pin icon) shows. Only the token slot is saved. |
| B2 | Click the header without a move. | Nothing moves; nothing is saved. |
| B3 | Click a header button (eye, gear, close). | The button acts; the picker does not move. |
| B4 | After B1, zoom or pan the canvas. | The picker keeps the same screen distance to the token center. |
| B5 | After B1, move the token (or let another user move it). | The picker follows the token during the move animation. |
| B6 | After B1, open the picker from another token. | The same screen distance to that token center. |
| B7 | After B1, put the token near a screen edge. | The picker stays inside the screen. |
| B8 | After B1, drag the resize grip, then close and open again. | It opens with the new size, where the user left it. |
| B9 | Click the reset button. | The button goes away; only the token slot is cleared; the picker goes back to B0. |
| B10 | Drag a corner of the hover display with Ctrl (phase A behavior, shared drag code). | The display moves and resizes as before. |
| B11 | Reload the page and open the picker from the HUD. | The token slot stays. |
| B12 | Phase D: drag a picker from the hotbar. | Only the screen slot is saved, as the screen position. A HUD picker keeps its token slot. |

### 11.3 Phase C user flows

Open the picker from the Token HUD with real input, as in 11.1. "Menu" is the menu button of a category tile. A move
is a drag only (rule 9.3, temporary exception). Each flow that
writes checks the User flag `flags.token-hover-art.categories.<baseActorId>` after the action.

| # | User action | Expected result |
|---|---|---|
| C1 | Click "+ category", type "Moods", press Enter. | A "Moods" category tile shows at the root. The flag has one entry with `parentId: null`. |
| C2 | Click "+ category", type a name, press Escape. Then click "+ category" and confirm an empty name. | Nothing is created. Escape closes only the name field, not the picker. |
| C3 | Click "Moods". Create "Angry" in it. | The breadcrumb shows "Gallery › Moods". "Angry" shows in "Moods". "No hover art" does not show. |
| C4 | Click "Gallery" in the breadcrumb. | The root shows again, with "Moods" and the assets that are in no category. |
| C5 | Drag an asset onto the "Moods" tile. | The asset leaves the root and shows in "Moods". |
| C6 | In "Moods", drag that asset onto "Gallery" in the breadcrumb. | The asset goes back to the root. |
| C7 | Keyboard: Tab to the menu of a category, Enter, "Rename", type a name, Enter. | The category gets the name. The focus stays in the picker. |
| C8 | Drag "Moods" onto its own tile, and onto the breadcrumb part where it is now. | The drop is refused (no drop cursor). Nothing changes. A drop into its own child cannot happen in the UI: a category and its children never show together, and the unit tests cover the rule. |
| C9 | Create "Calm" at the root and drag it onto "Moods". | "Calm" moves into "Moods". |
| C10 | Menu of "Moods", "Rename", type "Feelings", Enter. | The tile and the breadcrumb show "Feelings". |
| C11 | Menu of "Feelings", "Delete", confirm. | "Feelings" and all categories in it go away. Their assets show at the root again. No asset leaves the gallery. |
| C12 | Delete an empty category. | It goes away with no confirmation. |
| C13 | Select an asset that is in a category, go to the root. | The category tile that holds the selection shows a mark. A click on the asset in the category changes the token art, as in A2. |
| C14 | Put a folder file into a category. Remove the file from the folder and rescan in the gallery manager. | The open picker no longer shows the file. No error. |
| C15 | GM and player open the picker for the same token. The player creates a category. | Each user sees only their own categories. The write goes to the User flags of the player. |
| C16 | The same user in two clients: create a category in one. | The open picker of the other client shows it at once. |
| C17 | Player: create, move, rename, and delete own categories. | All actions work for a player. |
| C18 | Two quick moves in a row (drag two assets fast). | Both moves are saved. |
| C19 | Press Escape while a category menu is open, then again. | The first Escape closes the menu, the second closes the picker. |
| C20 | After the moves, press W. | The canvas pans: no picker control keeps the focus after a mouse action. |
| C21 | Ctrl+click three assets, then drag one of them onto a category tile. | The three tiles show as marked. All three move into the category in one User update. The token art does not change. |
| C22 | Click an asset, then Shift+click an asset four tiles later. | The click sets the hover art. The five tiles from the first to the last are marked. |
| C23 | Ctrl+click a category and an asset, then drag the asset onto another category tile. | Both move into the target, in one User update. |
| C24 | Mark two tiles, drag a third tile that is not marked onto a category. | Only the dragged tile moves. The marks stay. |
| C25 | Mark tiles, then press Escape twice. | The first Escape clears the marks, the second closes the picker. |
| C26 | Keyboard: Shift+Enter on a focused image tile. | It selects the hover art, as a plain Enter does. No tile is marked. |
| C27 | Mark tiles, then open a category or click a plain tile. | The marks clear. |

### 11.4 Phase D user flows

Real input as in 11.1. "Drop" is an HTML5 drag from the picker or the HUD onto an empty slot of the hotbar, unless
the flow names another slot. Each flow that creates a macro checks the macro (type, command, flags, author, image)
after the drop. Delete the test macros after the test.

| # | User action | Expected result |
|---|---|---|
| D1 | Drag the hover art button of the Token HUD onto a hotbar slot. | A script macro "Hover art: <token>" with the token image takes the slot. The HUD and the picker state do not change. |
| D2 | Click the D1 macro. | The picker opens for the token, at the root, in the center of the screen. |
| D3 | Drop a category tile. Click the macro. | Macro "Hover art: <token> › <category path>" with a folder icon. The picker opens in that category. |
| D4 | Drop an image tile. Click the macro. | Macro "Hover art: <token> › <file name>" with the image as icon. No picker opens; the token gets that hover art. |
| D5 | Drop "No hover art". Click the macro. | Cancel icon. The token loses its hover art. |
| D6 | Drop the same image tile on another slot. | The existing macro is reused; no second macro is created. |
| D7 | Lock the hotbar, drop on a slot that has a macro. | Notification that the hotbar is locked; the slot keeps its macro. A drop on an empty slot still works. |
| D8 | Delete the token, then click a D1 macro of it. | Notification with a next step; nothing opens. |
| D9 | Put the token on a scene that the user does not view. Click its gallery and image shortcuts. | The picker opens for the token; the image shortcut changes its art. |
| D10 | Delete the category of a D3 macro, then click the macro. | The picker opens at the root, with a notification. |
| D11 | Remove the image of a D4 macro from the gallery, then click the macro. | Notification; the art does not change. |
| D12 | Player without "Use Script Macros": drop a tile on the hotbar. | Notification that names the permission; no macro is created. |
| D13 | GM turns "Hotbar shortcuts" off. Player: drag a tile to the hotbar; click an old shortcut. | Notification on the drop and on the click. The HUD button and "No hover art" are not draggable; category and image tiles still move between categories. |
| D14 | Drag the picker from a hotbar shortcut (B12), then open it from the HUD. | Only the screen slot of `pickerPosition` changes; the HUD picker keeps its place. |
| D15 | Press the number key of a D1 macro. | The picker opens in the center of the screen, as in D2. |
| D16 | Open the picker from the HUD, then click a D1 macro of another token. | The picker shows the other token. |
| D17 | After a drag to the hotbar, press W (check `game.keyboard.hasFocus`). | No element keeps the focus. |
