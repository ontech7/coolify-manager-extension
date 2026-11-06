## Privacy Policy for Coolify Manager (Chrome Extension)

_Last updated: November 6, 2026_

## Overview

Coolify Manager is a browser extension that allows users to manage their cloud or self-hosted [Coolify](https://coolify.io/) applications directly from the browser. This privacy policy describes how the extension handles user data. All rights are 

## Data collection

Coolify Manager does **not** collect, transmit, or share any personal data with the developer or any third party. There are no analytics, telemetry, tracking scripts, or advertising frameworks embedded in the extension.

## Data stored by the extension

The extension stores the following information using Chrome's `storage.sync` API:

- **Server URLs** — one or more URLs of your self-hosted Coolify instances (e.g. `https://coolify.example.com`).
- **API Tokens** — the Coolify API tokens you provide for authentication (one per instance).
- **Instance Names** — user-defined labels for each saved Coolify instance.
- **Instance IDs** — auto-generated identifiers for managing multiple instances.
- **Coolify version mode** — whether each instance uses the API of Coolify before or after 4.2.0.
- **Active Instance ID** — which instance is currently selected.
- **User preferences** — settings such as the auto-refresh toggle state.

The extension supports managing multiple Coolify instances, allowing you to save and switch between different servers. This data, API tokens included, is synced by Chrome through your Google account to every Chrome browser signed in with sync enabled. The extension itself never sends it anywhere other than your own Coolify servers.

Temporary state is kept with Chrome's `storage.session` API, on this device and only until the browser closes:

- **Actions in progress** — which resources are starting, stopping or deploying.
- **Errors of finished actions** — the message of an action that failed after the popup closed, until it is shown.
- **Where the popup was** — the screen, tab, filter and search to go back to. This may include the names of your resources.

## Network communications

The extension communicates **exclusively** with the Coolify server URLs that you configure. These requests are made to the Coolify REST API (`/api/v1/...`) to perform the following operations:

- Detect the Coolify version and test the connection to your server.
- List, start, stop, restart, deploy and roll back applications.
- List, start, stop and restart databases, read their details and logs, list their scheduled backups and start a backup.
- List, start, stop and restart services and their containers, read their details and logs, and pull their latest images.
- List and validate servers, read their details and resources, restart their proxy and run a Docker cleanup.
- Retrieve application logs and deployment history, and cancel deployments.

With a token that has the optional `read:sensitive` permission, Coolify also returns database connection URLs, which contain passwords. They are only shown in the extension, with the password masked, and copied to your clipboard when you ask. They are not stored.

No data is sent to any other server, domain, or third-party service, with the exception noted below.

## External resources

The extension loads the "DM Sans" font from **Google Fonts** (`fonts.googleapis.com` and `fonts.gstatic.com`). This request includes your IP address and user agent but does not include any personal data or extension configuration. This is the only external connection made by the extension.

## Permissions

| Permission                                       | Purpose                                                                            |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `storage`                                        | Store your server URL, API token, and preferences, as described above.             |
| `host_permissions` (`http://*/*`, `https://*/*`) | Connect to your Coolify instance, which can be hosted on any domain or IP address. |

The broad host permission is required because Coolify is a self-hosted platform and each user's server address is different.

## Data sharing

Coolify Manager does **not** sell, transfer, or disclose any user data to third parties. No data leaves your browser except for:
- API requests sent directly to your own Coolify server(s).
- Font loading from Google Fonts (which only receives your IP address and user agent, no personal or configuration data).

## Data security

- Your API tokens are stored using Chrome's built-in `storage.sync` API, which other extensions and websites cannot read. It is not encrypted by the extension, and Chrome syncs it as described above.
- All communication with your Coolify servers uses the protocol you specify (HTTP or HTTPS). We recommend using HTTPS for a secure connection.
- The extension supports multiple server instances, each with its own isolated credentials.

## Changes to this policy

Any changes to this privacy policy will be reflected in this document with an updated date. Continued use of the extension after changes constitutes acceptance of the revised policy.

## Disclaimer

**Coolify** is a third-party platform owned and operated by its respective owners.  
**Coolify Manager** is an independent browser extension and is not affiliated with, endorsed by, or officially connected to Coolify.  
The extension acts solely as a client-side tool to provide a faster and more convenient way to interact with and manage existing Coolify instances configured by the user.  

## Contact

For privacy-related questions or requests, contact: losavio.business96@gmail.com
