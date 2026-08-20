import {
  avatarHue,
  createAccountId,
  initialsFor,
  loadAccounts,
  loadSettings,
  normalizeAccount,
  parseBackup,
  saveAccounts,
  saveSettings,
  validateAccount,
} from "./accounts.js";

const form = document.querySelector("#account-form");
const formTitle = document.querySelector("#form-title");
const labelInput = document.querySelector("#label");
const emailInput = document.querySelector("#email");
const authuserInput = document.querySelector("#authuser");
const formError = document.querySelector("#form-error");
const cancelEdit = document.querySelector("#cancel-edit");
const accountList = document.querySelector("#saved-account-list");
const loadError = document.querySelector("#load-error");
const status = document.querySelector("#status");
const orderRadios = document.querySelectorAll('input[name="order"]');
const layoutRadios = document.querySelectorAll('input[name="layout"]');
const unreadEnabled = document.querySelector("#unread-enabled");
const exportButton = document.querySelector("#export-accounts");
const importInput = document.querySelector("#import-file");
const clearButton = document.querySelector("#clear-accounts");
const toast = document.querySelector("#toast");
const toastMessage = document.querySelector("#toast-message");
const toastUndo = document.querySelector("#toast-undo");

let accounts = [];
let editingId = null;
let toastTimer = null;
let undoSnapshot = null;
let focusHandleIndex = null;

function showFormError(message = "") {
  formError.textContent = message;
  formError.hidden = !message;
}

function resetForm() {
  editingId = null;
  form.reset();
  formTitle.textContent = "Add account";
  cancelEdit.hidden = true;
  showFormError();
}

function startEditing(account) {
  editingId = account.id;
  labelInput.value = account.label;
  emailInput.value = account.email;
  authuserInput.value = String(account.authuser);
  formTitle.textContent = "Edit account";
  cancelEdit.hidden = false;
  showFormError();
  labelInput.focus();
}

function hideToast() {
  clearTimeout(toastTimer);
  toastTimer = null;

  undoSnapshot = null;
  toast.hidden = true;
  toastMessage.textContent = "";
}

function showToast(message, snapshot) {
  clearTimeout(toastTimer);

  undoSnapshot = snapshot;
  toastMessage.textContent = message;
  toast.hidden = false;
  toastTimer = setTimeout(hideToast, 8000);
}

function countBy(items, key) {
  const counts = new Map();

  for (const item of items) {
    const value = key(item);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return counts;
}

function renderAvatar(account) {
  const avatar = document.createElement("span");
  avatar.className = "avatar";

  if (account.avatar) {
    const image = document.createElement("img");
    image.className = "avatar-img";
    image.alt = "";
    image.src = account.avatar;
    avatar.append(image);
    return avatar;
  }

  avatar.textContent = initialsFor(account.label);
  avatar.style.background = `hsl(${avatarHue(account.email)} 55% 30%)`;
  return avatar;
}

function renderAccounts() {
  accountList.replaceChildren();

  const emailCounts = countBy(accounts, (account) => account.email.trim().toLowerCase());
  const indexCounts = countBy(accounts, (account) => account.authuser);

  accounts.forEach((account, index) => {
    const item = document.createElement("li");
    const handle = document.createElement("span");
    const details = document.createElement("div");
    const label = document.createElement("strong");
    const email = document.createElement("span");
    const actions = document.createElement("div");
    const edit = document.createElement("button");
    const hide = document.createElement("button");
    const remove = document.createElement("button");

    item.className = account.hidden ? "saved-account is-hidden" : "saved-account";
    item.draggable = true;
    item.dataset.index = String(index);
    details.className = "saved-account-details";
    email.className = "account-email";
    actions.className = "account-actions";

    handle.className = "drag-handle";
    handle.textContent = "⠿";
    handle.tabIndex = 0;
    handle.setAttribute("role", "button");
    handle.setAttribute("aria-label", `Reorder ${account.label}`);
    handle.addEventListener("keydown", (event) => {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        focusHandleIndex = index - 1;
        moveAccount(index, index - 1);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        focusHandleIndex = index + 1;
        moveAccount(index, index + 1);
      }
    });

    edit.className = "button button-secondary";
    edit.type = "button";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => startEditing(account));

    hide.className = "button button-secondary";
    hide.type = "button";
    hide.textContent = account.hidden ? "Show" : "Hide";
    hide.setAttribute("aria-label", `${account.hidden ? "Show" : "Hide"} ${account.label} in the picker`);
    hide.addEventListener("click", () => toggleHidden(account.id));

    remove.className = "button button-danger";
    remove.type = "button";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => removeAccount(account.id));

    label.textContent = account.label;
    email.textContent = `${account.email} · Gmail account index ${account.authuser}`;
    details.append(label, email);

    if (account.hidden) {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = "Hidden";
      label.append(" ", chip);
    }

    if (indexCounts.get(account.authuser) > 1) {
      const warning = document.createElement("p");
      warning.className = "row-warning";
      warning.textContent = `Duplicate Gmail index ${account.authuser}: only one of these opens the mailbox you expect.`;
      details.append(warning);
    }

    if (emailCounts.get(account.email.trim().toLowerCase()) > 1) {
      const warning = document.createElement("p");
      warning.className = "row-warning";
      warning.textContent = "Duplicate email address.";
      details.append(warning);
    }

    if (account.avatar) {
      const removePhoto = document.createElement("button");
      removePhoto.className = "button button-secondary";
      removePhoto.type = "button";
      removePhoto.textContent = "Remove photo";
      removePhoto.addEventListener("click", () => removePhotoFor(account.id));
      actions.append(removePhoto);
    } else {
      const help = document.createElement("p");
      help.className = "field-help";
      help.textContent = "No photo yet — open this account in Gmail once.";
      details.append(help);
    }

    actions.append(edit, hide, remove);
    item.append(handle, renderAvatar(account), details, actions);

    item.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", String(index));
      event.dataTransfer.effectAllowed = "move";
    });
    item.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      item.classList.add("drop-target");
    });
    item.addEventListener("dragleave", () => item.classList.remove("drop-target"));
    item.addEventListener("dragend", () => item.classList.remove("drop-target"));
    item.addEventListener("drop", (event) => {
      event.preventDefault();
      item.classList.remove("drop-target");
      const from = Number(event.dataTransfer.getData("text/plain"));

      if (Number.isInteger(from)) {
        moveAccount(from, index);
      }
    });

    accountList.append(item);
  });

  if (focusHandleIndex !== null) {
    const handles = accountList.querySelectorAll(".drag-handle");
    handles[focusHandleIndex]?.focus();
    focusHandleIndex = null;
  }
}

