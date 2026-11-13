# Product Requirements Document (PRD): GitNotes — Local-First Cross-Platform Notes App

## 1. Executive Summary

GitNotes is a zero-cost ($0/month), local-first, cross-platform personal note-taking application. It eliminates the need for a dedicated backend server or managed database by using **IndexedDB** (via Dexie.js) for instant local read/write operations and a **private GitHub repository** (via GitHub REST/Git Trees API) as the remote source of truth, version control system, and file storage layer.

## 2. Goals & Non-Goals

### Goals

- **Zero Hosting/Infrastructure Cost ($0/mo):** No dedicated backend servers, VPS, or paid database tiers.
- **Cross-Platform Single Codebase:** Run seamlessly on Web (PWA), Desktop (macOS/Windows/Linux via Tauri v2), and iOS (via Capacitor / Safari PWA).
- **Local-First Performance:** 0ms startup latency and full offline read/write capability via IndexedDB.
- **Zero Data Loss & Vendor Lock-In:** All notes stored as standard, human-readable Markdown (`.md`) files with full Git commit history.
- **Efficient Delta Syncing:** Minimize network payloads and GitHub API rate-limit usage by comparing Git Blob SHA hashes before downloading content.

### Non-Goals

- Multi-user real-time collaborative editing (CRDTs/WebSockets).
- Server-side rendering (SSR) or custom backend API microservices.
- Proprietary binary or encrypted non-Markdown storage formats that prevent direct inspection on GitHub.

## 3. System Architecture & Tech Stack

### Core Stack

- **Frontend Framework:** React 19 + TypeScript + Vite (SPA build output to `dist/`).
- **Styling & UI:** Tailwind CSS + Lucide Icons + Markdown Editor/Previewer (e.g., CodeMirror 6 or TipTap Markdown).
- **Local Persistence Engine:** IndexedDB wrapped with Dexie.js (`dexie` + `dexie-react-hooks`).
- **Remote Storage & Sync Client:** `@octokit/rest` (v22+) authenticating via GitHub Fine-Grained Personal Access Token (PAT).
- **Desktop Wrapper:** Tauri v2 (`@tauri-apps/cli`, `@tauri-apps/api`).
- **iOS Wrapper:** Capacitor (`@capacitor/core`, `@capacitor/ios`) + PWA manifest for direct home-screen installation.

### Data Flow Diagram

```text
[ UI Layer: React + Tailwind ]
       │               ▲
       ▼ (0ms R/W)     │ (Live Queries via dexie-react-hooks)
[ Local DB: IndexedDB (Dexie.js) ]
       │               ▲
       ▼ (Dirty Queue) │ (SHA-Diffed Delta Pull)
[ Sync Engine: @octokit/rest ]
       │               ▲
       ▼               │
[ Remote Storage: Private GitHub Repository (main branch) ]
```

## 4. Data Model & Repository Structure

### 4.1 GitHub Repository File Layout

```text
/ (Repository Root)
├── notes/
│   ├── general/
│   │   └── welcome.md
│   └── projects/
│       └── architecture-ideas.md
├── assets/
│   └── 2026-11-13-diagram.png
└── .gitnotes-meta.json (Optional: pinned notes, folder metadata)
```

### 4.2 Note File Format (Markdown + YAML Frontmatter)

```markdown
---
id: "550e8400-e29b-41d4-a716-446655440000"
title: "Architecture Ideas"
tags: ["dev", "local-first"]
pinned: false
created_at: "2026-11-13T08:00:00Z"
updated_at: "2026-11-13T08:15:00Z"
---

# Architecture Ideas
Body content in standard Markdown...
```

### 4.3 Local IndexedDB Schema (`NotesAppDB`)

#### `notes` Table

| Field        | Type                                              | Description                                                             |
| ------------ | ------------------------------------------------- | ----------------------------------------------------------------------- |
| `path`       | `string` (Primary Key)                            | Relative repo path (e.g., `notes/general/welcome.md`).                  |
| `title`      | `string`                                          | Parsed from frontmatter or H1/filename.                                 |
| `content`    | `string`                                          | Full raw Markdown string including frontmatter.                         |
| `sha`        | `string \| null`                                  | Last synced GitHub Blob SHA (`null` if created offline and never pushed). |
| `tags`       | `string[]`                                        | Indexed multi-entry array for instant filtering.                        |
| `updatedAt`  | `number`                                          | Local modification timestamp (epoch ms).                                |
| `syncStatus` | `'synced' \| 'dirty' \| 'conflict' \| 'deleted'`  | Tracks pending outbound operations.                                     |

#### `assets` Table

| Field        | Type                   | Description                                         |
| ------------ | ---------------------- | --------------------------------------------------- |
| `path`       | `string` (Primary Key) | Relative repo path (e.g., `assets/image.png`).      |
| `sha`        | `string \| null`       | GitHub Blob SHA.                                    |
| `blobData`   | `Blob \| null`         | Cached binary data (lazy-loaded on demand).         |
| `syncStatus` | `'synced' \| 'dirty'`  | Tracks pending outbound operations.                 |

#### `settings` Table

- `key` (Primary Key): `github_token`, `repo_owner`, `repo_name`, `branch` (default: `main`), `last_tree_sha`.

## 5. Functional Requirements

### 5.1 Authentication & Onboarding

