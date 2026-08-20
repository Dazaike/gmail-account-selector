const STORAGE_KEY = "accounts";
const SETTINGS_KEY = "settings";
const UNREAD_KEY = "unread";
const VALIDATION_ERROR =
  "Enter a display name, email address, and non-negative Gmail account index.";
const BACKUP_ERROR = "Backup file is not a valid Gmail Account Selector export.";
const DEFAULT_SETTINGS = { order: "manual", layout: "list", unreadEnabled: true };

function parseAuthuser(value) {
  const text = String(value ?? "").trim();

  if (!/^\d+$/.test(text)) {
    return null;
  }

  const authuser = Number(text);
  return Number.isSafeInteger(authuser) ? authuser : null;
}

function optionalString(value, prefix = "") {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  return prefix && !value.startsWith(prefix) ? null : value;
}

export function normalizeAccount(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const { id, label, email, authuser } = value;
  const valid =
    typeof id === "string" &&
    id.length > 0 &&
    typeof label === "string" &&
    label.trim().length > 0 &&
    typeof email === "string" &&
    email.trim().length > 0 &&
    typeof authuser === "number" &&
    Number.isSafeInteger(authuser) &&
    authuser >= 0;

  if (!valid) {
    return null;
  }

  const lastUsedAt = value.lastUsedAt;

  return {
    id,
    label,
    email,
    authuser,
    avatar: optionalString(value.avatar, "data:image/"),
    avatarSource: optionalString(value.avatarSource),
    hidden: Boolean(value.hidden),
    lastUsedAt: typeof lastUsedAt === "number" && Number.isFinite(lastUsedAt) && lastUsedAt >= 0 ? lastUsedAt : null,
    discovered: Boolean(value.discovered),
  };
}

export async function loadAccounts() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const accounts = stored[STORAGE_KEY];

  if (!Array.isArray(accounts)) {
    return [];
  }

  return accounts.map(normalizeAccount).filter((account) => account !== null);
}

export async function saveAccounts(accounts) {
  await chrome.storage.local.set({ [STORAGE_KEY]: accounts });
}

export function visibleAccounts(accounts) {
  return accounts.filter((account) => !account.hidden);
}

export function orderAccounts(accounts, order) {
  if (order !== "recent") {
    return [...accounts];
  }

  return accounts
    .map((account, index) => ({ account, index }))
    .sort((a, b) => {
      const left = a.account.lastUsedAt;
      const right = b.account.lastUsedAt;

      if (left === right || (left === null && right === null)) {
        return a.index - b.index;
      }

      if (left === null) {
        return 1;
      }

      if (right === null) {
        return -1;
      }

      return right - left;
    })
    .map((entry) => entry.account);
}

function sanitizeSettings(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};

  return {
    order: source.order === "recent" ? "recent" : DEFAULT_SETTINGS.order,
    layout: source.layout === "grid" ? "grid" : DEFAULT_SETTINGS.layout,
    unreadEnabled: "unreadEnabled" in source ? Boolean(source.unreadEnabled) : DEFAULT_SETTINGS.unreadEnabled,
  };
}

export async function loadSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return sanitizeSettings(stored[SETTINGS_KEY]);
}

export async function saveSettings(patch) {
  const settings = sanitizeSettings({ ...(await loadSettings()), ...(patch ?? {}) });
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  return settings;
}

export async function loadUnread() {
  const stored = await chrome.storage.local.get(UNREAD_KEY);
  const unread = stored[UNREAD_KEY];

  if (!unread || typeof unread !== "object" || Array.isArray(unread)) {
    return {};
  }

  return unread;
}

export async function saveUnread(map) {
  await chrome.storage.local.set({ [UNREAD_KEY]: map });
}

export async function markUsed(id) {
  const accounts = await loadAccounts();

  if (!accounts.some((account) => account.id === id)) {
    return accounts;
  }

  const nextAccounts = accounts.map((account) =>
    account.id === id ? { ...account, lastUsedAt: Date.now() } : account,
  );
  await saveAccounts(nextAccounts);
  return nextAccounts;
}

export function createAccountId() {
  return crypto.randomUUID();
}

