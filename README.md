<p align="center">
  <img src="assets/icon-128.png" alt="Coolify Manager Logo" width="96" height="96">
</p>

<h1 align="center">Coolify Manager</h1>

<p align="center">
  A Chrome extension to manage your <a href="https://coolify.io/">Coolify</a> applications directly from your browser.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white" alt="Chrome Extension">
  <img src="https://img.shields.io/badge/Manifest-V3-green" alt="Manifest V3">
  <img src="https://img.shields.io/badge/License-MIT-blue" alt="License">
</p>

<p align="center">
  <img src="assets/screenshot.png" alt="Coolify Manager Screenshot" width="600">
</p>

## Features

- **Application List** - View all your Coolify applications
- **Status Monitoring** - Real-time status display (Running, Stopped, Healthy, Unhealthy)
- **Quick Actions** - Start, Stop, Restart, and Deploy applications with one click
- **Log Viewer** - View application logs directly from the popup
- **Notifications** - Get notified when deployments complete or fail
- **Secure** - Your API token is stored securely in Chrome's sync storage

## Installation

### From Chrome Web Store

### From Source (Developer Mode)

1. Clone this repository:

   ```bash
   git clone https://github.com/ontech7/coolify-manager-extension.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable **Developer mode** (toggle in the top right corner)

4. Click **Load unpacked** and select the cloned folder

5. The extension icon will appear in your toolbar

## Configuration

### 1. Enable Coolify API Access

1. Open your Coolify dashboard
2. Go to **Settings → Advanced → API Access**
3. Enable the API

### 2. Generate an API Token

1. Go to **Keys & Tokens → API Tokens**
2. Create a new token with the following permissions:
   - `read` - To list and view applications
   - `write` - To start, stop, and restart applications
   - `deploy` - To trigger deployments
3. Copy the token (it will only be shown once)

### 3. Configure the Extension

1. Click the Coolify Manager icon in your browser toolbar
2. Click **Configure** or go to **Settings**
3. Enter your Coolify server URL (e.g., `https://coolify.example.com`, `http://192.168.1.8:4000`, `http://10.0.0.5:8000`)
4. Paste your API token
5. Click **Test Connection** to verify
6. Click **Save Configuration**

## Usage

### Application List

Click the extension icon to see all your applications. Each application shows:

- Name and description
- Current status (with color indicator)
- Action buttons

### Actions

| Action      | Description                  |
| ----------- | ---------------------------- |
| **Start**   | Start a stopped application  |
| **Stop**    | Stop a running application   |
| **Restart** | Restart the application      |
| **Deploy**  | Trigger a new deployment     |
| **Logs**    | View recent application logs |

### Notifications

Enable notifications in Settings to receive alerts when:

- Deployments complete successfully
- Deployments fail
- Applications change status

## API Endpoints Used

| Method | Endpoint                       | Description             |
| ------ | ------------------------------ | ----------------------- |
| GET    | `/applications`                | List all applications   |
| GET    | `/applications/{uuid}`         | Get application details |
| GET    | `/applications/{uuid}/start`   | Start application       |
| GET    | `/applications/{uuid}/stop`    | Stop application        |
| GET    | `/applications/{uuid}/restart` | Restart application     |
| GET    | `/deploy?uuid={uuid}`          | Deploy application      |
| GET    | `/applications/{uuid}/logs`    | Get application logs    |

## Requirements

- Google Chrome (or Chromium-based browser)
- Coolify server with API access enabled
- API token with `read`, `write`, and `deploy` permissions

## Privacy

This extension:

- Only communicates with your configured Coolify server
- Stores configuration in Chrome's sync storage
- Does not collect or send any analytics
- Does not track user behavior

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feat/<feature-name>`)
3. Commit your changes (`git commit -m <commit-message>`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

## License & Credits

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Created by Andrea Losavio • [LinkedIn](https://www.linkedin.com/in/andrea-losavio/) - [Website](https://andrealosavio.com)

## Acknowledgments

- [Coolify](https://coolify.io/) - The amazing self-hostable Heroku/Netlify alternative
- [Lucide](https://lucide.dev/) - Open-source library for icons

---

Made with ❤️ for the Coolify community
