import assert from "node:assert/strict";
import test from "node:test";

const {
  avatarHue,
  calendarUrl,
  composeUrl,
  driveUrl,
  initialsFor,
  orderAccounts,
  parseAccountLabel,
  parseBackup,
  parseUnreadCount,
  unreadFeedUrl,
  upsertDiscovered,
} = await import("../src/accounts.js");

function account(overrides) {
  return {
    id: overrides.id,
    label: overrides.label ?? overrides.id,
    email: overrides.email ?? `${overrides.id}@example.com`,
    authuser: overrides.authuser ?? 0,
    avatar: overrides.avatar ?? null,
    avatarSource: overrides.avatarSource ?? null,
    hidden: overrides.hidden ?? false,
    lastUsedAt: overrides.lastUsedAt ?? null,
    discovered: overrides.discovered ?? false,
  };
}

test("orderAccounts sorts by recency and keeps unused accounts last", () => {
  const accounts = [
    account({ id: "a", lastUsedAt: 10 }),
    account({ id: "b", lastUsedAt: null }),
    account({ id: "c", lastUsedAt: 30 }),
    account({ id: "d", lastUsedAt: 10 }),
  ];

  assert.deepEqual(
    orderAccounts(accounts, "recent").map((entry) => entry.id),
    ["c", "a", "d", "b"],
  );
  assert.deepEqual(
    orderAccounts(accounts, "manual").map((entry) => entry.id),
    ["a", "b", "c", "d"],
  );
  assert.notEqual(orderAccounts(accounts, "manual"), accounts);
});

test("upsertDiscovered updates the index of a known email without touching its label", () => {
  const known = account({ id: "work", label: "Zed", email: "Work@Example.com", authuser: 0 });
  const other = account({ id: "other", label: "Other", email: "other@example.com", authuser: 3 });

  const next = upsertDiscovered([known, other], {
    email: "work@example.com",
    displayName: "Work Robot",
    authuser: 3,
    photoUrl: "https://lh3.googleusercontent.com/a/x=s32-c",
  });

  assert.equal(next.length, 2);
  assert.deepEqual(next[0], { ...known, authuser: 3 });
  assert.deepEqual(next[1], other);
});

test("upsertDiscovered appends unknown accounts as discovered", () => {
  const [added] = upsertDiscovered([], { email: " new@example.com ", displayName: " New Robot ", authuser: 2 });
  assert.equal(added.label, "New Robot");
  assert.equal(added.email, "new@example.com");
  assert.equal(added.authuser, 2);
  assert.equal(added.discovered, true);
  assert.equal(added.avatar, null);
  assert.equal(added.lastUsedAt, null);
  assert.equal(typeof added.id, "string");

  const [fallback] = upsertDiscovered([], { email: "solo@example.com", displayName: "", authuser: 0 });
  assert.equal(fallback.label, "solo");
});

test("parseUnreadCount reads the atom feed and ignores sign-in pages", () => {
  assert.equal(parseUnreadCount("<feed><fullcount>7</fullcount></feed>"), 7);
  assert.equal(parseUnreadCount("<html>Sign in</html>"), null);
  assert.equal(parseUnreadCount(null), null);
});

test("parseAccountLabel reads the Google account button label", () => {
  assert.deepEqual(parseAccountLabel("Google Account: Robot Overlord\n(robot@example.com)"), {
    displayName: "Robot Overlord",
    email: "robot@example.com",
  });
  assert.equal(parseAccountLabel("Google Account"), null);
  assert.equal(parseAccountLabel(undefined), null);
});

test("account URLs pin Google apps to the Gmail index", () => {
  assert.equal(composeUrl(2), "https://mail.google.com/mail/u/2/#inbox?compose=new");
  assert.equal(calendarUrl(2), "https://calendar.google.com/calendar/u/2/r");
  assert.equal(driveUrl(2), "https://drive.google.com/drive/u/2/my-drive");
  assert.equal(unreadFeedUrl(2), "https://mail.google.com/mail/u/2/feed/atom");
  assert.throws(() => composeUrl(-1), /non-negative Gmail account index/);
});

test("parseBackup round-trips an export payload and rejects junk", () => {
  const payload = {
    version: 1,
    exportedAt: "2026-08-19T00:00:00.000Z",
    accounts: [account({ id: "work", label: "Work", authuser: 1, avatar: "data:image/png;base64,AA" })],
    settings: { order: "recent", layout: "grid", unreadEnabled: false },
  };

  const parsed = parseBackup(JSON.stringify(payload));
  assert.deepEqual(parsed.accounts, payload.accounts);
  assert.deepEqual(parsed.settings, { order: "recent", layout: "grid", unreadEnabled: false });

  for (const invalid of ["{}", "[]", "not json", JSON.stringify({ accounts: [{ label: "x", email: "x@example.com", authuser: "-1" }] })]) {
    assert.throws(() => parseBackup(invalid), /Backup file is not a valid Gmail Account Selector export\./);
  }
});

test("parseBackup regenerates missing and duplicate ids", () => {
  const parsed = parseBackup(
    JSON.stringify({
      accounts: [
        { label: "One", email: "one@example.com", authuser: 0 },
        { id: "dup", label: "Two", email: "two@example.com", authuser: 1 },
        { id: "dup", label: "Three", email: "three@example.com", authuser: 2 },
      ],
    }),
  );

  const ids = parsed.accounts.map((entry) => entry.id);
  assert.equal(new Set(ids).size, 3);
  assert.equal(parsed.accounts[1].id, "dup");
  assert.deepEqual(parsed.settings, { order: "manual", layout: "list", unreadEnabled: true });
});

test("initialsFor and avatarHue produce stable avatar fallbacks", () => {
  assert.equal(initialsFor("Pioneer Pencils"), "PP");
  assert.equal(initialsFor("  robot  overlord  supreme "), "RO");
  assert.equal(initialsFor(""), "?");
  assert.equal(initialsFor(null), "?");

  const hue = avatarHue("work@example.com");
  assert.equal(hue, avatarHue("work@example.com"));
  assert.ok(hue >= 0 && hue < 360);
  assert.notEqual(avatarHue("work@example.com"), avatarHue("other@example.com"));
});