- **FR-1.1:** Provide a setup screen requiring:
  - GitHub Fine-Grained PAT (scoped strictly to **Contents: Read and write** for the target repository).
  - Repository Owner (username) and Repository Name (`notes-repo`).
- **FR-1.2:** Validate credentials upon entry by testing `octokit.repos.get()` and verifying write permissions.
- **FR-1.3:** Store credentials locally in IndexedDB / platform secure storage (never transmitted to any third-party server).

### 5.2 Note Management & Editor

- **FR-2.1:** Create, read, update, rename/move, and delete Markdown notes organized in nested folders.
- **FR-2.2:** Instant full-text client-side search across titles, tags, and body content using IndexedDB queries.
- **FR-2.3:** Auto-save keystrokes to IndexedDB with a 300ms debounce, setting `syncStatus = 'dirty'`.
- **FR-2.4:** Support Markdown formatting shortcuts, checklist toggles (`- [ ]`), code blocks with syntax highlighting, and live/split preview modes.

### 5.3 File & Image Attachments

- **FR-3.1:** Allow drag-and-drop or file picker uploads for images and PDFs.
- **FR-3.2:** Save uploaded files into `assets/<timestamp>-<sanitized-filename>` locally in IndexedDB (`syncStatus = 'dirty'`) and insert a relative Markdown link (`![alt](../assets/...)`) into the active note.
- **FR-3.3:** Lazy-load remote attachments from GitHub only when a note referencing that asset is opened and `blobData` is not yet cached locally.

### 5.4 Synchronization Engine (Core Requirement)

- **FR-4.1 (Cold Start):** On launch, immediately render UI from IndexedDB without blocking on network requests.
- **FR-4.2 (Push First):** Trigger background sync when online. First, iterate over all local records where `syncStatus === 'dirty'` or `'deleted'` and push them to GitHub using `octokit.repos.createOrUpdateFileContents` or `octokit.repos.deleteFile` (passing the stored `sha` for concurrency control).
- **FR-4.3 (Delta Pull via Git Trees API):**
  1. Call `GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1` (1 API request).
  2. Compare remote tree entries against local IndexedDB `sha` values:
     - If `remote.sha === local.sha`: Skip (no download).
     - If `remote.sha !== local.sha` and `local.syncStatus === 'synced'`: Fetch blob (`GET /repos/{owner}/{repo}/git/blobs/{sha}`), decode Base64 UTF-8 safely, and update IndexedDB.
     - If a remote file was deleted and `local.syncStatus === 'synced'`: Delete from IndexedDB.
- **FR-4.4 (Initial Hydration Optimization):** If local IndexedDB is empty on initial login and the repo contains >20 files, fetch `GET /repos/{owner}/{repo}/zipball/{branch}` and extract client-side via JSZip to hydrate IndexedDB in a single network request.
- **FR-4.5 (Conflict Resolution):** If GitHub returns HTTP `409 Conflict` during a push (indicating concurrent edits on two devices):
  - Preserve local edits in the original file.
  - Fetch the conflicting remote version and save it as `<filename>.conflict-<timestamp>.md` with `syncStatus = 'conflict'`.
  - Surface a non-blocking banner alerting the user to review/merge the conflict file.

## 6. Non-Functional Requirements

- **Offline Resilience:** All core features (creating, editing, searching, deleting notes) must function 100% offline; failed network syncs must fail silently and retry automatically on `window.addEventListener('online')` or manual sync trigger.
- **UTF-8 / Emoji Fidelity:** Base64 encoding/decoding between browser strings and GitHub API payloads must use `TextEncoder` / `TextDecoder` (never raw `btoa`/`atob` on unencoded Unicode strings) to prevent corruption of accented characters (e.g., Portuguese/Spanish) and emojis.
- **Bundle Size & Native Performance:** Keep initial JS bundle lightweight (<300 KB gzipped) so Tauri desktop windows and Capacitor iOS webviews launch in under 500ms.
- **Platform Specifics:**
  - **Desktop (Tauri v2):** Configure `tauri.conf.json` to bundle `../dist` and allow outbound HTTPS requests to <https://api.github.com>.
  - **iOS (Capacitor):** Configure safe-area CSS insets (`env(safe-area-inset-top)`) for iPhone notch/Dynamic Island compatibility and include a valid `manifest.json` + Apple touch icons for PWA standalone mode.

## 7. Implementation Milestones for Engineering Agents

1. **Milestone 1 — Project Scaffold & Local DB:**
   - Initialize Vite + React + TypeScript + Tailwind CSS.
   - Implement Dexie.js schema (`notes`, `assets`, `settings`) and CRUD hooks.
2. **Milestone 2 — Markdown Editor & UI Shell:**
   - Build responsive sidebar (folder tree, tag filter, instant search) + Markdown editor/preview pane + mobile-responsive drawer layout.
3. **Milestone 3 — GitHub Sync Engine:**
   - Build `GitHubSyncService` with UTF-8 safe Base64 helpers, Git Trees SHA diffing, push queue, and 409 conflict file generation.
4. **Milestone 4 — Asset Handling & Lazy Loading:**
   - Implement binary file upload to `assets/`, local blob caching, and on-demand remote blob fetching.
5. **Milestone 5 — Native Wrappers (Tauri & Capacitor):**
   - Initialize Tauri v2 (`npx tauri init`) and Capacitor iOS (`npx cap add ios`), configure build scripts, and verify cross-platform builds.
