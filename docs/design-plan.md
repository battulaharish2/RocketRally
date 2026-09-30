# Rocket Rally — Game Design and Build Plan

**Status:** Draft for decisions before implementation  
**Working tagline:** *Cast. Capture. Claim the cosmos.*  
**Product format:** Browser-based, live multiplayer game; room code; no account or installation required.

## 1. Game concept

Rocket Rally is a friendly, competitive space race inspired by the four-player, four-piece, cowrie-shell and safe-square traditions described in the supplied Ashta Chamma guide. Each player commands four rockets on a square spiral board. Players cast four cowrie shells, move a rocket along the orbit path, collect missiles, and crash rival rockets. A crash returns the rocket to its player's safe starting square. A capture unlocks that player's inward landing route. The first player to bring all four rockets to the central planet claims it. Hosts can choose a 5×5 Quick or 7×7 Standard board.

The game should feel familiar within one turn, lively when rockets collide, and fair enough that a setback does not make someone sit out. There is no player elimination: everyone continues taking turns until the planet is claimed.

## 2. Design pillars

1. **Easy to learn:** The main turn is cast shells, choose a rocket, move, resolve the space.
2. **Meaningful choices:** Players choose which of four rockets to advance and when to spend a missile.
3. **Exciting interactions:** Collisions and missiles can change the race, but do not remove a player from it.
4. **Shared reality:** The server owns the game state; all screens show the same turn, rolls, rocket positions, and results.
5. **Instant replay:** A room can start another match without players creating accounts or installing anything.

## 3. Proposed rules for the first playable version

These rules adapt the specific Ashta Chamma guide and attached board reference supplied in the conversation. Regional versions differ, so the game presents these as configurable Rocket Rally rules rather than claiming one definitive traditional ruleset.

### Match setup

- Support **2–4 players** in the first version, using four player colors.
- Each player has **four rockets**, stacked on their own marked safe starting square at the edge of the board.
- Give each player a distinct color and launch position on the outer ring. The attached board's four edge-side bases and X-marked safe squares are the visual reference.
- The host chooses a **5×5 Quick** or **7×7 Standard** board before starting.
- Randomly choose the first player, then take turns clockwise.
- Show a short rules overlay before the first match; allow players to dismiss it.

### Turn sequence

1. The active player presses **Cast shells**. The server generates four cowrie outcomes.
2. Count the open sides: 1, 2, 3, or 4 open shells score 1, 2, 3, or 4 spaces; all four closed score **Ashta (8)**. The guide notes that regional variants may differ.
3. The player selects one eligible rocket and moves it by the result. In the default mode all four rockets begin stacked on their Safe Start and may move on any valid score. In optional **4-or-8 launch mode**, rockets wait in Hangar; a 4 or 8 moves one rocket onto Safe Start and uses that cast to launch it.
4. Resolve the cell: capture, Safe Star, supply pickup, or landing-route entry.
5. If the player owns a missile and has a legal target, they may fire **one missile after moving**. A missile attack is optional.
6. A result of **4 or 8**, or a capture, grants one extra shell cast. Classic mode allows bonus casts to chain; an optional Quick Play setting caps them at two per turn.

If a player has no legal move, show “No move available” briefly and advance the turn automatically. A result of 4 or 8 still grants its bonus cast.

### Track and destination

