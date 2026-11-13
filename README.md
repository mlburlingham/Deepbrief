# DeepBrief

A polished, mobile-friendly research notebook made with plain HTML, CSS, and JavaScript. No build step, account, API, CDN, or external runtime dependency. Your research lives in your browser’s local storage.

## Preview

From this directory, run:

```sh
npm run dev
```

Open **http://localhost:3000**. Node.js 18 or later is sufficient; no installation is needed to run the app. Alternatively, use `python3 -m http.server 3000` from this directory.

To preview on an iPhone on the same Wi-Fi network, open `http://<your-computer-LAN-IP>:3000` in Safari. The Node preview server listens on all interfaces; use a trusted local network. You can also copy the four static files (`index.html`, `styles.css`, `app.js`, `icon.svg`) to any static host. Use a consistent URL when reopening: local storage belongs to each browser and origin (scheme, host, and port).

Opening `index.html` directly may work in some desktop browsers, but file URL storage behavior varies. The local server is recommended.

## Use your notebook

- **New brief** opens an editor for a title, topic, status, research question, summary, claims, evidence, sources, and unanswered questions. Save explicitly with **Save brief**. Closing a changed editor prompts before discarding.
- Claims, evidence, and unanswered questions use one item per line. Cite sources with numbers such as `[1]` in your evidence.
- Enter sources as `Title | https://example.com`, one per line. A title without a URL is also supported. Only HTTP and HTTPS links are accepted.
- Open a brief by selecting its title; edit, export Markdown, pin, or delete it from the detail view.
- Search covers all brief fields and sources. Filter by status or pinned briefs, sort by title or dates, and switch between grid and list layouts. Press `/` to focus search.
- **Export backup** downloads the whole notebook as versioned JSON. **Import backup** validates the entire file before adding anything. Identical briefs are skipped. A changed brief with an existing ID is imported as a separate copy, preserving both versions. Imports never replace or delete existing work. Maximum backup size: 10 MB, 1,000 briefs per import.
- **Markdown** exports an individual brief, including all six research sections and linked sources. Brief text is treated as plain text; Markdown syntax is escaped on export.

The Monroe Institute sample appears on the first visit only. It separates first-party descriptions, a historical declassified report, and research on binaural beats, with explicit limitations and questions for further investigation. It is a demonstration, not an exhaustive scientific review.

## Local storage and privacy

The app sends no research anywhere and makes no background network requests. Source links open externally only when selected. There is no cross-device sync. Browser data clearing, private browsing, changing origins, or uninstalling a browser can remove access to research. Export JSON backups regularly, particularly before switching devices. JSON files can contain your private research; store them appropriately.

Saves report storage failures rather than claiming success. If stored data cannot be read, saving is disabled to preserve that data. Other tabs of the same origin receive saved updates; avoid editing the same brief simultaneously in multiple tabs because the last saved version wins.

## Tests

Only the test tooling requires dependencies (Node.js 20 or later):

```sh
npm install
npx playwright install chromium
npm test
```

The suite uses an installed `/usr/bin/chromium` when available, otherwise Playwright’s Chromium. Set `CHROMIUM_PATH` to use another Chromium executable. It serves local app files with Playwright’s in-process HTTP fixtures by default, so no listening server or external service is required. Set `APP_URL` to test an already running server instead.

Tests cover creating, editing, deleting, reopening, full-text search, filters, pinning, Markdown contents, JSON backup restoration, invalid JSON, unsafe URLs, import conflicts, plain-text HTML handling, keyboard dialog dismissal, empty-notebook persistence, storage failures, and horizontal overflow at widths from 320 to 1440 pixels. Screenshots are written to the ignored `test-results/` directory.

## Files

- `index.html` — accessible dashboard, brief editor, and dialogs
- `styles.css` — responsive paper-and-sage design, including iPhone layouts
- `app.js` — notebook, storage, validation, import/export, and sample research
- `icon.svg` — local app icon
- `server.cjs` — optional dependency-free development server
- `tests/browser.cjs` — browser regression suite

No build or backend is required for deployment. This project does not register a service worker; offline use after closing a hosted page depends on the browser cache. The local preview works without internet access.
