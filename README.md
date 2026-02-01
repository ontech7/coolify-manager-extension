<p align="center">
  <img src="assets/icon-128.png" alt="Coolify Manager Logo" width="96" height="96">
</p>

<h1 align="center">Coolify Manager</h1>

<p align="center">
  A Chrome extension to manage your <a href="https://coolify.io/">Coolify</a> applications directly from your browser.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Chrome-Extension-DD5144?logo=googlechrome&logoColor=white" alt="Chrome Extension">
 <img src="https://img.shields.io/badge/v-1.2.0-blue" alt="App Version">
  <img src="https://img.shields.io/badge/License-MIT-61dafb" alt="License">
</p>

<p align="center">
  <img src="assets/screenshot.png" alt="Coolify Manager Screenshot" width="600">
</p>

## Highlights

- Real-time overview of every Coolify application with status, FQDN, and repository metadata.
- One-click controls for start, stop, restart, deploy, and log streaming.
- Deployment history with commit details, runtime status, and quick drill-down.
- Secure storage for server URL and API token via Chrome's sync storage.

## Quick Start

### From Chrome Web Store

_(wait for approval)_

### From Source (Developer Mode)

1. Clone this repository:
   ```bash
   git clone https://github.com/ontech7/coolify-manager-extension.git
   ```
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top right corner)
4. Click **Load unpacked** and select the cloned folder

## Configure Your Server

1. Enable API Access in Coolify (Settings → Advanced → API Access).
2. Create an API token with `read`, `write`, and `deploy` permissions.
3. In the extension, open Settings, enter the server URL (https://coolify.example.com), paste the token, test the connection, and save.

## License & Credits

MIT License. See [LICENSE](LICENSE).

Built by Andrea Losavio • [LinkedIn](https://www.linkedin.com/in/andrea-losavio/) – [Website](https://andrealosavio.com)

## Acknowledgments

- [Coolify](https://coolify.io/) - The amazing self-hostable Heroku/Netlify alternative
- [Lucide](https://lucide.dev/) - Open-source library for icons

---

Made with ❤️ for the Coolify community