- Use a square grid with a marked outer route, an inward spiral route, and the planet at the center. The host selects a 5×5 or 7×7 grid in the lobby.
- The host chooses one route direction for the match: clockwise or counterclockwise. All players follow the same direction.
- Keep the reference diagram's topology exactly on 5×5: start at the bottom-middle cell, travel east to the bottom-right corner, north up the right edge, west across the top, south down the left edge, then follow the inward spiral to the center. Rotate that same path around the board for the other three launch sides; reverse it only if the host chooses the opposite direction.
- For implementers, the reference's bottom-start path in zero-indexed `(row, column)` cells is: `(4,2) → (4,3) → (4,4) → (3,4) → (2,4) → (1,4) → (0,4) → (0,3) → (0,2) → (0,1) → (0,0) → (1,0) → (2,0) → (3,0) → (4,0) → (4,1) → (3,1) → (2,1) → (1,1) → (1,2) → (1,3) → (2,3) → (3,3) → (3,2) → (2,2)`.
- A rocket starts on its player's safe starting square and follows the full outer perimeter before taking the inward spiral. Scale the same outer-loop-then-inward-spiral pattern from 5×5 to 7×7; do not replace it with a circular racetrack.
- The 7×7 path uses the same construction: start at bottom-middle `(6,3)`, trace the outer perimeter, then spiral through the 5×5 ring, the 3×3 ring, and the center. Rotate the path for the other launch sides. This preserves the reference flow while filling all 49 cells.
- Safe X-cell positions follow each supplied layout. In zero-indexed coordinates, 5×5 uses `(0,0),(0,2),(0,4),(1,1),(1,3),(2,0),(2,2),(2,4),(3,1),(3,3),(4,0),(4,2),(4,4)`. 7×7 uses `(0,3),(1,1),(1,5),(3,0),(3,3),(3,6),(5,1),(5,5),(6,3)`.
- A player must make at least one capture during the match before any of their rockets can enter the inward landing route. Missile hits do not satisfy this requirement.
- Reaching or passing the center moves the rocket to the planet; an exact shell score is not required.
- Once a rocket arrives, it stays there and cannot be attacked.
- A player wins only when **all four rockets** have arrived. The game announces that player as the planet's owner.
- Rockets advance exactly the number of path cells shown by the shells. By default they may pass occupied cells but may not land on their own rocket outside a Safe Star; keep this behavior configurable if playtests favor blocking.

### Collisions

- If a moving rocket lands on an opponent's rocket on a non-safe shared-track cell, the opponent's rocket crashes and returns to its owner's safe starting square.
- A collision does not require a missile card. It grants the attacker an extra cast and unlocks that player's inward landing route.
- A landing on a marked **Safe Star** cannot capture an opponent. Rockets from different players may share a Safe Star; this includes the starting squares.
- Missile hits return a rocket to its owner's safe starting square, but do not count as the required capture and do not grant a bonus cast.
- Rockets already on the inward route or at the planet cannot be crashed.

### Missiles

- Players collect missile tokens from **Supply** cells on the track.
- Cap inventory at **two missiles per player** so players cannot stockpile attacks.
- After moving, a player may fire one missile at an opponent rocket within the board-size range: **4 spaces on 5×5 or 6 on 7×7**. The server computes legal targets.
- A successful hit returns that rocket to its owner's safe starting square.
- Missiles cannot target rockets in Hangar, on a Safe Star, on the inward route, or at the planet.
- If a player has no legal target, their missile remains in inventory.

**Key balance decision:** This draft allows a missile attack in addition to the normal move, but restricts missiles to pickups and a two-missile cap. If playtests show repeated resets feel too punishing, test a Shield pickup or make firing a missile replace the normal move.

### Suggested track cells

| Cell type | Effect |
|---|---|
| Standard Orbit | No special effect. |
| Safe Star | No collision or missile attack can hit a rocket on this cell; multiple players may share it. |
| Supply | Gain one missile, up to the inventory cap. |
| Speed Boost | Move forward two extra cells; do not trigger another effect chain. |
| Asteroid Field | Move back two cells; resolve a collision if the resulting cell is occupied. |
| Wormhole | Move to the paired wormhole. Recommended: one pair in the first board. |

For the first version, keep special cells sparse. Too many effects make the board harder to read and balance.

## 4. Decisions to lock before building