async function moveAccount(index, targetIndex) {
  if (targetIndex < 0 || targetIndex >= accounts.length || targetIndex === index) {
    focusHandleIndex = null;
    return;
  }

  const nextAccounts = [...accounts];
  const [moved] = nextAccounts.splice(index, 1);
  nextAccounts.splice(targetIndex, 0, moved);
  await persist(nextAccounts);
}

async function persist(nextAccounts) {
  try {
    await saveAccounts(nextAccounts);
  } catch (error) {
    console.error("Could not save Gmail accounts.", error);
    showFormError("Could not save accounts. Try again.");
    return false;
  }

  accounts = nextAccounts;
  renderAccounts();
  resetForm();
  status.textContent = "Saved.";
  return true;
}

async function removeAccount(id) {
  const account = accounts.find((entry) => entry.id === id);
  const snapshot = accounts;
  const nextAccounts = accounts.filter((entry) => entry.id !== id);

  if (await persist(nextAccounts) && account) {
    showToast(`Removed ${account.label}.`, snapshot);
  }
}

async function toggleHidden(id) {
  await persist(accounts.map((account) => (account.id === id ? { ...account, hidden: !account.hidden } : account)));
}

async function removePhotoFor(id) {
  await persist(
    accounts.map((account) => (account.id === id ? { ...account, avatar: null, avatarSource: null } : account)),
  );
}

function applySettings(settings) {
  for (const radio of orderRadios) {
    radio.checked = radio.value === settings.order;
  }

  for (const radio of layoutRadios) {
    radio.checked = radio.value === settings.layout;
  }

  unreadEnabled.checked = settings.unreadEnabled;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  status.textContent = "";

  let values;
  try {
    values = validateAccount({
      label: labelInput.value,
      email: emailInput.value,
      authuser: authuserInput.value,
    });
  } catch (error) {
    showFormError(error.message);
    return;
  }

  const nextAccounts = editingId
    ? accounts.map((account) => (account.id === editingId ? { ...account, ...values } : account))
    : [...accounts, normalizeAccount({ id: createAccountId(), ...values })];

  await persist(nextAccounts);
});

cancelEdit.addEventListener("click", resetForm);

toastUndo.addEventListener("click", async () => {
  const snapshot = undoSnapshot;
  hideToast();

  if (snapshot) {
    await persist(snapshot);
  }
});

for (const [radios, key] of [
  [orderRadios, "order"],
  [layoutRadios, "layout"],
]) {
  for (const radio of radios) {
    radio.addEventListener("change", async () => {
      if (radio.checked) {
        applySettings(await saveSettings({ [key]: radio.value }));
        status.textContent = "Saved.";
      }
    });
  }
}

unreadEnabled.addEventListener("change", async () => {
  applySettings(await saveSettings({ unreadEnabled: unreadEnabled.checked }));
  chrome.runtime.sendMessage({ type: "unread-refresh" }).catch(() => {});
  status.textContent = "Saved.";
});

clearButton.addEventListener("click", async () => {
  if (accounts.length === 0) {
    status.textContent = "Nothing to clear.";
    return;
  }

  const count = accounts.length;

  if (!window.confirm(`Remove all ${count} saved account${count === 1 ? "" : "s"}?`)) {
    return;
  }

  const snapshot = accounts;

  if (await persist([])) {
    showToast(`Cleared ${count} account${count === 1 ? "" : "s"}.`, snapshot);
  }
});

exportButton.addEventListener("click", async () => {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    accounts,
    settings: await loadSettings(),
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "gmail-account-selector-backup.json";
  link.click();
  URL.revokeObjectURL(url);
});

importInput.addEventListener("change", async () => {
  const file = importInput.files?.[0];
  importInput.value = "";

  if (!file) {
    return;
  }

  let imported;
  try {
    imported = parseBackup(await file.text());
  } catch (error) {
    showFormError(error.message);
    return;
  }

  if (!window.confirm("Replace all saved accounts with the imported list?")) {
    return;
  }

  showFormError();
  applySettings(await saveSettings(imported.settings));
  await persist(imported.accounts);
});

try {
  const [loadedAccounts, settings] = await Promise.all([loadAccounts(), loadSettings()]);
  accounts = loadedAccounts;
  applySettings(settings);
  renderAccounts();
} catch (error) {
  console.error("Could not load Gmail accounts.", error);
  loadError.textContent = "Could not load accounts. Try reloading this page.";
  loadError.hidden = false;
}
