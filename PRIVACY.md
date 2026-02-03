## Privacy Policy for Coolify Manager (Chrome Extension)

_Last updated: February 3, 2026_

## Overview

Coolify Manager is a browser extension that allows users to manage their cloud or self-hosted [Coolify](https://coolify.io/) applications directly from the browser. This privacy policy describes how the extension handles user data. All rights are 

## Data collection

Coolify Manager does **not** collect, transmit, or share any personal data with the developer or any third party. There are no analytics, telemetry, tracking scripts, or advertising frameworks embedded in the extension.

## Data stored locally

The extension stores the following information locally on your device using Chrome's `storage.sync` API:

- **Server URL** — the URL of your self-hosted Coolify instance (e.g. `https://coolify.example.com`).
- **API Token** — the Coolify API token you provide for authentication.
- **User preferences** — settings such as the auto-refresh toggle state.

This data is synced across your Chrome browsers if you are signed into Chrome with sync enabled. It is never sent anywhere other than your own Coolify server.

## Network communications

The extension communicates **exclusively** with the Coolify server URL that you configure. These requests are made to the Coolify REST API (`/api/v1/...`) to perform the following operations:

- List, start, stop, restart, and deploy applications.
- Retrieve application logs and deployment history.
- Test the connection to your server.

No data is sent to any other server, domain, or third-party service.

## Permissions

| Permission                                       | Purpose                                                                            |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `storage`                                        | Store your server URL, API token, and preferences locally.                         |
| `host_permissions` (`http://*/*`, `https://*/*`) | Connect to your Coolify instance, which can be hosted on any domain or IP address. |

The broad host permission is required because Coolify is a self-hosted platform and each user's server address is different.

## Data sharing

Coolify Manager does **not** sell, transfer, or disclose any user data to third parties. No data leaves your browser except for the API requests sent directly to your own Coolify server.

## Data security

- Your API token is stored using Chrome's built-in `storage.sync` API, which is sandboxed to the extension.
- All communication with your Coolify server uses the protocol you specify (HTTP or HTTPS). We recommend using HTTPS for a secure connection.

## Changes to this policy

Any changes to this privacy policy will be reflected in this document with an updated date. Continued use of the extension after changes constitutes acceptance of the revised policy.

## Disclaimer

**Coolify** is a third-party platform owned and operated by its respective owners.  
**Coolify Manager** is an independent browser extension and is not affiliated with, endorsed by, or officially connected to Coolify.  
The extension acts solely as a client-side tool to provide a faster and more convenient way to interact with and manage existing Coolify instances configured by the user.  

## Contact

For privacy-related questions or requests, contact: losavio.business96@gmail.com