| Decision | Recommended default | Why it matters |
|---|---|---|
| Number of players | 2–4 | Determines board colors, layout, and room capacity. |
| Board size | 5×5 Quick or 7×7 Standard; default to 5×5 | Lets a room choose match length and complexity while keeping the supported layouts manageable. |
| Starting pieces | Four rockets begin stacked on each player's Safe Start | Follows the supplied setup description and makes the starting cells visibly safe. |
| Activation variant | Off by default; optional 4-or-8 launch mode parks rockets in Hangar until one is launched onto Safe Start | The guide says this applies in some regional variations, so make it a room option. |
| Route direction | Clockwise by default; host may choose counterclockwise | The supplied rules allow either direction; keep direction consistent for every player in a match. |
| Shell throw | Four cowries score 1–4, or 8 when all are closed | Replaces a standard die and gives the game its Ashta Chamma-inspired signature. |
| Bonus cast | A 4, 8, or capture grants an extra cast; no cap in Classic, optional two-cast cap in Quick Play | Preserves the described rule while offering a shorter-game setting. |
| Inward route | Complete an outer lap and make at least one capture before entering | Adds a strategic gate inspired by the guide. Missile hits do not unlock it. |
| Finish rule | Reaching or passing the center docks the rocket | Avoids waiting for an exact shell score. |
| Missile frequency | Supply pickups; max two held | Controls how often players are reset. |
| Attack range | 4 spaces on 5×5; 6 spaces on 7×7 | Keeps missile reach meaningful as the outer route grows. |
| Safe cells | X-marked cells protect from missiles and captures; rival rockets may share them | Preserves the supplied safe-square rule and gives players tactical stopping points. |
| Board effects | Supply, Safe Star, Boost, Asteroid, one Wormhole pair | Keep effect counts proportional to board size and avoid visual clutter. |
| Match length | Rough playtest targets: 5×5 10–20 min; 7×7 20–35 min | Estimates for four rockets per player; actual time depends on captures, player count, and turn speed. Validate in playtests. |
| Build order | Implement and test 5×5 first; add 7×7 as a selectable mode after the rules work | The larger board adds path-layout, UI-scaling, balance, and testing work. A configurable board model avoids rewriting movement rules. |
| Turn timer | Optional 30–45 seconds; start with 45 seconds | Avoids stalled rooms; a host may prefer no timer. |
| Reconnect window | Keep room and seat for at least 2 minutes | Covers accidental tab closes and short network drops. |

## 5. Game names and visual identity

### Product and in-game names

- **Game:** Rocket Rally
- **Match room:** Command Deck
- **Room code:** Rally Code
- **Player pieces:** Rockets
- **Launch area:** Hangar
- **Randomizer:** Cowrie Cast
- **Main track:** Outer Orbit
- **Final route:** Landing Spiral
- **Destination:** Planet Core
- **Missile pickup:** Missile Cache
- **Safe cell:** Safe Star
- **Win announcement:** “Planet claimed!”

Keep the name **Rocket Rally** as the working title. Before public launch, check name and domain availability.

### Art direction

- **Mood:** A playful Indian space-fairytale arcade look, borrowing the reference image's cream woven cloth, dark hand-drawn grid, X-marked safe squares, ornate border, and four edge-side player bases. Translate that into an original cosmic textile: deep indigo night-sky cloth, warm parchment grid lines, jewel-tone rocket bases, and restrained brass accents. Do not copy the reference image's exact decoration.
- **Board:** Offer only 5×5 and 7×7 square grids, reimagined as orbital spirals around a bright central planet. Place four launch bases at the middle of each board edge; mark safe cells with a bold X/star treatment. Keep route, safe cells, missile supply, and landing spiral distinct and legible on a phone.
- **Shell cast:** Animate four cowrie-inspired pieces tumbling, then reveal a large number and the score name: “1 · Chamma,” “2 · Do,” “3 · Teen,” “4 · Chamma,” or “8 · Ashta.” Distinguish the two Chamma results by showing the number first. Support reduced motion and a static result.
- **Rockets:** Four distinct silhouettes or decals in addition to color, so players can distinguish pieces with color-vision differences.
- **Player colors:** Coral, cyan, lime, and violet; verify contrast against the board and UI.
- **Effects:** Short, clear animations: shell cast, launch flame, movement trail, missile streak, safe-star glow, crash puff, wormhole warp, landing flare, and planet-claim celebration.
- **Typography:** Rounded display face for headings and a highly legible sans-serif for rules, buttons, and turn details.
- **Audio:** Optional short shell-cast, launch, hit, pickup, and victory sounds; provide mute controls and no autoplay before a player interacts.
- **Accessibility:** Pair every color with a symbol or player number; use patterns or outlines where useful; support reduced motion and readable contrast.

### Required graphics and assets

