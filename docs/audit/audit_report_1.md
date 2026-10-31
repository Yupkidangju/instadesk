# InstaBox Deck Audit Report 1 — GitHub Pages readiness

Date: 2026-11-01 (Asia/Seoul)  
Decision: **HOLD**  
Reference: `AI_AUDIT_DOC_STANDARD.md` (three-pass audit)

## 1. Audit summary and scope

This is a pre-publication audit of the local `D:\web\instadesk` Vite/React/TypeScript SPA, its documentation, source, tests, browser extension, dependency lockfile, build output, and intended GitHub Pages deployment. The user asked for an audit session and for Node dependencies to be restored first. No source, test, configuration, or implementation document was changed. No repository was initialized, pushed, or published.

**Checked inputs:** `spec.md`, `designs.md`, `IMPLEMENTATION_SUMMARY.md`, `DESIGN_DECISIONS.md`, `BUILD_GUIDE.md`, `CHANGELOG.md`, `audit_roadmap.md`, `AI_AUDIT_DOC_STANDARD.md`, `package.json`, `package-lock.json`, `vite.config.ts`, `index.html`, `tsconfig.json`, `extension/{manifest.json,rules.json,README.md}`, a full `src/` and `test/` file inventory with targeted inspection of the cited paths, and generated `dist/index.html`. `AI_CODING_STANDARD.md` and `AI_IMPLEMENTATION_DOC_STANDARD.md` were inventoried but not treated as product requirements. There is no project `README.md`, `.gitignore`, `.git`, `.github/`, environment example, or separate security document. `AGENTS.md` is a 29,616,634-byte gzip-compressed tar archive, not readable Markdown; it contains a duplicate project tree including `node_modules/` and `dist/`. The separately present audit standard was used.

**Excluded:** contents of vendored `node_modules/` except package/audit metadata, generated JavaScript/CSS implementation in `dist/assets/`, actual authenticated InstaBox operations, installed-extension behavior, real terminal/Desktop sessions, cross-browser and mobile visual acceptance, and GitHub deployment. No API credential or GitHub repository/remote was supplied. These are unverified, not passes. GitHub Pages behavior was checked against official GitHub and Vite documentation; browser-extension behavior was not certified.

**Commands and observations:** `git status --short --branch` and `git remote -v` failed (`not a git repository`); `npm ci --no-audit --no-fund` succeeded (240 packages installed; npm warned that the esbuild postinstall script had not been approved, but the build worked); `npm run typecheck` passed; `npm test` passed 14/14 in 4 files with a jsdom Canvas warning; `npm run build` passed (539.64 kB JS chunk warning); `npm audit --omit=dev --json` found 0 production dependency advisories; `npm audit --json` reported 6 development-chain advisories (2 critical, 1 high, 3 moderate). Vite preview at `127.0.0.1:4173` rendered the initial UI and four demo machines in Chromium; the only observed console error was a missing `favicon.ico`. An unauthenticated `OPTIONS https://api.instabox.sh/v1/machines` preflight with `Origin: https://example.github.io` returned 404 without `Access-Control-Allow-Origin`; the same request with `Origin: https://dashboard.instabox.sh` returned 204 and an allow-origin header. This is a sampled endpoint response, not a full production API certification.

## 2. Pass 1 — implementation compliance

### IMP-F001 — Published static site cannot directly use the real API

- **Severity / status:** Critical / Hold.
- **Evidence:** `spec.md:11-28` and `BUILD_GUIDE.md:35-56` promise a functioning zero-server static deployment; `src/services/instaboxClient.ts:19-26` uses the Vite proxy only at `localhost:5173` and otherwise calls `https://api.instabox.sh`; `vite.config.ts:6-29` supplies a development-only proxy. The sampled GitHub-origin preflight was denied. `dist/` contains only `index.html` and two asset files, with no `extension/` directory. `extension/README.md` requires manual unpacked installation in Chromium browsers.
- **Expected / actual:** A GitHub Pages visitor should be able to use documented real VM functions under the chosen deployment contract. The base static site cannot issue the authenticated cross-origin REST calls without a separately installed extension, an allowed API origin, or an additional proxy service. The extension is not part of the deployed site and is not an automatic web capability.
- **Correction / re-audit:** Decide the supported production path explicitly: upstream CORS allowlisting, a trusted proxy, or a documented Chromium-extension prerequisite with a distributable, tested extension. Test real API GET, mutation, SSE, WebSocket, and Desktop from the exact Pages origin in a browser with permitted test credentials. Do not describe an untested route as working.

### IMP-F002 — Session quota measures tiles rather than live sessions

