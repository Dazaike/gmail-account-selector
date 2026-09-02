import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

let storedValue;
const writes = [];

globalThis.chrome = {
  storage: {
    local: {
      async get() {
        return storedValue;
      },
      async set(value) {
        writes.push(value);
      },
    },
  },
};

const {
  gmailUrl,
  loadAccounts,
  loadSettings,
  loadUnread,
  markUsed,
  saveAccounts,
  saveSettings,
  validateAccount,
} = await import("../src/accounts.js");

beforeEach(() => {
  storedValue = {};
  writes.length = 0;
});

test("validateAccount trims valid account values", () => {
  assert.deepEqual(
    validateAccount({ label: "  Personal  ", email: " person@example.com ", authuser: " 0 " }),
    { label: "Personal", email: "person@example.com", authuser: 0 },
  );
});

test("validateAccount rejects missing or invalid values", () => {
  const invalidInputs = [
    { label: "", email: "person@example.com", authuser: "0" },
    { label: "Personal", email: "", authuser: "0" },
    { label: "Personal", email: "person@example.com", authuser: "" },
    { label: "Personal", email: "person@example.com", authuser: "-1" },
    { label: "Personal", email: "person@example.com", authuser: "1.5" },
    { label: "Personal", email: "person@example.com", authuser: "first" },
  ];

  for (const input of invalidInputs) {
    assert.throws(
      () => validateAccount(input),
      /Enter a display name, email address, and non-negative Gmail account index\./,
    );
  }
});

test("gmailUrl uses the Gmail multi-login index", () => {
  assert.equal(gmailUrl(0), "https://mail.google.com/mail/u/0/");
  assert.equal(gmailUrl(7), "https://mail.google.com/mail/u/7/");
});

test("loadAccounts normalizes missing and malformed storage data", async () => {
  assert.deepEqual(await loadAccounts(), []);

  storedValue = { accounts: { not: "an array" } };
  assert.deepEqual(await loadAccounts(), []);

  const valid = { id: "work", label: "Work", email: "work@example.com", authuser: 1 };
  storedValue = {
    accounts: [valid, { id: "bad", label: "", email: "bad@example.com", authuser: 0 }, null],
  };
  assert.deepEqual(await loadAccounts(), [
    {
      ...valid,
      avatar: null,
      avatarSource: null,
      customAvatar: false,
      customLabel: false,
      hidden: false,
      lastUsedAt: null,
      discovered: false,
    },
  ]);
});

test("saveAccounts writes the ordered account list", async () => {
  const accounts = [{ id: "personal", label: "Personal", email: "person@example.com", authuser: 0 }];
  await saveAccounts(accounts);
  assert.deepEqual(writes, [{ accounts }]);
});

test("markUsed timestamps only the requested account", async () => {
  storedValue = {
    accounts: [
      { id: "work", label: "Work", email: "work@example.com", authuser: 1 },
      { id: "home", label: "Home", email: "home@example.com", authuser: 0, lastUsedAt: 5 },
    ],
  };

  const before = Date.now();
  const next = await markUsed("work");

  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].accounts, next);
  assert.ok(next[0].lastUsedAt >= before);
  assert.equal(next[1].lastUsedAt, 5);

  writes.length = 0;
  await markUsed("missing");
  assert.deepEqual(writes, []);
});

test("loadSettings falls back to defaults and rejects unknown values", async () => {
  assert.deepEqual(await loadSettings(), { order: "manual", layout: "list", unreadEnabled: true, showEmails: true });

  storedValue = { settings: { order: "sideways", layout: "carousel", unreadEnabled: 0, showEmails: false } };
  assert.deepEqual(await loadSettings(), { order: "manual", layout: "list", unreadEnabled: false, showEmails: false });

  storedValue = { settings: { order: "recent", layout: "grid" } };
  assert.deepEqual(await loadSettings(), { order: "recent", layout: "grid", unreadEnabled: true, showEmails: true });
});

test("saveSettings merges a patch over the stored settings", async () => {
  storedValue = { settings: { order: "recent", layout: "grid", unreadEnabled: true, showEmails: true } };
  const saved = await saveSettings({ unreadEnabled: false });

  assert.deepEqual(saved, { order: "recent", layout: "grid", unreadEnabled: false, showEmails: true });
  assert.deepEqual(writes, [{ settings: { order: "recent", layout: "grid", unreadEnabled: false, showEmails: true } }]);
});


test("loadUnread ignores malformed unread payloads", async () => {
  assert.deepEqual(await loadUnread(), {});

  storedValue = { unread: [1, 2] };
  assert.deepEqual(await loadUnread(), {});

  const unread = { work: { count: 3, ok: true, checkedAt: 1 } };
  storedValue = { unread };
  assert.deepEqual(await loadUnread(), unread);
});