1. App wordmark and favicon.
2. Responsive 5×5 and 7×7 spiral-board layouts and cell states.
3. Four player rocket sprites, plus selected, moving, damaged, and docked states.
4. Four cowrie-shell pieces and cast animation for results 1, 2, 3, 4, and 8, with result labels Chamma, Do, Teen, Chamma, and Ashta.
5. Missile, supply, asteroid, boost, wormhole, Safe Star, and planet-core icons.
6. Launch base and destination/planet illustrations for each player color.
7. Room lobby avatar or initials treatment.
8. Turn indicator, action buttons, status banners, and result screen.
9. Lightweight particle effects for launch, hit, warp, and victory.
10. A compact rules card for shell values, safe cells, captures, and the capture-to-enter rule.

For a responsive web game, keep the board and pieces as vector/CSS assets where practical so they stay crisp and lightweight. Use raster illustration only where texture or painted detail adds value.

## 6. Screens and functionality

### A. Home screen

- Game title, short description, **Create Room**, and **Join Room** actions.
- Rules and accessibility controls.
- Responsive layout for phone portrait and desktop.
- No login, installation, or account creation.

### B. Create/join flow

- Host creates a room and receives a short, easy-to-read room code and shareable URL.
- Joiner enters the room code and a display name; allow emoji or a preset avatar if desired.
- Validate names and room codes; show a clear room-not-found message.
- Ask the host to start once the room has at least two players.

### C. Lobby / Command Deck

- Show room code, share/copy link, player seats, colors, and ready status.
- Host can start the game, change available settings, or remove an idle participant.
- Players can choose from available colors; the system prevents duplicate colors.
- If host disconnects, transfer host control to the next connected player.

### D. Match board

- Display the chosen 5×5 or 7×7 board, four rockets stacked at each player's safe start, outer route, landing spiral, X-marked Safe Stars, supply cells, and missile inventory.
- Clearly mark the current player and legal moves after the server returns the cowrie result.
- Disable actions while a server action is pending to prevent double submissions.
- Provide a compact player status panel: rockets at base, racing, and arrived; missile count; connection state.
- Show an event feed for readable outcomes, such as “Harish's missile hit Blue Rocket 2.”
- On mobile, keep the board central and use a bottom action tray; on desktop, place status and event feed beside the board.

### E. Pause, disconnect, and reconnect

- Show a disconnected indicator without changing the game state.
- Preserve the player's seat and rockets for the reconnect window.
- On reconnect, send the latest full room snapshot before accepting new actions.
- If the reconnect window expires, let the host continue with that player inactive or remove them; lock the exact behavior before launch.

### F. End-of-match screen

- Celebrate “Planet claimed!” with winner name and planet graphic.
- Show a brief match recap: crashes, missiles fired, rockets arrived, and duration.
- Offer **Play Again** in the same room and **Return to Lobby**.
- Keep player colors and names for rematches, with an option to shuffle the turn order.

## 7. Multiplayer synchronization and room behavior

The server is the authority for every game-changing value. A browser may request an action, but it must not decide the result locally.

### Server-owned state

- Room code, host, players, player colors, connection status, and room phase.
- Active player, turn number, four cowrie outcomes, score name and number, bonus-cast count, board size, route direction, activation variant, and legal actions.
- Each rocket's state: Hangar (optional launch mode), safe start, outer-route position/lap count, landing-spiral position, or planet core; also track whether each player has captured to unlock the inward route.
- Missile inventory, special-cell effects, event log, and winner.

### Action flow

1. Client sends an action with room ID, player seat, action type, and current state version.
2. Server checks the player, turn, phase, legal move, and version.
3. Server generates the cowrie outcome or applies the requested move/attack, resolves effects, and increments the state version.
4. Server broadcasts the authoritative update to all connected clients.
5. Clients animate that confirmed update. Animations never change game logic.

Reject stale or duplicate requests. After reconnect or refresh, send a full snapshot so the player can resynchronize even if they missed earlier updates. Use an event sequence number so clients can ignore duplicate/out-of-order events and request a fresh snapshot when needed.

## 8. Suggested technical shape

Choose technology after confirming the hosting and real-time requirements. The architecture should include:

- A browser client with a responsive board and accessible controls.
- A real-time room service using persistent connections for low-latency updates.
- Server-side game rules and secure cowrie-result generation.
- A room store for active state and reconnect recovery.
- Short-lived room codes; no user accounts required.
- Input validation, action rate limits, and room cleanup after inactivity.

For an MVP, use a single authoritative game service and in-memory or managed ephemeral room storage with reconnect snapshots. Add durable match history only if users want it; the initial promise is replayable rooms, not permanent profiles.

