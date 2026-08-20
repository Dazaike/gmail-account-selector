# Gmail Account Selector

**v1.2.0** · Chrome Manifest V3 · zero dependencies · zero build step

You have six Gmail accounts and Google's own account switcher still takes four clicks and
a full page reload to guess wrong. This extension fixes that.

One picker. Real profile photos. The correct `/mail/u/N/` index every time, because the
extension learns the indexes instead of asking you to memorize them like it's 2009.

## What it actually does

- **Auto-discovery.** `zero-typing`. Open `https://mail.google.com/mail/u/N/` once. The
  extension reads the address, the display name and the `authuser` index Gmail actually
  used, then files it away. Sign accounts in or out, watch every index shuffle, and it
  re-syncs on the next visit. Your labels are never overwritten — you named it, you own it.
- **Real profile pictures.** Scraped from the Gmail header, decoded with
  `createImageBitmap`, center-cropped on an `OffscreenCanvas` to 96×96, re-encoded as
  WebP, cached in `chrome.storage.local`. A 274 KB original becomes 9 KB. Accounts with no
  Google photo get a deterministic initials disc — no placeholder gray blobs.
- **Unread badges.** Polls `mail.google.com/mail/u/N/feed/atom` every 5 minutes, parses
  `<fullcount>` with a regex because service workers have no `DOMParser` and we're not
  shipping a 90 KB XML library to count your unread email. Feed unreachable? No badge. No
  spinner, no lie.
- **Recency intel.** Every open stamps `lastUsedAt`. The picker marks the last account you
  used and will sort recency-first if you ask it to.
- **Quick actions.** Hover a row: Compose, Calendar, Drive — each pinned to that account's
  index. `no more wrong-account calendar invites`.
- **List or grid.** Rows for scanning, cards for clicking. Your call.
- **Popup + global shortcut.** `Alt+Shift+G`. Rebind it at `chrome://extensions/shortcuts`
  if your muscle memory disagrees.
- **An options page that respects you.** Drag-and-drop reorder with real keyboard parity,
  duplicate email/index warnings, hide-without-deleting, undo after every removal,
  clear-all for when you've signed out of everything, and JSON export/import.
  `checkmate tech debt`.

## Install

```bash
git clone https://github.com/Dazaike/gmail-account-selector.git
```

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. **Load unpacked** → point it at the repository root.
4. Open each Gmail mailbox once. The list fills itself in. That's the entire setup.

Prefer the packaged build? Grab the zip from
[Releases](https://github.com/Dazaike/gmail-account-selector/releases), unzip, load
unpacked. Same four steps, fewer excuses.

Toolbar icon or `Alt+Shift+G` opens the picker. **Manage accounts** opens the options page.

Photos not appearing? Reload the Gmail tab. Chrome does not inject content scripts into
tabs that were already open when the extension loaded. This is Chrome's rule, not ours.
Still nothing? Check the service worker console at `chrome://extensions` — every avatar
failure logs the URL and the reason, because "it didn't work" is not a diagnosis.

## Permissions, itemized

No analytics. No telemetry. No remote code. No "anonymous usage data" that isn't.
Every permission below exists because a feature you asked for cannot work without it.

| Permission | Why it exists |
| --- | --- |
| `storage` | Accounts, cached photos, preferences. Local only. |
| `alarms` | Schedules the 5-minute unread poll. |
| `https://mail.google.com/*` | Reads the signed-in address and photo from the Gmail header; fetches the unread feed. |
| `https://*.googleusercontent.com/*` | Downloads the profile photo bytes. |
| `https://example.com/*` | Redirects one bookmarkable URL into the picker. |

## Development

```bash
npm test                   # node --test — 18 tests over the storage and domain helpers
npm run validate:manifest  # node --check on every script
npm run package            # dist/gmail-account-selector-<version>.zip
```

No bundler. No transpiler. No 400 MB `node_modules` to compile six files that browsers
have run natively since 2018. `src/*.js` are ES modules loaded directly by the extension
pages and the service worker. The one exception is `src/discover.js`, a classic content
script, because Chrome still refuses to load declared content scripts as modules.

`manifest.json` holds the canonical version. `npm run package` reads it. There is exactly
one place to bump, so there is exactly one place to get it wrong.

## Changelog

[CHANGELOG.md](CHANGELOG.md). Actual changes, no marketing.

## License

MIT. Do what you want. If you ship it worse, that's on you.
