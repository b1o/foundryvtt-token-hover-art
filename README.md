# Token Hover Art (Foundry VTT v11)

Give each actor a gallery of hover art. Select one image for each token. When a user hovers the token, the full image shows in a screen corner at once. When the pointer leaves the token, the image hides after a short delay. Each user can drag the image to an own position.

## Disclaimer

I made this module first for personal use. It has the features that I find useful for my own group.

- The module is heavily vibe-coded. I do not give regular maintenance. I make updates only when I need them myself.
- The module targets Foundry VTT v11. I do not guarantee that it works in later versions, especially v13 and later.
- I do not guarantee that I accept or review a pull request. You are free to fork the module and change it, under
  the terms of the [license](#license).
- Use the module at your own risk. I take no responsibility for problems that come from the use of this module.

## Install

In the Foundry setup screen, open **Add-on Modules → Install Module**, paste this manifest URL, and click **Install**:

```
https://github.com/b1o/foundryvtt-token-hover-art/releases/latest/download/module.json
```

Then enable **Token Hover Art** in your world under **Game Settings → Manage Modules**.

## Use

1. Open an actor sheet and click **Hover Art** in the sheet header.
2. Add images to the gallery in one of two ways. In both rows, type a path or click the browse button to put a path into the field, then click **Add** (or press Enter):
   - **Add image:** one image.
   - **Add folder:** a folder and a file name filter. All matching images in that folder join the gallery.
3. Optional: click the star to make an image the default for new tokens of this actor.
4. Right-click a token. Click the **images** icon in the left column of the Token HUD. The hover art picker opens next to the button. Select an image, or select the "no hover art" tile. Drag the grip in the bottom-left corner of the picker to resize it; each user keeps their own size. The picker opens left of the HUD button, centered on the token. Drag its header to move it: it then keeps that place relative to the token center. It follows the token when the token moves or when you pan or zoom, and it opens at the same place next to every token. The position applies only to you. The pin button in the header puts the picker back at its default place. Close the picker with its close button, with Escape, with a click outside of it, or with the HUD button again. The keyboard also works: Tab moves between the tiles, and Enter or Space selects one.
5. GMs can click the eye icon in the picker to make the hover art secret. Only GMs and owners see secret hover art.
6. Sort the gallery into categories (folders) in the picker. The categories belong to you and to this actor; other users have their own. Click the folder-plus icon to create a category in the shown category, type a name, and press Enter. Click a category to open it; the path above the tiles goes back. Drag an image or a category onto a category tile or onto a part of the path to move it. A category tile has a menu (the dots on the tile) with **Rename** and **Delete**. Moves are drag and drop only for now. A delete never removes an image from the gallery: its images go back to the top. An image is in at most one category.
7. Mark several tiles to move them together: Ctrl+click (Cmd+click on macOS) marks one tile, Shift+click marks a range, and Ctrl+Shift+click adds a range. Then drag one of the marked tiles. A plain click removes the marks. Escape removes them too.
8. Hotbar shortcuts: drag a tile of the picker, or the hover art button of the Token HUD, onto a hotbar slot. The slot gets a script macro:
   - **Token HUD button:** the macro opens the picker of that token, in the center of the screen.
   - **Category tile:** the macro opens the picker in that category.
   - **Image tile or "No hover art":** the macro sets that hover art at once, with no picker. Its icon is the image (a video shows the core video icon).

   A shortcut works also for a token on a scene that you do not view. A second drop of the same tile reuses the macro. GMs can turn shortcuts off with the setting **Hotbar shortcuts**.
9. To move or resize the hover art: hover a token so the image shows, then hold **Ctrl**. The image gets a dashed outline, corner handles, and stays open. Drag the image to move it, or drag a corner handle to resize it. A resize keeps the aspect ratio of each image, and the opposite corner stays in place. The position and size apply only to you. To go back to the corner and the maximum height, turn off **Use my dragged position and size** in the module settings.

## Folder filters

The filter uses the core wildcard browse, the same mechanism as "Randomize Wildcard Images" on tokens. The server lists the folder and matches each file name with a glob pattern (minimatch).

| Filter | Matches |
|---|---|
| `*.png` | All PNG files (the default) |
| `{*.png,*.webp}` | PNG and WebP files |
| `hero-*.webp` | WebP files whose name starts with `hero-` |
| `*` | All image and video files |

- The filter applies to file names only. Subfolders are not included.
- The match is case-sensitive: `*.png` does not match `PORTRAIT.PNG`.
- Only image and video files are included, whatever the filter.
- Change the default filter in the module settings. Change the filter of one folder in its row in the gallery.

A folder scan needs the core permission **Use File Browser**. So the scan result is stored on the actor, and players read the stored list. The gallery scans its folders again each time a user with that permission opens it. To scan at once, click the scan icon next to **Folders**.

## Data

| Data | Stored in | Shared by |
|---|---|---|
| Manual images | `flags.token-hover-art.images` on the world Actor | All tokens of the actor |
| Folders | `flags.token-hover-art.folders` on the world Actor: `{source, bucket, folder, filter, files}` | All tokens of the actor |
| Selected art | `flags.token-hover-art.selected` on the TokenDocument | One token |
| Secret state | `flags.token-hover-art.secret` on the TokenDocument | One token |
| Defaults | The same two flags on `Actor#prototypeToken` | New tokens |
| Picker categories | `flags.token-hover-art.categories.<actorId>.<categoryId>` on the User: `{name, parentId, sort, paths}` | One user and one actor |
| Hotbar shortcut | `flags.token-hover-art.shortcut` on the Macro: `{kind, tokenUuid, categoryId, path}`. The macro command only calls the module API; it contains no data. | The macro author |

The gallery is the manual images plus the files of all folders, without duplicates. An unlinked token has a synthetic Actor. The module always writes to the base Actor, so all tokens of the actor share one gallery.

## Permissions

- The Token HUD shows only to GMs and to owners of the actor (core rule). So only they can select hover art.
- Each user sees and changes only their own categories. Every client receives the User documents, so category names are not secret.
- A hotbar shortcut is a script macro. Core runs script macros only for users with the permission **Use Script Macros** (default: Player). A user without it gets a message at the drop.
- The gallery window opens only for GMs and, if **Allow owners to manage galleries** is on, for owners. When it is off, owners can still select hover art from the gallery, but they cannot change the gallery. The setting controls the user interface; it is not a server rule, so a user with console access could still write the gallery data.
- To browse files or to add folders, a user needs the core permission **Use File Browser** (default: Trusted Player). To upload files, a user needs **Upload New Files** (default: Assistant GM). Set these in **Configure Permissions**.

## Compatibility

The module supports Foundry VTT v11 and later. `scripts/compat.mjs` holds every core API that moved between versions. Each lookup tries the new namespaced location first and falls back to the v11/v12 global, so v13 logs no deprecation warnings for these APIs.

| Version | Status |
|---|---|
| v11 (11.314) | Tested |
| v12 | Not tested yet. All used APIs exist in the installed v12 source. |
| v13 | Not tested yet. The API locations come from the v13 API documentation. Not confirmed there: the Token HUD markup (`.col.left`) and the text field markup of the settings window (used for the color pickers; without them, the color settings are plain text fields). |

Known future change: the gallery window uses Application V1, because ApplicationV2 does not exist in v11. Application V1 is deprecated since v13. When a later core version removes it, the gallery window must move to ApplicationV2.

## Development

The module has no build step. The development tools need Node 24 (pinned with Volta in `package.json`).

```
npm install
npm run lint
npm test
```

The unit tests cover the pure modules in `scripts/decisions/`. They run without Foundry.

## Release a new version

1. In `module.json`, set `version` (for example `0.4.0`), and set `download` to the same tag: `.../releases/download/v0.4.0/module.zip`.
2. Commit and push the change.
3. On GitHub, publish a release with the tag `v0.4.0`.

The release workflow then checks that the tag matches `module.json`, builds `module.zip`, and attaches `module.json` and `module.zip` to the release. The manifest URL always points to the latest release, so installed copies see the update.

## Settings

| Setting | Scope | Default |
|---|---|---|
| Display position (screen corner) | World | Top right |
| Maximum height (% of screen) | World | 40 |
| Background color | World | `#00000099` (black, 60% opacity) |
| Show border | World | On |
| Border width (px) | World | 1 |
| Border color | World | `#333333ff` |
| Allow owners to manage galleries | World (reloads all clients) | On |
| Hotbar shortcuts | World | On |
| Hide delay (ms) | World | 250 |
| Default folder filter | World | `*.png` |
| Show token name | World | Off |
| Show hover art | Client | On |
| Use my dragged position and size | Client (turned on by a Ctrl-drag) | Off |
| Dragged position | Client (hidden, set with Ctrl-drag) | None |
| Dragged size (image height, % of screen) | Client (hidden, set with a Ctrl corner drag) | None |
| Picker size | Client (hidden, set with the resize grip) | 228 × 290 px |
| Picker position | Client (hidden, set with a header drag, removed with the pin button): one position relative to the token center (Token HUD), one on the screen (hotbar) | Token HUD: left of the button, centered on the token. Hotbar: screen center |

The color settings accept `#rrggbb` or `#rrggbbaa`; the last two digits are the opacity. In the settings window, each color has a color picker and an opacity slider next to the text field. An invalid value falls back to the default.

## License

[MIT](LICENSE). You are free to use, change, and share the module. Keep the copyright notice in all copies, so that
the author gets credit.