## 9. Build plan and milestones

### Milestone 1 — Rules and paper prototype

- Lock the decision table in section 4.
- Sketch the board and run sample turns on paper.
- Playtest both board sizes, missile range, collision resets, Safe Stars, and whether the capture-to-enter rule stalls play.
- Deliverable: one-page final rules and track map.

### Milestone 2 — Visual prototype

- Create a home screen, lobby, 5×5 board, player colors, and rocket art based on the cloth-and-ink reference.
- Test the 5×5 layout at mobile portrait and desktop sizes before generating the 7×7 variant.
- Deliverable: clickable or browser prototype with no multiplayer required.

### Milestone 3 — Core game engine

- Implement the server-authoritative state machine, turn order, cowrie throws, launching, spiral movement, capture-to-enter gate, collisions, missiles, special cells, planet arrival, and win detection.
- Add deterministic action validation and state versions.
- Deliverable: playable local simulation or two-browser demo.

### Milestone 4 — Rooms and live synchronization

- Implement room creation/join by code, lobby, ready/start flow, real-time broadcasts, reconnect snapshot, host transfer, and rematch.
- Test two or more browsers on separate devices and network conditions.
- Deliverable: private room-code multiplayer playtest.

### Milestone 5 — Art, animation, and sound

- Add rocket movement, shell cast, missile, crash, supply, wormhole, and victory animations.
- Add mute, reduced-motion behavior, and clear textual event descriptions.
- Deliverable: polished visual and audio pass.

### Milestone 6 — Playtest and balance

- Test with groups unfamiliar with the rules.
- Track game duration, skipped turns, missile usage, crashes per player, reconnect success, and whether a player feels unable to recover.
- Adjust board size, missile cap/range, safe-cell count, capture gate, and launch rules based on observed play.
- Deliverable: release-ready rules and balance settings.

### Milestone 7 — Public URL release

- Deploy the game to its public URL.
- Confirm room links work on current mobile and desktop browsers.
- Add basic uptime/error monitoring, room cleanup, and abuse limits.
- Deliverable: public playable game and a short shareable instruction page.

## 10. MVP scope and later additions

### Include in MVP

- 2–4 players, four rockets each, room code and shareable URL.
- Server-authoritative turns and synchronized board state.
- Cowrie values 1–4 or 8, 5×5 or 7×7 spiral board and direction, four rockets per Safe Start, optional 4-or-8 activation, capture-to-enter rule, collision reset, missile pickups and attacks, Safe Stars, and all-four-rockets victory.
- Reconnect, host start, rematch, mobile layout, mute, reduced motion, and basic event feed.

### Defer until after playtesting

- More planets and themed board packs.
- Team mode, tournaments, ranked matchmaking, spectators, chat, accounts, permanent stats, cosmetics, daily quests, and in-game purchases.
- Advanced missile types, custom shell rules, bots, and AI opponents.

## 11. Acceptance checklist

- A new player can create or join a room without signing in or installing anything.
- 2–4 players can complete a full match with four rockets each.
- Only the server can create cowrie results and apply legal moves.
- Every player sees the same shell result, board size, move, missile hit, crash, and winner.
- A refreshed or reconnected player receives the current room snapshot and can continue.
- A rocket hit by a legal missile or collision returns to its owner's safe starting square; safe and arrived rockets cannot be hit.
- A player wins only after all four rockets reach their destination.
- The game works on mobile and desktop, and all important actions have text labels in addition to animation or color.
- Players can immediately start another match in the same room.

## 12. Open choices for approval

1. Should 4, 8, and a capture each grant an extra cast? Recommended: yes; no cap in Classic mode, optional two-cast cap in Quick Play.
2. Should missiles be fired after a normal move, or should firing consume the turn? Recommended for the first playtest: after a move, with pickup-only supply and a two-missile cap.
3. Should both board sizes be available in the first release? Recommended: make 5×5 the initial mode and add 7×7 after path testing.
4. Should Safe Stars block both collisions and missiles? Recommended: yes.
5. Should the optional 4-or-8 activation variant be available? Recommended: yes, off by default.
6. Should the winner need an exact shell score to dock the last rocket? Recommended: no.
7. Should a disconnected player keep their seat for two minutes? Recommended: yes.