export function validateAccount(input) {
  const label = String(input.label ?? "").trim();
  const email = String(input.email ?? "").trim();
  const authuser = parseAuthuser(input.authuser);

  if (!label || !email || authuser === null) {
    throw new Error(VALIDATION_ERROR);
  }

  return { label, email, authuser };
}

function requireAuthuser(authuser) {
  const parsedAuthuser = parseAuthuser(authuser);

  if (parsedAuthuser === null) {
    throw new Error(VALIDATION_ERROR);
  }

  return parsedAuthuser;
}

export function gmailUrl(authuser) {
  return `https://mail.google.com/mail/u/${requireAuthuser(authuser)}/`;
}

export function composeUrl(authuser) {
  return `https://mail.google.com/mail/u/${requireAuthuser(authuser)}/#inbox?compose=new`;
}

export function calendarUrl(authuser) {
  return `https://calendar.google.com/calendar/u/${requireAuthuser(authuser)}/r`;
}

export function driveUrl(authuser) {
  return `https://drive.google.com/drive/u/${requireAuthuser(authuser)}/my-drive`;
}

export function unreadFeedUrl(authuser) {
  return `https://mail.google.com/mail/u/${requireAuthuser(authuser)}/feed/atom`;
}

export function parseUnreadCount(text) {
  const match = /<fullcount>(\d+)<\/fullcount>/.exec(String(text ?? ""));
  return match ? Number(match[1]) : null;
}

export function parseAccountLabel(ariaLabel) {
  const text = String(ariaLabel ?? "");
  const email = /\(([^()\s]+@[^()\s]+)\)/.exec(text);

  if (!email) {
    return null;
  }

  const colon = text.indexOf(":");
  const paren = text.indexOf("(");
  const displayName = colon >= 0 && paren > colon ? text.slice(colon + 1, paren).trim() : "";

  return { displayName, email: email[1] };
}

export function upsertDiscovered(accounts, discovery) {
  const email = String(discovery?.email ?? "").trim();
  const authuser = parseAuthuser(discovery?.authuser);

  if (!email || authuser === null) {
    return [...accounts];
  }

  const key = email.toLowerCase();
  const index = accounts.findIndex((account) => account.email.trim().toLowerCase() === key);

  if (index >= 0) {
    return accounts.map((account, position) =>
      position === index ? { ...account, authuser } : account,
    );
  }

  const displayName = String(discovery?.displayName ?? "").trim();

  return [
    ...accounts,
    {
      id: createAccountId(),
      label: displayName || email.split("@")[0],
      email,
      authuser,
      avatar: null,
      avatarSource: null,
      hidden: false,
      lastUsedAt: null,
      discovered: true,
    },
  ];
}

export function initialsFor(label) {
  const words = String(label ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "?";
  }

  return words
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

export function avatarHue(email) {
  const text = String(email ?? "");
  let sum = 0;

  for (let index = 0; index < text.length; index += 1) {
    sum += text.charCodeAt(index);
  }

  return sum % 360;
}

export function parseBackup(text) {
  let data;

  try {
    data = JSON.parse(String(text ?? ""));
  } catch {
    throw new Error(BACKUP_ERROR);
  }

  if (!data || typeof data !== "object" || Array.isArray(data) || !Array.isArray(data.accounts)) {
    throw new Error(BACKUP_ERROR);
  }

  const seenIds = new Set();
  const accounts = [];

  for (const entry of data.accounts) {
    let values;

    try {
      values = validateAccount(entry ?? {});
    } catch {
      throw new Error(BACKUP_ERROR);
    }

    const id = typeof entry.id === "string" && entry.id.length > 0 && !seenIds.has(entry.id)
      ? entry.id
      : createAccountId();
    seenIds.add(id);

    const account = normalizeAccount({ ...entry, ...values, id });

    if (!account) {
      throw new Error(BACKUP_ERROR);
    }

    accounts.push(account);
  }

  return { accounts, settings: sanitizeSettings(data.settings) };
}

export { BACKUP_ERROR, DEFAULT_SETTINGS, VALIDATION_ERROR };
