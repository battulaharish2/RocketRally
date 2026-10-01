# Rocket Rally

**Cast. Capture. Claim the cosmos.** A live browser board game for 2–4 players, with four rockets each, room codes, synchronized turns, and no player accounts.

## Start locally

Install Node.js 22 or newer (24 recommended), open this folder in a terminal, and run:

```sh
npm start
```

Open **http://localhost:3000**. Create a room, then join its code from another browser or device. For another device on the same Wi-Fi, use `http://YOUR-COMPUTER-LAN-IP:3000`. A firewall may need to allow port 3000. The server has no npm dependencies. Do not open index.html directly: the game needs its server.

```sh
npm run check
npm test
```

## Publish online — GitHub + Render free service

GitHub stores the source. Render runs both the website and multiplayer server, giving you a single HTTPS public URL. GitHub Pages alone cannot run this Node server.

1. Create a GitHub repository named `rocket-rally`.
2. Upload the **contents** of this folder to the repository root: `package.json`, `server.mjs`, `game.mjs`, `public/`, `test/`, `render.yaml`, and `.github/`. Do not upload the ZIP itself as the source. GitHub's browser upload may hide dot folders; Git or GitHub Desktop preserves them.
3. Sign in to [Render](https://dashboard.render.com), connect your GitHub account, and choose **New → Web Service**. Select the repository.
4. Choose **Node**, **Free** instance, build command `npm run check && npm test`, start command `npm start`. Leave root directory blank when files are at repository root. Alternatively create a Blueprint from the included `render.yaml`.
5. Deploy. When the service is live, open its `https://...onrender.com` URL. Create a room and share the invitation link.
6. Test from two devices. Keep the service at **one instance**: rooms live in that server's memory.

No credentials or hosting account have been connected in this package, and no public deployment has been made. Hosting providers may require account verification, and free-tier terms can change.

### Free hosting limits

Render free web services can sleep after 15 minutes without inbound traffic; the first visit can take time to wake them. The client shows a connecting screen while waiting. Render free storage is ephemeral: a restart, redeploy or spin-down can lose active rooms. Players then create a new room; the same public game URL remains reusable. Local disk snapshots help a local server recover rooms but are **not durable storage on the free service**. For durable rooms, attach persistent storage on an eligible paid service or replace the JSON store with a shared database.

Official references: [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [Render free services](https://render.com/docs/free), [Render Node deployment](https://render.com/docs/deploy-node-express-app).

### Optional: use GitHub Pages for the website

The Render service is still required for multiplayer.

1. Deploy Render first.
2. Set `window.ROCKET_RALLY_API = 'https://YOUR-SERVICE.onrender.com';` in `public/config.js` and commit.
3. In Render, optionally set `ALLOWED_ORIGINS=https://YOUR-USERNAME.github.io` (origin only, no repository path). Same-origin access to the Render website remains allowed.
4. In GitHub repository **Settings → Pages**, select **GitHub Actions** as the source.
5. Run **Actions → Publish optional GitHub Pages client → Run workflow**.
6. Share the Pages URL. Relative asset URLs support repository subpaths.

## Included gameplay

- 5×5 reference board and 7×7 larger board; mirrored direction option.
- Four rockets per player, safe starts, color and symbol fleet identities.
- Four cowries: 1, 2, 3, 4, or 8; score labels and bonus casts.
- Landing captures, color-specific inward entry, protected inner rockets, exact-score finish, all-four victory.
- Supply caches, capped missile inventory, range-checked attacks, boosts, asteroids and paired wormholes.
- Optional 4/8 launch gate, own-piece blocking, two-bonus limit, 30/45-second or disabled timer.
- Host settings, readiness, available fleet colors, host transfer, idle-player removal, rematches.
- Server-side random outcomes, action validation, versioned snapshots, retry deduplication and SSE broadcasts.
- Refresh/reconnect restoration in the same tab, sound toggle, reduced motion, mobile layout and rules dialog.

## Rules decisions made during implementation

- The provided 5×5 coordinate sequence is preserved exactly. Opposite direction is its horizontal mirror, keeping start and center intact. Paths are rotated for the four bases.
- The 7×7 route covers all 49 cells but uses **50 route positions**: after the outer loop, one perimeter cell is revisited to connect to the inner spiral by an adjacent step. A bottom-middle-to-center route visiting every 7×7 cell exactly once cannot use only orthogonal moves because its endpoint parity differs. The supplied 7×7 reference did not specify arrows; this connector is the explicit implementation choice.
- Every rocket follows its own color-rotated route from start, through the outer lap, into the landing spiral, and then to the planet. Captures still grant a bonus cast, but they do not gate spiral entry.
- Missile range is the shortest distance along the perimeter from **any** of the attacker's outer rockets. Firing is optional, once after movement, and never grants a bonus cast.
- A tile effect resolves once. A forced boost/warp that would land on an own rocket outside a safe square is suppressed. Asteroids at the beginning of a route clamp at Safe Start. Entry-gate cells do not trigger tile effects, so rockets continue into their landing spiral.
- Timer expiry selects the first legal rocket if waiting for movement; otherwise it skips the pending action. It never spends missiles. With all clients offline, timer processing pauses; on return, an expired turn may be resolved immediately.
- Disconnected seats remain reserved; the host may remove one after two minutes during a match. Removing/leaving forfeits the seat. Last remaining player wins by forfeit.
- A room expires after six hours without state activity. Session tokens stay in browser session storage: refreshes and network reconnects retain the seat, but closing a browser tab can discard it. No permanent profiles or cross-device seat recovery.
- Rematch returns everyone to the same room's lobby, keeping names/colors/settings; each new match randomizes the first player and then follows seat order.

## Architecture and configuration

`game.mjs` is the deterministic rules engine (except injected/server-generated casts and starting order). `server.mjs` serves static files, HTTP actions and Server-Sent Events. `public/app.js` only requests actions and renders authoritative snapshots. The server never accepts client-supplied rolls or rocket positions. Every update contains a monotonically increasing state version; stale requests are rejected with the latest snapshot.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Listening port; Render sets this |
| `ROOM_FILE` | `data/rooms.json` | Local JSON recovery snapshots |
| `ALLOWED_ORIGINS` | Unrestricted origins | Optional comma-separated frontend origin allowlist |

`GET /health` returns `{ "ok": true }`. Basic input limits, 200-room cap, six-character unpredictable room codes, per-IP request limits and random secret seat tokens are included. Never publish `data/rooms.json`, which contains seat tokens. This is a small-group single-server release, not a distributed matchmaking service.

## Verification and remaining launch work

Automated tests exercise exact and rotated paths, both sizes, captures, protected squares, gate entry, missile rules, launch restrictions, special effects, victory, simulated full matches, and real HTTP/SSE synchronization with two authenticated clients, stale versions, duplicate actions, host transfer, and reconnect snapshots.

The original supplied design plan is in `docs/design-plan.md`. The implemented rules above resolve its draft choices. Real group playtests are still needed to validate game duration and balance, especially exact-score finishing and missile resets. External hosting smoke tests must be run after deployment; this package does not assert uptime or permanent room storage.

### Verification environment limitation

`npm run check` and all 13 automated tests passed. A real browser smoke test could not run here: the local Chromium download failed, and the available remote browser blocked localhost. Consequently visual rendering, touch usability and real-device network transitions still need an external browser check. Suggested smoke test: create/join from two devices, ready/start, cast/move, refresh one device, finish/rematch, then repeat with 7×7 and mirrored movement.
