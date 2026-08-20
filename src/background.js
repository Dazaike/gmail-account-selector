import {
  loadAccounts,
  loadSettings,
  parseUnreadCount,
  saveAccounts,
  saveUnread,
  unreadFeedUrl,
  upsertDiscovered,
  visibleAccounts,
} from "./accounts.js";

const UNREAD_ALARM = "unread-poll";
const AVATAR_BYTE_LIMIT = 262144;
const AVATAR_SIZE = 96;

function bytesToBase64(bytes) {
  const chunkSize = 0x8000;
  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + chunkSize));
  }

  return btoa(binary);
}

// Header photo URLs come in several shapes: "…=s32-c", "…=s64-c-mo", "…?sz=32"
// and bare "…/photo.jpg". Ask for a 96px crop when the URL says how, and always
// keep the original as the last resort.
function photoUrlCandidates(photoUrl) {
  const sized = /=s\d+/.test(photoUrl) ? photoUrl.replace(/=s\d+(-c)?(-[a-z]+)?$/, `=s${AVATAR_SIZE}-c`) : null;
  const parameterized = /[?&]sz=\d+/.test(photoUrl) ? photoUrl.replace(/([?&]sz=)\d+/, `$1${AVATAR_SIZE}`) : null;

  return [...new Set([sized, parameterized, photoUrl].filter(Boolean))];
}

// Downscale in the worker so a full-resolution original still fits in storage.
async function normalizeAvatar(blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(AVATAR_SIZE, AVATAR_SIZE);
  const context = canvas.getContext("2d");
  const scale = Math.max(AVATAR_SIZE / bitmap.width, AVATAR_SIZE / bitmap.height);
  const width = bitmap.width * scale;
  const height = bitmap.height * scale;

  context.drawImage(bitmap, (AVATAR_SIZE - width) / 2, (AVATAR_SIZE - height) / 2, width, height);
  bitmap.close();

  return canvas.convertToBlob({ type: "image/webp", quality: 0.9 });
}

async function fetchAvatar(photoUrl) {
  for (const url of photoUrlCandidates(photoUrl)) {
    let response;

    try {
      response = await fetch(url);
    } catch (error) {
      console.warn("Could not fetch the Gmail profile photo.", url, error);
      continue;
    }

    if (!response.ok) {
      console.warn("Gmail profile photo request failed.", url, response.status);
      continue;
    }

    const downloaded = await response.blob();
    let image = downloaded;

    try {
      image = await normalizeAvatar(downloaded);
    } catch (error) {
      console.warn("Could not downscale the Gmail profile photo; storing it as served.", url, error);
    }

    if (image.size === 0 || image.size > AVATAR_BYTE_LIMIT) {
      console.warn("Gmail profile photo is unusable.", url, image.size);
      continue;
    }

    const bytes = new Uint8Array(await image.arrayBuffer());
    const mime = (image.type || "image/webp").split(";")[0].trim() || "image/webp";
    return `data:${mime};base64,${bytesToBase64(bytes)}`;
  }

  return null;
}

async function cacheAvatar(id, photoUrl) {
  const avatar = await fetchAvatar(photoUrl);

  if (!avatar) {
    console.warn("No usable Gmail profile photo at", photoUrl);
    return;
  }

  const accounts = await loadAccounts();

  if (!accounts.some((account) => account.id === id)) {
    return;
  }

  await saveAccounts(
    accounts.map((account) => (account.id === id ? { ...account, avatar, avatarSource: photoUrl } : account)),
  );
}

async function handleDiscovery(discovery) {
  const accounts = await loadAccounts();
  const nextAccounts = upsertDiscovered(accounts, discovery);
  await saveAccounts(nextAccounts);

  const email = String(discovery?.email ?? "").trim().toLowerCase();
  const target = nextAccounts.find((account) => account.email.trim().toLowerCase() === email);
  const photoUrl = discovery?.photoUrl;

  if (!target || typeof photoUrl !== "string" || photoUrl.length === 0 || target.avatarSource === photoUrl) {
    return;
  }

  try {
    await cacheAvatar(target.id, photoUrl);
  } catch (error) {
    console.warn("Could not cache the Gmail profile photo.", error);
  }
}

async function pollUnread() {
  const settings = await loadSettings();

  if (!settings.unreadEnabled) {
    await saveUnread({});
    return;
  }

  const accounts = visibleAccounts(await loadAccounts());
  const entries = await Promise.all(
    accounts.map(async (account) => {
      const checkedAt = Date.now();

      try {
        const response = await fetch(unreadFeedUrl(account.authuser), { credentials: "include" });

        if (!response.ok) {
          return [account.id, { count: null, ok: false, checkedAt }];
        }

        const count = parseUnreadCount(await response.text());
        return [account.id, count === null ? { count: null, ok: false, checkedAt } : { count, ok: true, checkedAt }];
      } catch {
        return [account.id, { count: null, ok: false, checkedAt }];
      }
    }),
  );

  await saveUnread(Object.fromEntries(entries));
}

function scheduleUnreadPolling() {
  chrome.alarms.create(UNREAD_ALARM, { periodInMinutes: 5, delayInMinutes: 0 });
}

chrome.runtime.onInstalled.addListener(scheduleUnreadPolling);
chrome.runtime.onStartup.addListener(scheduleUnreadPolling);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === UNREAD_ALARM) {
    pollUnread().catch((error) => console.warn("Unread poll failed.", error));
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "account-discovered") {
    handleDiscovery(message)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        console.warn("Could not record the discovered account.", error);
        sendResponse({ ok: false });
      });
    return true;
  }

  if (message?.type === "unread-refresh") {
    pollUnread()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        console.warn("Unread refresh failed.", error);
        sendResponse({ ok: false });
      });
    return true;
  }

  return false;
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "open-picker") {
    return;
  }

  try {
    await chrome.action.openPopup();
  } catch {
    await chrome.tabs.create({ url: chrome.runtime.getURL("picker.html") });
  }
});