- **Severity / status:** Major / Needs Fix.
- **Evidence:** `spec.md:131-134` requires a live WebSocket count and blocking the ninth connection; `src/components/HeaderBar.tsx:38-40` uses `tiles.length`; `src/store/useAppStore.ts:218-246` blocks new *tiles*, including non-session tabs, but `src/store/useAppStore.ts:253-256` can switch an existing tile to a terminal without a connection-level check. `src/components/WorkspaceGrid.tsx:91-101` unmounts all but the first tile in 1x1 mode while the store retains all tiles.
- **Expected / actual:** The displayed meter and gate should track open PTY/Desktop sessions. They track retained tiles, including hidden or non-connected views, and can undercount external/session state.
- **Correction / re-audit:** Track successful opens and closes per profile and panel; enforce limits at the connection boundary. Test tab changes, 1x1, failed connects, closes, and eight-to-nine transitions.

### IMP-F003 — Machine pagination is ignored

- **Severity / status:** Major / Needs Fix.
- **Evidence:** `src/services/instaboxClient.ts:159-168` declares `nextCursor` but returns only `data.machines` from a single GET. The product promises multi-VM inventory in `spec.md:24-29`.
- **Expected / actual:** All reachable machines should appear. Machines after the first page are omitted whenever the API paginates.
- **Correction / re-audit:** Follow cursors with a bounded loop, cancellation and malformed-cursor protection. Mock a two-page response and verify combined inventory, filters and actions.

### IMP-F004 — Documentation claims exceed verified or present implementation

- **Severity / status:** Minor / Needs Documentation Recovery.
- **Evidence:** `IMPLEMENTATION_SUMMARY.md:33` calls the entry point React 19 while `package.json` resolves React 18; `IMPLEMENTATION_SUMMARY.md:50` lists `ScreenshotFallbackView.tsx`, which is absent; `IMPLEMENTATION_SUMMARY.md:20` and `BUILD_GUIDE.md:19` retain an unrelated `/data/home/Projects/python` path; `BUILD_GUIDE.md:35-43` says static files can be uploaded to any host without describing a project-site base path or production API condition. `DESIGN_DECISIONS.md:52-53` asserts 100% extension-based REST/WebSocket success without browser evidence in this audit.
- **Expected / actual:** Current build and usage guidance should match source and tested deployment behavior. Several claims and paths are stale or overbroad.
- **Correction / re-audit:** Update the contract and guide to the supported deployment mode, actual paths and verified feature set; link real-browser evidence before claiming real API/extension compatibility.

## 3. Pass 2 — debug and engineering quality

### DBG-F001 — GitHub Pages project-site asset paths are wrong

