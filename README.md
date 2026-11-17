# Pump Service Test App

A free, static, offline-capable PWA for apparatus pump test records. Runs on GitHub Pages with no accounts, paid services, backend, analytics, or device synchronization. All test data stays in the browser unless you export or share it.

**Status: ready for supervised workflow field testing; original-workbook validation remains open.** The repository originally contained only `index.html` and `README.txt`. No Excel file was present. Upload the **original pump service test workbook (`.xlsx` or `.xls`), with all worksheets, formulas, units, and print areas intact** before final formula or report-layout sign-off. Do not replace it with a PDF or screenshot for formula validation. No workbook has been changed or overwritten.

## Publish on GitHub Pages

1. Open `https://github.com/ChrisDW4187/pump-service-test-app` and confirm the updated files are on `main`.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Source: Deploy from a branch**.
4. Choose branch **main**, folder **/ (root)**, then **Save**.
5. Wait for the **pages build and deployment** action to finish under **Actions**.
6. Open **https://chrisdw4187.github.io/pump-service-test-app/**. Enable **Enforce HTTPS** in Pages settings when available.
7. Open online and wait for **Offline ready** before installing or testing offline. Refresh once if necessary; then test in airplane mode.

No build command, npm installation, API keys, account login, or server is needed for hosting. All runtime assets, including the PDF libraries, are committed locally. Keep the repository public for the straightforward free GitHub Pages option; private-repository Pages availability depends on the GitHub plan. Publishing the app does not publish device-local test data. Do not commit actual test backups or sensitive reports to this repository.

Relative asset URLs and a relative service-worker scope support this repository's Pages subdirectory. `.nojekyll` enables plain static serving. This work prepares hosting; it does not change repository Pages settings.

## Install and use

- **iPhone/iPad:** open the HTTPS address in Safari → Share → Add to Home Screen → Open as Web App / Add (wording varies by OS version).
- **Android:** open in Chrome → Install app / Add to Home screen.
- **Desktop:** use the browser's install icon/menu where supported. Normal browser use also works.

Enter the apparatus, pump/setup, three capacity-test sections, additional tests, and final assessment. **Next**, **Back**, and section tabs retain all entered values. The progress indicator tracks sections; the required-field counter tracks record identification and assessment, not test compliance.

Inputs save immediately on every edit. A draft restores after closing/reopening the same app origin in the same browser profile. A storage failure displays a persistent warning: keep the page open and export a backup. Conflicting edits from another tab pause writes to avoid silent overwrites; export the current tab before closing/reloading. Use one active app tab for testing.

**Save completed test** stores the active record in History, updating the same record when re-saved. Search History by department, apparatus, or ISO test date. Open a record to review/edit it. Opening a saved record or confirming **New Test** replaces only the active draft, after warning; completed history stays. Export first to retain an unfinished draft. No sample department, date, nozzle layout, or readings are pre-filled on a new test.

## Backups and data limits

Use **Export backup** after each test. The versioned JSON file includes all history plus the active draft. Store it in your department's approved location. Export from History or the navigation bar on any section.

**Import backup** accepts both the old app's history-array format and the new versioned backup. It validates the full file before writing, merges saved records, and keeps conflicting versions as separate copies. Recovering a backup draft requires a separate confirmation. Export a fresh backup before importing. Invalid files do not replace valid history. A raw-recovery export is available if existing storage cannot be decoded.

Local browser storage **does not synchronize across devices**, is not encrypted by this app, and is not permanent archival storage. Clearing browser data, private-mode cleanup, OS eviction, changing the hosting origin/browser profile, or losing the device may remove records. iOS home-screen app storage can differ from Safari storage; export/import when changing environments. PDFs cannot be imported as test backups.

## Reports

**Download PDF** creates an actual letter-size PDF including every existing form field, all recorded readings, RPM calculations, averages, comments, typed signature, and the tester's overall result. **Share Report** sends that PDF through native file sharing when supported; unsupported or failed file sharing falls back to downloading it. Cancelling native sharing does not trigger a download. **Print / Save as PDF** preserves the browser print workflow and supports browser fonts for additional character sets.

PDF report tables paginate with repeated headers and page numbers. These are complete interim reports, not a verified reproduction of the missing Excel print layout. Built-in PDF fonts support Western text; use browser **Print / Save as PDF** for names or comments outside that font's character set. Typed signatures record a name and are not cryptographically verified signatures. Follow department approval procedures.

## Calculations and validation

See [VALIDATION.md](VALIDATION.md) for the precise arithmetic and remaining workbook checks. Existing fields and measurement labels are retained in `schema.js`; no testing standards, acceptance limits, nozzle-flow formulas, or automatic pass/fail determinations have been added.

The final result is selected by the tester: Pass, Fail, Incomplete, or Not assessed. Required record fields and Pass/Fail reading checks are app data-completeness rules only, not a claim of compliance with any standard. Record unperformed tests and limitations in comments/result basis.

## Develop and verify

Requires Node.js 24 (development only) and Python 3 for the local server.

```sh
npm ci
npm test
npx playwright install --with-deps chromium
npm run test:e2e
npm run serve
```

Open `http://localhost:4173/`. ES modules and service workers require HTTP/HTTPS; double-clicking `index.html` as a `file://` URL is no longer supported. Production hosting requires HTTPS. Development tests use localhost's secure-context exception.

- `schema.js`: retained field definitions and legacy capacity sections.
- `core.js`: pure arithmetic, validation, record/backup validation, history merge.
- `app.js`: form, local storage, workflow, PWA registration, sharing controls.
- `report.js`: shared report content, PDF generation, browser printing.
- `styles.css`, `manifest.webmanifest`, `sw.js`, `icons/`: appearance and offline installation.
- `vendor/`: pinned jsPDF 4.2.1 and AutoTable 5.0.7 with their MIT license notices. Update vendored files alongside the lockfile when upgrading.
- `tests/`: unit and Chromium browser tests. Native OS share/install dialogs still require real-device checks.

For updates, increment the cache version in `sw.js` whenever cached assets change. The new service worker waits for old tabs/windows to close, preventing mid-test code changes. Export a backup, close **all** app tabs/windows, reopen online, wait for **Offline ready**, and reload once. Caches are app assets only; clearing old app caches does not delete localStorage history. Browser “Clear site data” does delete records.

See [FIELD-CHECKLIST.md](FIELD-CHECKLIST.md) before operational acceptance.
