# Changelog

All notable changes to this project are documented here. This project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.6] - 2026-09-02

### Added

- **Custom Avatar Uploads & Overwrite Protection:** Upload custom account photos in options. Discovery respects `customAvatar` and never overwrites custom profile pictures with newly scraped photos.
- **Custom Label Overwrite Protection:** User-defined display names (`customLabel`) are preserved and protected from being overwritten by auto-discovered header names.
- **Show / Hide Email Visibility:** Added a preference toggle in options to show or hide email addresses in the picker interface.
- **Vector Extension Icons & Favicons:** Added scalable `icon.svg` brand asset for toolbar action icons (`16`, `32`, `48`, `128`) and browser tab favicons for options and picker pages.

## [1.2.0] - 2026-08-20

### Added

- **Grid layout.** New `Picker layout` preference renders accounts as cards
  (`repeat(auto-fill, minmax(184px, 1fr))`) instead of rows; the popup switches to two
  columns and widens to 560 px so the quick actions stay on one line.
- **Clear all accounts.** A `Start over` section in the options page wipes the list behind
  a confirm dialog, with the existing undo toast as a safety net — the fast way to recover
  after signing out of Gmail accounts.
- **Animated quick actions.** Compose / Calendar / Drive now expand over 220 ms
  (`max-height` + `opacity`) with a 0/40/80 ms stagger instead of appearing instantly, and
  the collapsed row no longer reserves dead space.

### Fixed

- **Profile photos for accounts whose header URL carries no size hint.** Avatar fetching
  now rewrites both `=sNN-c[-mo]` and `?sz=NN` to 96 px, keeps the original URL as a
  fallback, and downscales through `createImageBitmap` + `OffscreenCanvas` to a WebP.
  A 274 KB original that the old 64 KB byte cap rejected outright now stores as ~9 KB.
- **Photos never captured at all.** The content script used to stop at the first attempt,
  which usually resolved the address from `document.title` before the Gmail header had
  mounted, so `photoUrl` was reported as `null` forever. It now keeps scanning (60 ×
  500 ms) and re-reports once a photo appears.
- Long addresses no longer overflow their grid card.
- Every avatar failure now logs the URL and the reason to the service worker console.

## [1.1.0] - 2026-08-19

### Added

- Auto-discovery of signed-in Gmail accounts and their `authuser` indexes via a content
  script on `https://mail.google.com/mail/u/*`.
- Cached Google profile pictures with deterministic initials-disc fallbacks.
- Unread-count badges from the per-account Atom feed, polled every 5 minutes.
- `lastUsedAt` tracking, a "Last used" badge, and optional recency-first ordering.
- Per-account Compose / Calendar / Drive quick actions.
- Toolbar popup and the `Alt+Shift+G` global shortcut.
- Options hardening: drag-and-drop reorder with keyboard parity, duplicate email/index
  warnings, undo after removal, hide-without-deleting.
- JSON export/import of accounts and preferences.

## [1.0.0] - initial

- Manual account list, dark picker page, and a bookmarkable redirect into it.
