// Content script: cannot be an ES module, so parseAccountLabel is duplicated
// from src/accounts.js (the tested source of truth). Keep the bodies identical.
function parseAccountLabel(ariaLabel) {
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

(function discoverGmailAccount() {
  const match = /^\/mail\/u\/(\d+)/.exec(location.pathname);

  if (!match) {
    return;
  }

  const authuser = Number(match[1]);
  const ATTEMPTS = 60;
  const INTERVAL_MS = 500;

  function readLabelled() {
    const labelled = document.querySelectorAll('[aria-label*="Google Account"], [aria-label*="@"]');

    for (const element of labelled) {
      const parsed = parseAccountLabel(element.getAttribute("aria-label"));

      if (parsed) {
        return { ...parsed, element };
      }
    }

    return null;
  }

  function readPhotoUrl(element) {
    const scoped = element?.querySelector("img[src]")?.src;

    if (scoped) {
      return scoped;
    }

    for (const image of document.querySelectorAll("img[src*='googleusercontent.com']")) {
      // Profile pictures are square and small; skip inline mail content images.
      if (image.naturalWidth === 0 || Math.abs(image.naturalWidth - image.naturalHeight) <= 2) {
        return image.src;
      }
    }

    return null;
  }

  function readAccount() {
    const labelled = readLabelled();

    if (labelled) {
      return {
        email: labelled.email,
        displayName: labelled.displayName,
        photoUrl: readPhotoUrl(labelled.element),
      };
    }

    const titled = /[\w.+-]+@[\w.-]+\.\w+/.exec(document.title);

    if (titled) {
      return { email: titled[0], displayName: "", photoUrl: readPhotoUrl(null) };
    }

    return null;
  }

  let reportedEmail = null;
  let reportedPhotoUrl = null;

  function report(account) {
    reportedEmail = account.email;
    reportedPhotoUrl = account.photoUrl;
    chrome.runtime
      .sendMessage({
        type: "account-discovered",
        email: account.email,
        displayName: account.displayName,
        authuser,
        photoUrl: account.photoUrl,
      })
      .catch(() => {});
  }

  // The email usually resolves from document.title long before the header
  // avatar mounts, so keep scanning until a photo shows up (or the budget runs
  // out) and report again once it does.
  function scan() {
    const account = readAccount();

    if (!account) {
      return false;
    }

    const isNewEmail = account.email !== reportedEmail;
    const isNewPhoto = Boolean(account.photoUrl) && account.photoUrl !== reportedPhotoUrl;

    if (isNewEmail || isNewPhoto) {
      report(account);
    }

    return Boolean(reportedEmail) && Boolean(reportedPhotoUrl);
  }

  if (scan()) {
    return;
  }

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;

    if (scan() || attempts >= ATTEMPTS) {
      clearInterval(timer);
    }
  }, INTERVAL_MS);
})();
