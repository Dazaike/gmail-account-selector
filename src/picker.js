import {
  avatarHue,
  calendarUrl,
  composeUrl,
  driveUrl,
  gmailUrl,
  initialsFor,
  loadAccounts,
  loadSettings,
  loadUnread,
  markUsed,
  orderAccounts,
  visibleAccounts,
} from "./accounts.js";

const accountList = document.querySelector("#account-list");
const emptyState = document.querySelector("#empty-state");
const manageAccounts = document.querySelector("#manage-accounts");
const isPopup = new URLSearchParams(location.search).get("view") === "popup";
const unreadBadges = new Map();

document.body.classList.toggle("popup", isPopup);

function showEmptyState() {
  accountList.replaceChildren();
  unreadBadges.clear();
  emptyState.hidden = false;
}

async function open(url, accountId) {
  try {
    await markUsed(accountId);
  } catch (error) {
    console.warn("Could not record account usage.", error);
  }

  if (isPopup) {
    await chrome.tabs.create({ url });
    window.close();
    return;
  }

  window.location.assign(url);
}

function renderAvatar(account) {
  const avatar = document.createElement("span");
  avatar.className = "avatar";

  const fallback = () => {
    avatar.replaceChildren();
    avatar.textContent = initialsFor(account.label);
    avatar.style.background = `hsl(${avatarHue(account.email)} 55% 30%)`;
  };

  if (account.avatar) {
    const image = document.createElement("img");
    image.className = "avatar-img";
    image.alt = "";
    image.addEventListener("error", fallback);
    image.src = account.avatar;
    avatar.append(image);
  } else {
    fallback();
  }

  return avatar;
}

function applyUnread(badge, entry) {
  const count = entry?.ok ? entry.count : null;

  if (typeof count !== "number" || count <= 0) {
    badge.hidden = true;
    badge.textContent = "";
    return;
  }

  badge.hidden = false;
  badge.textContent = count > 99 ? "99+" : String(count);
  badge.setAttribute("aria-label", `${count} unread`);
}

function renderAccounts(accounts, settings, unread) {
  accountList.replaceChildren();
  unreadBadges.clear();
  emptyState.hidden = accounts.length > 0;
  accountList.classList.toggle("is-grid", settings.layout === "grid");
  document.body.classList.toggle("layout-grid", settings.layout === "grid");

  const lastUsedId = accounts.reduce((best, account) => {
    if (account.lastUsedAt === null) {
      return best;
    }

    return best === null || account.lastUsedAt > best.lastUsedAt ? account : best;
  }, null)?.id;

  for (const account of orderAccounts(accounts, settings.order)) {
    const row = document.createElement("div");
    const button = document.createElement("button");
    const text = document.createElement("span");
    const label = document.createElement("span");
    const email = document.createElement("span");
    const badges = document.createElement("span");
    const unreadBadge = document.createElement("span");
    const quickActions = document.createElement("div");

    row.className = "account-row";
    button.type = "button";
    button.className = "account-button";
    text.className = "account-text";
    label.className = "account-label";
    email.className = "account-email";
    badges.className = "badge-row";
    unreadBadge.className = "unread-badge";
    quickActions.className = "quick-actions";

    label.textContent = account.label;
    email.textContent = account.email;
    text.append(label, email);
    applyUnread(unreadBadge, unread[account.id]);
    badges.append(unreadBadge);
    unreadBadges.set(account.id, unreadBadge);

    if (account.id === lastUsedId) {
      const lastUsed = document.createElement("span");
      lastUsed.className = "last-used-badge";
      lastUsed.textContent = "Last used";
      badges.append(lastUsed);
    }

    button.title = `Open Gmail as ${account.label} (${account.email})`;
    button.append(renderAvatar(account), text, badges);
    button.addEventListener("click", () => open(gmailUrl(account.authuser), account.id));

    for (const [name, build] of [
      ["Compose", composeUrl],
      ["Calendar", calendarUrl],
      ["Drive", driveUrl],
    ]) {
      const action = document.createElement("button");
      action.type = "button";
      action.className = "quick-action";
      action.textContent = name;
      action.setAttribute("aria-label", `${name} as ${account.label}`);
      action.addEventListener("click", () => open(build(account.authuser), account.id));
      quickActions.append(action);
    }

    row.append(button, quickActions);
    accountList.append(row);
  }
}

manageAccounts.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes.unread) {
    return;
  }

  const unread = changes.unread.newValue ?? {};

  for (const [id, badge] of unreadBadges) {
    applyUnread(badge, unread[id]);
  }
});

try {
  const [accounts, settings, unread] = await Promise.all([loadAccounts(), loadSettings(), loadUnread()]);
  renderAccounts(visibleAccounts(accounts), settings, unread);
  chrome.runtime.sendMessage({ type: "unread-refresh" }).catch(() => {});
} catch (error) {
  console.error("Could not load Gmail accounts.", error);
  showEmptyState();
}
