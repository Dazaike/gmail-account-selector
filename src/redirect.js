const SOURCE_URL = "https://example.com/BDKWHW7";

if (window.location.href === SOURCE_URL) {
  window.location.replace(chrome.runtime.getURL("picker.html"));
}
