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
- Open a brief by selecting its title; edit, export Markdown, pin, or delete it from the detail view.
- Search covers all brief fields and sources. Filter by status or pinned briefs, sort by title or dates, and switch between grid and list layouts. Press `/` to focus search.
- **Export backup** downloads the whole notebook as versioned JSON. **Import backup** validates the entire file before adding anything. Identical briefs are skipped. A changed brief with an existing ID is imported as a separate copy, preserving both versions. Imports never replace or delete existing work. Maximum backup size: 10 MB, 1,000 briefs per import.
- **Markdown** exports an individual brief, including all six research sections and linked sources. Brief text is treated as plain text; Markdown syntax is escaped on export.

The Monroe Institute sample appears on the first visit only. It separates first-party descriptions, a historical declassified report, and research on binaural beats, with explicit limitations and questions for further investigation. It is a demonstration, not an exhaustive scientific review.

## Find and capture research

1. Tap **Find sources** on a brief card, beside any research field in an open brief, or in the editor. Field buttons preselect that field and use its text as the starting query. Review the query before submitting.
2. Adjust the topic, then tap **Search**. The title is prefilled, but nothing is sent until you submit.
3. Choose **Wikipedia** for background, **Crossref** for publication metadata, **Europe PMC** for biomedical articles and abstracts, or **Open Library** for book records.
4. Choose a destination field, then tap **Add text + source** on a result to save it immediately. For several results, select them (or use **Select all**) and tap **Add selected**. The destination stays visible in the footer while you scroll. Findings from an open saved brief are saved immediately to that brief. Findings from the editor are added to the current draft; use **Save brief** to keep them.

Existing notes are preserved. Every imported excerpt is labeled **Unreviewed excerpt** (or **Unreviewed edited note** if you change the text), and includes a numbered citation, provider, and retrieval date. Wikipedia excerpts also carry contributor/license attribution. Source numbers reuse existing URLs where possible, and repeated imports of the same excerpt to the same destination do not add duplicates. Use **Edit text before adding** to shorten an excerpt or write your own note, up to 2,000 characters. Clearing the text saves only its source link. Results without an excerpt offer **Add source** and an option to write a note; no summary is invented. Unsaved text edits prompt before they are discarded. You can explicitly add research notes to the question, claims, or unanswered questions as well. These remain labeled as imported notes for your review; the app does not generate new claims or questions.

**Search the web** (DuckDuckGo) opens your current search in a separate tab. For any result you find there, tap **Paste source** on the brief card or **Paste a source** in the picker. Paste its URL and a passage or note; the title is optional and defaults to the website name. This saves to the same selected brief. DeepBrief does not scrape arbitrary websites or bypass paywalls. It does not generate an AI synthesis or perform a full-web search inside the panel.

Public API searches require internet access and are subject to provider availability, rate limits, and browser CORS policies. Failed searches show a message and leave the brief unchanged. You can retry, switch providers, or capture a finding manually. Requests time out after 12 seconds, and closing the dialog cancels an in-flight search. No server configuration is needed for GitHub Pages.

Provider references: [MediaWiki anonymous cross-origin requests](https://www.mediawiki.org/wiki/API:Cross-site_requests#Unauthenticated_CORS_Requests) and [Crossref public API access](https://www.crossref.org/documentation/retrieve-metadata/rest-api/access-and-authentication/).

## Local storage and privacy

The app makes no background search requests. When you submit an external search, only the text in the topic field is sent to the chosen provider (Wikipedia, Crossref, Europe PMC, or Open Library), together with normal connection information such as your IP address. Search requests omit cookies and the referring page URL. Your saved summary, claims, evidence, and notebook are not sent. The web search link sends the topic to DuckDuckGo only when selected. Source links open externally only when selected. There is no cross-device sync. Browser data clearing, private browsing, changing origins, or uninstalling a browser can remove access to research. Export JSON backups regularly, particularly before switching devices. JSON files can contain your private research; store them appropriately.

Saves report storage failures rather than claiming success. If stored data cannot be read, saving is disabled to preserve that data. Other tabs of the same origin receive saved updates; avoid editing the same brief simultaneously in multiple tabs because the last saved version wins.

## Tests

Only the test tooling requires dependencies (Node.js 20 or later):

```sh
npm install
npx playwright install chromium
npm test
```

The suite uses an installed `/usr/bin/chromium` when available, otherwise Playwright’s Chromium. Set `CHROMIUM_PATH` to use another Chromium executable. It serves local app files with Playwright’s in-process HTTP fixtures by default, so no listening server or external service is required. Set `APP_URL` to test an already running server instead.

Tests cover creating, editing, deleting, reopening, full-text search, filters, pinning, Markdown contents, JSON backup restoration, invalid JSON, unsafe URLs, import conflicts, plain-text HTML handling, keyboard dialog dismissal, empty-notebook persistence, storage failures, and horizontal overflow at widths from 320 to 1440 pixels. The research suite additionally covers correct-card imports, citation numbering, duplicates, excerpts and source-only records, omitted cookies, explicit query submission, manual capture, save failures, exported provenance, unsafe result URLs/markup, empty results, provider errors, rate limits, unreadable JSON, offline requests, timeouts, cancellation, dialog layouts, one-tap imports, bulk selection, edited and cleared excerpts, and title-free source capture. Screenshots are written to the ignored `test-results/` directory.

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
