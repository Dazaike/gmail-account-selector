# Gmail Account Selector

A streamlined Manifest V3 browser extension for switching between multiple Google / Gmail accounts effortlessly.

## Features

- **One-Click Account Switching:** Open any signed-in Gmail inbox directly by account index.
- **Customizable Display Names & Avatars:** Set custom labels and upload custom profile pictures without getting overwritten during automatic discovery.
- **Auto-Discovery:** Automatically detects signed-in accounts and profile pictures when you browse Gmail.
- **Layout & Sorting Preferences:** Choose between List and Grid card views, and sort accounts manually or by most recently used.
- **Quick Actions:** Jump straight to Compose, Google Calendar, or Google Drive for any account.
- **Unread Count Badges:** Optional background polling every 5 minutes to show unread inbox counts.
- **Backup & Restore:** Import and export your accounts and preferences as JSON.
- **Keyboard Shortcut:** Press `Alt+Shift+G` (customizable in browser settings) to trigger the account selector popup.

## Installation

### From Release Asset (Zip)
1. Download `gmail-account-selector-v1.2.6.zip` from the [Latest Release](https://github.com/Dazaike/gmail-account-selector/releases/latest).
2. Extract the ZIP archive to a folder on your computer.
3. Open your Chromium browser (Chrome, Brave, Edge, Opera, etc.) and navigate to the Extensions page (`chrome://extensions`).
4. Enable **Developer mode** using the toggle in the top-right corner.
5. Click **Load unpacked** and select the extracted folder.

### From Source
1. Clone this repository:
   ```sh
   git clone https://github.com/Dazaike/gmail-account-selector.git
   ```
2. Navigate to `chrome://extensions` in your browser.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the repository directory.

## Permissions

- `storage`: Saves your account configurations, custom avatars, and preferences locally.
- `alarms`: Schedules periodic polling for unread email counts if enabled.
- `host_permissions`: Accesses `mail.google.com` to discover active accounts and fetch unread feed status.
