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
3. GM override: the GM can view and edit the categories of any user.
4. Categories belong to one Actor gallery and one user.
5. An asset is in at most one category of a user (folder behavior).
6. Shortcuts are Macro documents. The module settings explain the macro permission that players need.
7. Categories exist only in the picker.

## 3. Trigger point contract

```js
/**
 * @typedef {object} PickerContext
 * @property {string} tokenUuid           The token whose hover art the picker changes.
 * @property {string|null} categoryId     The category to open, or null for the root.
 * @property {DOMRect|null} anchorRect    The screen rectangle of the trigger, for placement.
 * @property {"hud"|"hotbar"} source      Which trigger point opened the picker.
 */
```

- A trigger point calls `picker.open(context)` and does nothing else.
- `source` is read in one function only (`describeContext`), which returns the small differences: the header
  text, and whether the token rectangle must stay uncovered.
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
  Each tile has a menu button with "Move to…" and "Add to hotbar", so every drag has a keyboard path (rule 9.3).
- **Videos:** only the tiles of the current category are in the DOM. Their videos play while the picker is open
  and stop when it closes or changes category.
- **Size:** the existing resize grip and the `paletteSize` client setting stay. The grip moves to the corner that
  is opposite to the anchor (section 5).

### Picker layout

```
┌ Hover art: <token name> ─────── [user ▾] [eye] [gear] [x] ┐   user ▾: GM only (section 6.5)
│ Root › Moods › Angry                         [+ category] │   breadcrumb: each part is a drop target
│ [▢ Calm] [▢ Happy]                                        │   sub-categories of the current category
│ [∅ none] [img] [img] [img] [img]                          │   assets of the current category
└───────────────────────────────────────────────────────◢──┘
```

"No hover art" shows at the root only.

## 5. Picker position

### 5.1 Automatic placement

A pure function in `picker-placement.mjs`:

```js
/**
 * @param {Rect} anchor      The trigger rectangle.
 * @param {Rect|null} avoid  The token rectangle on the screen, or null.
 * @param {Size} size        The picker size.
 * @param {Size} viewport
 * @returns {{left: number, top: number, corner: "nw"|"ne"|"sw"|"se"}}
 */
export function placePicker(anchor, avoid, size, viewport) {}
```

1. Try the candidates in this order: left of the anchor (as today), right, above, below. Each candidate aligns
   one edge with the anchor and grows away from it.
2. Take the first candidate that is fully inside the viewport and does not intersect `avoid`.
3. If no candidate fits, take the candidate with the largest visible area, and clamp it into the viewport.
4. `corner` is the corner of the picker nearest to the anchor. The resize grip goes to the opposite corner.

Anchors:

| Source | Anchor | Avoid |
|---|---|---|
| HUD | The HUD button rectangle. | The token rectangle on the screen. |
| Hotbar | The rectangle of the macro slot (selector in `compat.mjs`, rule 8.3). | None. |
| Macro run from the directory | The bottom center of the viewport. | None. |

### 5.2 Ctrl free move

- While the user holds Ctrl, a drag on the picker moves it, the same as the hover display. Asset clicks are off
  during Ctrl.
- The drag end saves a pinned position for this user (client setting `pickerPosition`, same format as the
  `CustomPosition` of the hover display: nearest edges and fractions).
- A pinned position replaces the automatic placement for every trigger point. A "reset position" header button
  removes the pin.
- The pinned position is clamped into the viewport each time it is applied, not only at the drag (rule 3.2).
- The edge-and-fraction math moves from `display-layout.mjs` into `screen-geometry.mjs`, which both the hover
  display and the picker use (rule 3.3).

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
- A player can update their own User document; the GM can update every user (`common/documents/user.mjs:205`).
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

`buildTree` runs on every read, so invalid stored data never reaches the UI (rules 3.2 and 7.4).

### 6.3 Writes

One class, `CategoryStore`, owns all writes (rule 4.2). It reads the current map right before each write and
writes only the changed category keys, with `-=` keys for deletions. It serializes its own writes in a queue.

### 6.4 Picker interaction

- **Create:** the "+ category" button creates a category in the current category, with an inline name field.
- **Rename and delete:** in the tile menu. Delete asks for a confirmation if the category has content.
- **Open:** a click on a category tile. The breadcrumb goes back.
- **Drag and drop** (HTML5 drag and drop, one payload format for the picker and the hotbar, section 7.2):

| Drag | Drop on | Result |
|---|---|---|
| Asset | Category tile | Asset moves into the category. |
| Asset | Breadcrumb part | Asset moves into that category, or to the root. |
| Category | Category tile | Category moves into it (cycle refused). |
| Category | Breadcrumb part | Category moves there. |
| Asset, category, header handle | Hotbar slot | Creates a shortcut (section 7). |

- **Order:** categories sort by `sort`, then by name. Assets keep the gallery order.

### 6.5 GM override

