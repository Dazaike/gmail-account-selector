# Gmail Account Selector

**Version 1.2.0** · Chrome extension (Manifest V3) · no build step, no dependencies

A dark, keyboard- and mouse-friendly account picker for people who live in five Gmail
mailboxes at once. It learns your accounts by watching which mailboxes you open, steals
the real Google profile photos, and opens any of them — or their Calendar, Drive or a
compose window — at the correct `/mail/u/N/` index.

## Features

- **Auto-discovery.** Open `https://mail.google.com/mail/u/N/` once and the account
  appears in the picker: display name, address, and the `authuser` index Gmail actually
  used. Sign accounts in or out and the indexes re-sync themselves on the next visit.
  Your own labels are never overwritten.
- **Real profile pictures.** The photo is scraped from the Gmail header, downscaled in the
  service worker to a 96×96 WebP and cached in `chrome.storage.local`. Accounts without a
  Google photo get a deterministic initials disc instead.
- **Unread badges.** Optional 5-minute poll of `mail.google.com/mail/u/N/feed/atom`
  per account. Unreachable feeds simply show no badge.
- **Recency intel.** Every open stamps `lastUsedAt`; the picker marks the most recent
  account and can sort recency-first.
- **Quick actions.** Hover a row for Compose / Calendar / Drive pinned to that account's
  index.
- **List or grid.** Rows for scanning, cards for clicking.
- **Toolbar popup + global shortcut.** `Alt+Shift+G` (rebindable at
  `chrome://extensions/shortcuts`).
- **Managed account list.** Drag-and-drop reorder with keyboard parity, duplicate
  email/index warnings, hide-without-deleting, undo after removal, clear-all, and JSON
  export/import.

## Install (unpacked)

```
git clone https://github.com/Dazaike/gmail-account-selector.git
```

1. Visit `chrome://extensions`.
2. Enable **Developer mode**.
3. **Load unpacked** → select the repository root.
4. Open each Gmail mailbox once; the picker fills itself in.

Open the picker from the toolbar icon or with `Alt+Shift+G`. Configure it via
**Manage accounts**.

## Permissions, and why

| Permission | Reason |
| --- | --- |
| `storage` | Saves accounts, cached photos and preferences locally. Nothing leaves the browser. |
| `alarms` | Schedules the unread-count poll. |
| `https://mail.google.com/*` | Reads the signed-in address/photo from the Gmail header and fetches the unread feed. |
| `https://*.googleusercontent.com/*` | Downloads the profile photo bytes. |
| `https://example.com/*` | Redirects one bookmarkable URL to the picker page. |

No analytics, no remote code, no network calls beyond Google's own endpoints.

## Development

```
npm test                  # node --test: 18 unit tests over the storage/domain helpers
npm run validate:manifest  # node --check on every script
npm run package            # dist/gmail-account-selector-<version>.zip for the Web Store
```

There is no bundler: `src/*.js` are ES modules loaded directly by the extension pages and
service worker, except `src/discover.js`, which is a classic content script.

The canonical version lives in `manifest.json`; `npm run package` reads it.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

MIT
