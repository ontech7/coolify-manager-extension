## v1.5.0

### Features
- New popup with every feature on stacked screens: tabs with a sliding pill, skeleton loading, staggered list entrance, back button on each screen, and it reopens where you left it
- Expanded dashboard in a tab, with navigation, list and details in three columns; the arrows in the popup's header open it on the same screen, reusing its tab
- Resources header with a status summary, plus filters and search
- Deployment status on resources: "Deploying" after start, restart or deploy (click to open the live logs), "Starting" and "Stopping" for databases, services and stops; conflicting actions are disabled until Coolify catches up
- Deploy with optional Force Rebuild, then "Watch live"
- Live deployment view: build log tail refreshed every 3s, cancel from the header; "Show full log" once finished
- Rollback an application to a previous image (Coolify >= 4.3)
- Database details: engine, image, public port and connection URLs (password masked on screen, full URL copied; needs a token with `read:sensitive`)
- Database backups: scheduled backups with their last run (status, time, size) and a "Back up now" action (Coolify >= 4.2)
- Service details: containers with status, image and URLs, plus per-container restart, start/stop and logs (Coolify >= 4.2)
- Pull latest images for services
- Database logs and per-container service logs (Coolify >= 4.2), with live tail on every log
- Server quick actions: restart proxy and Docker cleanup (Coolify >= 4.3)
- Coolify version selector in settings, detected when testing the connection

### Fixes
- Actions use POST on Coolify >= 4.2, where start, stop, restart, deploy and validate no longer worked; older servers keep GET
- Actions finish even if the popup closes right after the click, and any error shows on the next open
- The list no longer flashes a spinner on every refresh: only what changed is redrawn, keeping scroll, focus and open dialogs
- "Couldn't refresh · Retry" banner when a refresh fails while older data is shown
- Refresh every 5s instead of 10s, pausing while hidden and refreshing on return; a slow answer can't overwrite a newer one
- Clear errors for timeouts, non-JSON responses from a login page or proxy, and endpoints missing on older servers
- Every value from the API is escaped, and only http and https links open

### Misc
- Automated tests with `node --test` and a mock Coolify server, with no dependencies in the extension
- `popup.js` split into shared screens used by the popup and the dashboard
- Requires Chrome 116 or newer
- README and privacy policy say that server URLs and tokens are in `chrome.storage.sync`, and so follow the Chrome account

## v1.4.0

- Add unified Resources view for applications, databases and services
- Add per-application deployment history
- Add Servers tab with health status and server detail
- Add build logs to deployment details
- Add copy-to-clipboard for UUIDs, repositories and IPs
- Split multi-domain URLs into separate links
- Add disclaimer to the options page
- Normalize deployment status labels

## v1.3.0

- Add multiple Coolify instance management in settings
- Add CSS variables for better maintainability
- Added Github Action for building .zip file
- Align user interface design to the App counterpart
- Move storage logic to `coolify-storage.js`
- Adjust Lucide icons
- Update PRIVACY.md with latest changes

## v1.2.0

- Add cancel deployment button
- Add external link to application
- Add 'Open in Coolify' link to footer
- Add auto-refresh every 10s to footer

## v1.1.0

- Add deployments management features
- Add apps and deployment detail modals

## v1.0.0

- First release with available Applications