- For a GM, the picker header shows a user selector. The default is the GM. The GM can select any user and then
  views and edits that user's categories with the same UI.
- The selector is not shown to players.

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

Drag sources: the picker header handle and the HUD button (kind `gallery`), a category tile, and an asset tile
(including "No hover art").

### 7.3 Shortcut macro

- `type: "script"`, `command: 'game.modules.get("token-hover-art").api.runShortcut(this);'`.
- The shortcut data goes into `flags.token-hover-art.shortcut` (the payload without `type`). The command text never
  contains data, so no data is ever run as code.
- Name: `Hover art: <token>`, `Hover art: <token> › <category path>`, or `Hover art: <token> › <file name>`.
- Image: the token image, a folder icon, the asset image (an icon for a video or for "No hover art").
- Reuse: if the user already has a module macro with the same shortcut flags, the drop reuses it.
- "Add to hotbar" in a tile menu calls `assignHotbarMacro(macro)` with no slot, which takes the first free slot.

### 7.4 `runShortcut(macro)`

1. Validate the flags (rule 7.4). Invalid data: notification, stop.
2. Resolve the token with `fromUuidSync`. Missing: "The token of this shortcut no longer exists. Drag a new
   shortcut from the hover art picker." Stop.
3. Check `tokenDoc.isOwner`. Not owner: notification, stop.
4. By kind:
   - `gallery`: `picker.open({tokenUuid, categoryId: null, anchorRect: slot rect, source: "hotbar"})`.
   - `category`: the same, with `categoryId`. If the category no longer exists, open the root and tell the user.
   - `asset`: `applyAsset(tokenDoc, path)`. The path must still be in the gallery, or be `null`. If not:
     notification, no change (rule 3.2).

The token can be on a scene that the user does not view. The update still works, because every scene and its
tokens exist on each client.

### 7.5 Setting

New world setting "Hotbar shortcuts" (Boolean, default on). Its hint: "Players can drag the picker, a category, or
an asset to the hotbar. A shortcut is a script macro, so players need the core permission 'Use Script Macros'."
When it is off, the drag sources are not draggable and `runShortcut` tells the user that the GM turned shortcuts
off. A drop by a user without `MACRO_SCRIPT` gives a notification that names the permission.

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

Status after phase A: the files without a phase mark exist. The others come in the phase that is named.

```
scripts/
  main.mjs                     composition root (creates and connects, no logic)
  constants.mjs
  settings.mjs                 registration and typed accessors
  output.mjs                   prefixed log and notifications
  compat.mjs                   version differences; the Token HUD column; findByUuid (D: hotbar slot, hotbar lock)
  sheet-header-buttons.mjs     the "Hover Art" button in actor sheet headers (opens the gallery manager)
  keyboard-focus.mjs           give the focus back after a pointer click (v11 keybinding trap)
  gallery-sheet.mjs            the gallery manager
  color-fields.mjs
  data/
    gallery-data.mjs           gallery, selection (applyAsset is the only writer), secret, defaults
    folder-sources.mjs         class FolderSources: folder scans, writes one after the other
    category-store.mjs         C: User flag reads and serialized writes
  decisions/                   pure, no Foundry or DOM globals (ESLint enforces this)
    gallery-rules.mjs          who may manage a gallery; token name visibility on hover
    folder-list.mjs            changes to the folder list, applied to the list as it is at the write
    picker-placement.mjs       picker size limits and placement (B: candidates and token avoidance)
    picker-view.mjs            template data of the picker
    screen-geometry.mjs        edges, fractions, clamp (shared by the hover display and the picker)
    category-tree.mjs          C: tree rules (6.2)
    shortcut-payload.mjs       D: payload validation and macro naming
  picker/
    gallery-picker.mjs         state, open, close, render, actions
    picker-resize.mjs          the resize grip
    open-picker-listeners.mjs  page listeners while open: outside press, Escape, window resize
    picker-move.mjs            B: Ctrl move
    picker-drag-drop.mjs       C: drag sources and drop targets in the picker
  triggers/
    hud-trigger.mjs            the HUD button only
    hotbar-trigger.mjs         D: hotbarDrop, runShortcut, macro reuse
  hover/
    hover-display.mjs          the hover display (class HoverDisplay)
    display-layout.mjs         its position and size (class DisplayLayout)
templates/
  gallery-picker.hbs           replaces hud-palette.hbs
  gallery-sheet.hbs
tests/                         node:test unit tests for decisions/
```

## 10. Open points

None. Decision 5 (folder behavior) was confirmed on 2026-10-26.

## 11. Phases and test plan

| Phase | Content | Manual test (port 30011) |
|---|---|---|
| A | Foundation (section 8), standalone picker with the HUD trigger | The user flows in 11.1. |
| B | Placement and Ctrl move | Token near each edge: picker fully visible, token not covered; pin, reload, reset; window resize. |
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