- **Severity / status:** Critical / Hold.
- **Evidence:** `vite.config.ts:1-3` has no `base`; generated `dist/index.html:10-11` loads `/assets/index-BdihwWM4.js` and `/assets/index-BhLOTcwo.css`. A normal project site lives at `https://<owner>.github.io/<repo>/`, so `/assets/` addresses the account root. See [Vite static deployment guidance](https://v6.vite.dev/guide/static-deploy) and [GitHub project-site paths](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).
- **Expected / actual:** Asset URLs should resolve under the chosen project path. The generated HTML requests root paths and can show a blank application on a project site.
- **Correction / re-audit:** Set Vite `base` to the final `/<repo>/` (or use a verified relative base, with URL behavior checked), rebuild, inspect `dist/index.html`, and load the actual project URL with network/console checks. A user-site root domain would require a different base decision.

### DBG-F002 — Repository and deployment hygiene are absent

- **Severity / status:** Major / Needs Fix.
- **Evidence:** `git status` and `git remote -v` both failed; `.gitignore` and `.github/` are absent. The working tree contains `node_modules/`, `dist/`, and a 29.6 MB `AGENTS.md` tar archive duplicating dependencies and output. GitHub Pages branch publishing accepts only source root or `/docs`; Vite needs a build workflow or a dedicated built-artifact branch. See [GitHub publishing-source guidance](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
- **Expected / actual:** A small, reviewable source repository with a reproducible build/deploy route. A naive `git add .` would stage installed packages and duplicate archive content, and no configured route publishes `dist/`.
- **Correction / re-audit:** Identify the intended repository name, create an ignore policy for generated/vendor files, decide whether the tar archive belongs outside the repo, initialize Git, and add a Pages Actions workflow that runs `npm ci`, checks, builds, and uploads `dist/`. Review `git status`, staged file list and artifact before any public push. For GitHub Free, plan on a public repository per [GitHub eligibility](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site).

### DBG-F003 — Development toolchain has reported advisories

- **Severity / status:** Major / Needs Fix before exposing dev/test tooling.
- **Evidence:** `npm audit --json` found 6 advisories: `vitest` and `tinypool` critical, `vite` high, and `@vitest/mocker`, `esbuild`, `vite-node` moderate. `npm audit --omit=dev --json` found 0. All are in the build/test chain, not the static runtime dependency set.
- **Expected / actual:** Reproducible development and CI tooling without known critical findings. Current locked versions trigger advisories, especially if a dev/preview/test UI service is exposed.
- **Correction / re-audit:** Upgrade Vite/Vitest and their compatible dependencies in a separate remediation change, review advisory applicability, then rerun install, audit, tests and build. Keep local development servers bound to loopback meanwhile. Do not run `npm audit fix --force` without compatibility review.

### DBG-F004 — Real SSE parser can miss events and leave UI running

- **Severity / status:** Major / Needs Fix.
- **Evidence:** `src/services/instaboxClient.ts:441-484` splits only on `\n\n` and accepts `event: ` / `data: `, without CRLF normalization or flushing the final buffer; `src/components/terminal/ExecRunnerView.tsx:37-81` clears `isRunning` only on exit/error callbacks. A clean stream end without an exit event returns from `streamExec` without either callback. Demo tests cover simulated output only (`test/instaboxClient.test.ts:40-61`).
- **Expected / actual:** Valid SSE line endings and clean EOF should deliver or terminate deterministically. CRLF frames and an EOF without `exit` can lose output and leave the RUN view stuck.
- **Correction / re-audit:** Use an SSE parser that supports CRLF, chunk boundaries, multiline data and EOF; require a terminal result/error on all paths. Test fragmented CRLF input, no-exit EOF, abort and malformed events.

### DBG-F005 — Newly registered real profile does not become Create VM default

- **Severity / status:** Minor / Needs Fix.
- **Evidence:** `src/components/modals/CreateVmModal.tsx:16-24` initializes `profileId` once from initially empty `profiles` to `demo-default`. `src/App.tsx:64-67` mounts the modal component even while closed, so later profile registration does not reinitialize that state; the form also always offers demo as a selectable target (`CreateVmModal.tsx:76-91`).
- **Expected / actual:** Once a real workspace is registered, a newly opened creation form should select a valid, clearly indicated target. It remains on demo until manually changed and can create a simulated VM unexpectedly.
- **Correction / re-audit:** Resolve the initial target when opening the modal or synchronize it when profiles change, and test registering a profile before opening Create VM.

### DBG-F006 — Terminal reconnect button has no effect

- **Severity / status:** Minor / Needs Fix.
- **Evidence:** `src/components/terminal/TerminalView.tsx:207-215` reconnect calls `onSessionChange(sessionName)` with the current value; `src/store/useAppStore.ts:259-264` assigns that same value. The connection effect depends only on `machineId`, `profileId`, and `sessionName` (`TerminalView.tsx:207`).
- **Expected / actual:** Retry should close and establish a new socket. Reassigning the same session name does not retrigger the effect.
- **Correction / re-audit:** Add an explicit reconnect generation/action and verify a new WebSocket is created after a failed/closed connection.

## 4. Pass 3 — security

### SEC-F001 — Vault lock does not revoke active control channels

- **Severity / status:** Critical / Hold.
- **Evidence:** `src/services/cryptoVault.ts:85-92` clears only the master key; the store subscription at `src/store/useAppStore.ts:83-90` updates vault flags but retains tiles. The manual lock action at `useAppStore.ts:134-137` also retains them. `src/components/terminal/TerminalView.tsx:126-183` holds an authenticated WebSocket that closes only on component cleanup (`TerminalView.tsx:198-205`). `src/components/desktop/DesktopScreenView.tsx:29-64,279-284` retains the signed iframe URL. No lock-dependent unmount or socket/stream teardown exists in `VmTilePane.tsx:75-105`.
- **Expected / actual:** Manual or automatic lock should stop privileged sessions and hide/revoke live controls. Existing PTY/desktop sessions can remain usable after the vault indicator changes to locked.
- **Correction / re-audit:** On all lock paths close PTY sockets, abort exec/telemetry requests, unmount or blank signed Desktop viewers, clear sensitive output as specified, and prevent reconnection until unlock. Verify with a real or controlled mock socket and iframe after manual and timer lock.

### SEC-F002 — Custom proxy receives plaintext bearer credentials without a trust boundary

- **Severity / status:** Major / Needs Fix.
- **Evidence:** `src/components/modals/ApiKeyModal.tsx:119-125,334-358` accepts an arbitrary text URL and immediately refreshes machines; `src/services/instaboxClient.ts:19-26,117-127,417-429` sends the decrypted API key as an `Authorization: Bearer` header to that base URL. The UI describes the proxy as “stateless” but has no HTTPS-only validation or explicit explanation that the proxy operator receives credentials. `DESIGN_DECISIONS.md:56-57` frames the proxy as a production option.
- **Expected / actual:** Users should know and deliberately trust the party that receives full-control API keys; insecure/malformed proxy URLs should be rejected. The current flow can send credentials to any configured endpoint or fail through mixed content.
- **Correction / re-audit:** Require HTTPS and a valid origin, surface the credential-disclosure boundary before enabling a proxy, and define a trusted-proxy policy. Check that REST, SSE and WS all route consistently and no unexpected destination receives credentials.

### SEC-F003 — Extension rewrites InstaBox CORS headers for every web origin

- **Severity / status:** Major / Needs Fix or explicit accepted risk after testing.
- **Evidence:** `extension/rules.json:5-42` matches `||instabox.sh` with no initiating-domain restriction, sets `Origin`/`Referer` to the official dashboard, and sets permissive response CORS headers, including `Access-Control-Allow-Origin: *`. `extension/manifest.json:7-19` grants host permissions to multiple InstaBox hosts. Thus the rule is browser-global while the app is used. The API's intended origin policy is bypassed for other requesting sites too. Actual browser effects for preflight, WebSocket and credentialed requests were not tested.
- **Expected / actual:** A bridge should be limited to the application's trusted origin and required endpoints. The present rule is broad and its “100% success” claim is unverified.
- **Correction / re-audit:** Restrict `initiatorDomains`/request domains and resource types as supported by the browser, remove unnecessary response-header rewrites, and test from the intended Pages origin plus an unrelated origin. Record Chromium versions and extension installation method.

## 5. Cross-pass conflicts and decisions

- `XPF-F001`: The source and docs present “100% client-side” as if static hosting alone provides real VM control, while deployment requires an external CORS accommodation. This links IMP-F001, DBG-F001/002 and SEC-F003. Choose and document the production trust/deployment model before implementation claims are revised.
- `XPF-F002`: The vault's encrypted-at-rest design is supported by the unit test (`test/cryptoVault.test.ts:33-61`), but “locked” currently means no *new* decryption, not termination of already opened authenticated sessions. This links the security claim in `spec.md:79-87` and SEC-F001. No accepted risk was documented.
- `XPF-F003`: The vendor API contract, extension behavior and Desktop iframe policy depend on third-party state. Current code and local tests cannot establish real service compatibility. Treat those as `Needs Spec Clarification` until official/current contract and credentialed browser evidence are available.

## 6. Required fixes before PASS

1. Define the public hosting and real-API connectivity path, including whether an extension is an acceptable prerequisite; verify it on the final origin (IMP-F001, SEC-F003).
2. Fix the Vite project-site base and add reproducible Pages deployment plus Git hygiene (DBG-F001/002).
3. Make vault lock terminate active privileged channels (SEC-F001).
4. Define and enforce the proxy trust boundary (SEC-F002).
5. Correct quota accounting, machine pagination and real SSE handling (IMP-F002/003, DBG-F004).
6. Resolve development-chain advisories, or formally scope/accept them with a named owner and review conditions (DBG-F003).
7. Fix the Create VM default and terminal retry, and reconcile documentation before calling the product complete (DBG-F005/006, IMP-F004).

**Accepted risks:** None recorded.  
**Needs Spec Clarification:** Final GitHub repository name and whether it is a project site or account-root site; whether an installed Chromium extension is allowed for end users; trusted production proxy ownership if chosen; whether locking must also erase prior terminal output and externally opened Desktop tabs.  
**Remaining risks:** Real API auth/exec/PTY/Desktop, extension browser behavior, mobile layout and accessibility, live session quota, and published Pages result remain unverified. A passing mock/demo suite does not cover them.

## 7. Re-audit checklist and final decision

Re-audit after an implementation change with: clean `npm ci`; typecheck, tests, build and scoped audit; inspect generated asset URLs under the final `/<repo>/` base; stage-file review before public Git push; Pages Actions deployment and actual URL/browser network check; credentialed API, SSE, PTY, Desktop, lock/revocation and cross-origin checks; confirm docs and code match. Preserve this first report and link subsequent findings back to its IDs.

**Final decision: HOLD.** The app builds and the demo works locally. The ordinary GitHub Pages project URL currently cannot load its built assets, and static hosting alone cannot satisfy the documented real-API behavior. Active privileged channels survive vault lock by design of the current code. These are release-blocking until corrected and re-audited.

## 8. Coder handoff

```text
Read D:\web\instadesk\docs\audit\audit_report_1.md.
Compare each finding with the relevant project documents and actual code, then make the necessary corrections.
If a contract must change, update its documents first. After correcting the implementation, run relevant tests and verification and record the results. Preserve this audit report and link re-audit evidence to its finding IDs.
```
