# DeepBrief

A polished, mobile-friendly research notebook made with plain HTML, CSS, and JavaScript. No build step, account, API key, CDN, or backend required. Your research lives in your browser’s local storage. Optional topic searches fetch public results only when you submit a search.

## Preview

From this directory, run:

```sh
npm run dev
```

Open **http://localhost:3000**. Node.js 18 or later is sufficient; no installation is needed to run the app. Alternatively, use `python3 -m http.server 3000` from this directory.

To preview on an iPhone on the same Wi-Fi network, open `http://<your-computer-LAN-IP>:3000` in Safari. The Node preview server listens on all interfaces; use a trusted local network. You can also copy the five static files (`index.html`, `styles.css`, `app.js`, `research.js`, `icon.svg`) to any static host. Use a consistent URL when reopening: local storage belongs to each browser and origin (scheme, host, and port).

Opening `index.html` directly may work in some desktop browsers, but file URL storage behavior varies. The local server is recommended.

## Use your notebook

- **New brief** opens an editor for a title, topic, status, research question, summary, claims, evidence, sources, and unanswered questions. Save explicitly with **Save brief**. Closing a changed editor prompts before discarding.
- Claims, evidence, and unanswered questions use one item per line. Cite sources with numbers such as `[1]` in your evidence.
- Enter sources as `Title | https://example.com`, one per line. A title without a URL is also supported. Only HTTP and HTTPS links are accepted.
- Open a brief by selecting its title. Use **Edit brief** to write or **Find sources** to research. Markdown export, pinning, and deletion are in **More**.
- **Find a saved brief** searches all your saved fields and sources. **Filter & sort** contains status filters, ordering, and the grid/list switch. Pinned briefs are available in the workspace navigation. Press `/` to find a saved brief; press Escape to close an open menu.
- Under **Notebook options**, **Export backup** downloads the whole notebook as versioned JSON. **Import backup** validates the entire file before adding anything. Identical briefs are skipped. A changed brief with an existing ID is imported as a separate copy, preserving both versions. Imports never replace or delete existing work. Maximum backup size: 10 MB, 1,000 briefs per import.
- **Markdown** exports an individual brief, including all six research sections and linked sources. Brief text is treated as plain text; Markdown syntax is escaped on export.

The Monroe Institute sample appears on the first visit only. It separates first-party descriptions, a historical declassified report, and research on binaural beats, with explicit limitations and questions for further investigation. It is a demonstration, not an exhaustive scientific review.

## Find and capture research

1. Tap **Find sources** on a card, or the small **Search** action beside a field in a saved brief or the editor.
2. Enter a topic and tap **Search**. All four sources are searched by default: Wikipedia, Crossref, Europe PMC, and Open Library. **Search options** lets you choose one source if you want to narrow the search.
3. Tap **Add to brief** on a result. Its excerpt and citation are appended to the field shown in **Save to**. Results without an excerpt add a source link only.

Results from different providers are mixed in relevance order within each source, with up to three records per provider for all-source searches. A provider failure does not discard other providers' results. The app reports partial failures and allows retrying or choosing another source. It searches public indexes, not the entire web.

**Edit text** lets you read the full excerpt, shorten it, or write a note (up to 2,000 characters). Clear it to save only the link. Imported text remains labeled as an unreviewed excerpt or edited note and includes a numbered citation, provider, and retrieval date. Wikipedia excerpts also include contributor/license attribution. Repeated imports to the same field are skipped, and matching URLs reuse source numbers.

For a passage from another website, choose **Paste a link**, paste the link and your text, then tap **Add to brief**. The title is optional and defaults to the website name. Both modes retain your unsaved text while you switch between them. Closing the picker or replacing edited search results prompts before discarding text.

The destination stays visible in **Save to** at the top of the picker. Field shortcuts preselect that field. Short field text may be used as a starting query; otherwise the brief title is used. Nothing is sent until you submit. Searches from an editor add findings to its draft; **Save brief** keeps them. Searches from a saved brief persist findings immediately.

Public API searches need internet access and are subject to provider availability, rate limits, and browser CORS policies. Requests time out after 12 seconds. Closing or switching away from an active search cancels it. The app does not scrape arbitrary websites, bypass paywalls, or generate an AI synthesis. GitHub Pages needs no server configuration.

Provider references: [MediaWiki anonymous cross-origin requests](https://www.mediawiki.org/wiki/API:Cross-site_requests#Unauthenticated_CORS_Requests) and [Crossref public API access](https://www.crossref.org/documentation/retrieve-metadata/rest-api/access-and-authentication/).

## Local storage and privacy

The app makes no background search requests. When you submit an external search, only the submitted topic is sent to the selected sources (all four by default: Wikipedia, Crossref, Europe PMC, and Open Library), together with normal connection information such as your IP address. Search requests omit cookies and the referring page URL. Your saved summary, claims, evidence, and notebook are not sent. Source links open externally only when selected. There is no cross-device sync. Browser data clearing, private browsing, changing origins, or uninstalling a browser can remove access to research. Export JSON backups regularly, particularly before switching devices. JSON files can contain your private research; store them appropriately.

Saves report storage failures rather than claiming success. If stored data cannot be read, saving is disabled to preserve that data. Other tabs of the same origin receive saved updates; avoid editing the same brief simultaneously in multiple tabs because the last saved version wins.

## Tests

Only the test tooling requires dependencies (Node.js 20 or later):

```sh
npm install
npx playwright install chromium
npm test
```

The suite uses an installed `/usr/bin/chromium` when available, otherwise Playwright’s Chromium. Set `CHROMIUM_PATH` to use another Chromium executable. It serves local app files with Playwright’s in-process HTTP fixtures by default, so no listening server or external service is required. Set `APP_URL` to test an already running server instead.

Tests cover creating, editing, deleting, reopening, full-text search, filters, pinning, Markdown contents, JSON backup restoration, invalid JSON, unsafe URLs, import conflicts, plain-text HTML handling, keyboard dialog dismissal, empty-notebook persistence, storage failures, and horizontal overflow at widths from 320 to 1440 pixels. The research suite additionally covers correct-card imports, citation numbering, duplicates, excerpts and source-only records, omitted cookies, explicit query submission, manual capture, save failures, exported provenance, unsafe result URLs/markup, empty results, provider errors, rate limits, unreadable JSON, offline requests, timeouts, cancellation, dialog layouts, all-source search, partial provider failures, one-tap imports, edited and cleared excerpts, mode switching, and title-free source capture. Screenshots are written to the ignored `test-results/` directory.

Search tests use controlled provider API responses, so the suite needs no external network. Live provider access could not be verified in the managed environment because outbound access to those domains is blocked; real iOS Safari was not tested.

## Files

- `index.html` — accessible dashboard, brief editor, and dialogs
- `styles.css` — responsive paper-and-sage design, including iPhone layouts
- `app.js` — notebook, storage, validation, import/export, and sample research
- `research.js` — external search, result previews, manual capture, and request lifecycle
- `icon.svg` — local app icon
- `server.cjs` — optional dependency-free development server
- `tests/browser.cjs` — notebook browser regression suite
- `tests/research.cjs` — research integration and failure-state regression suite

No build or backend is required for deployment. This project does not register a service worker; offline use after closing a hosted page depends on the browser cache. The local preview works without internet access.
