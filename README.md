# 🌴 Jungle Dashers — Wild 3D Sprint Racing

An original, browser-based **3D multiplayer arcade racing game**. Cute rounded characters auto-run
along narrow checkerboard-grass tracks floating through a bright tropical jungle. You steer left and
right, jump over hazards, hit boost pads, and fight for **1st** place.

Built with **Next.js (App Router) + TypeScript + Three.js + Tailwind CSS + Drizzle ORM + PostgreSQL
(Supabase in production)**. Deploys to **Vercel** with zero extra infrastructure — real-time
multiplayer runs over an authoritative-store + fast-polling state channel backed by Postgres, so no
websocket server is required.

---

## ✨ Features

### Game modes
| Mode | Description |
|---|---|
| **PLAY** | Quick online matchmaking — you are dropped into an open public room and the race auto-starts when it fills (or after a short wait). |
| **PLAY WITH BOTS** | Instant offline race against 5–7 AI racers with individual skill levels. |
| **PLAY WITH FRIENDS** | Create a private room, pick a track, share the 5-letter **room code** or the **invite link** (`/?room=CODE`), or join a friend's room. |
| **CUSTOMIZE** | Racer name, 8 bright body colors, accessories (cap, leaf, crown, goggles). |
| **LEADERBOARD** | Global best times stored in Postgres/Supabase. |

4–8 racers per match (rooms cap at 8; online rooms are topped up with AI so races always feel full).

### Gameplay
- Auto-run forward, player controls **left/right steering**, **jump**, and a rechargeable **turbo**.
- **Arithmetic speed pickups** are the core mechanic. Every gate is a floating operator coin that is
  applied directly to your live speed value:
  | Pickup | Effect |
  |---|---|
  | `+1 … +6` | Adds that many speed points (decays back to baseline) |
  | `-1 … -5` | Subtracts that many speed points, stumble + camera shake |
  | `×2 / ×3 / ×4` | Multiplies current speed for a short, decaying burst |
- Plus ramps (big air), bumps, wall bounces and slope-driven acceleration.
- Physics feel: speed-sensitive grip, slope gravity, drafting, wall restitution, car-to-car bumps,
  landing squash, banked corners, chase-cam look-ahead and FOV punch on bursts.
- HUD: position plate, gap-to-next, live order ladder, analog tachometer with redline + nitro ring,
  timer, score, circuit minimap, progress strip with rival markers, 3‑2‑1‑GO and a full results screen.

### Presentation
- **Rendering**: PBR materials throughout (`MeshStandardMaterial` / `MeshPhysicalMaterial`), real
  soft shadow mapping (PCF), ACES Filmic tone mapping, sRGB output, and a restrained
  `UnrealBloomPass` so only genuine highlights glow.
- **Characters**: fully jointed rigs (shoulder → elbow, hip → knee), layered eyes with catch-lights,
  procedural skin/fabric textures, contact shadows.
- **UI**: a dark, technical motorsport interface — angled telemetry plates, hairline borders,
  Barlow Condensed display type with JetBrains Mono for numerics, tabular figures, scanline grade
  and a 3D rotating character preview in the customizer.
- **Audio**: a fully **procedural WebAudio engine** (`src/game/audio.ts`) — zero audio assets. It
  synthesises a speed-reactive wind/rumble bed, footstep cadence locked to the run cycle, distinct
  `+ / - / ×` pickup stingers, turbo whoosh, ramp/land/wall impacts, overtake cues, countdown beeps,
  a start horn, finish fanfares, UI clicks/hovers and a percussive menu music bed. SFX and music can
  be toggled independently from the main menu.

### Tracks
Four original hand-authored jungle circuits, each with its own curve/slope profile, palette, width
and deterministic hazard layout:
`Emerald Canopy` · `Vine Spiral` · `Thunder Falls` · `Sunset Lagoon`.

Track geometry, feature placement and physics constants live in `src/lib/track.ts` and are shared by
every client, which keeps all players deterministically in sync.

---

## 🕹️ Controls

| Action | Keyboard | Touch |
|---|---|---|
| Steer | `←` `→` / `A` `D` | ◀ ▶ buttons or drag anywhere |
| Jump | `Space` / `W` / `↑` | **JUMP** button |
| Turbo | `Shift` / `S` / `↓` | ⚡ button |

Touch controls are auto-detected (`pointer: coarse`); desktop shows a minimal key legend with a live
turbo-readiness indicator instead of on-screen buttons.

---

## 🌐 How the multiplayer works (real, not faked)

1. `POST /api/room` — `create` / `join` / `quick` actions create or join a room row and register the
   player (`room_players`).
2. Every client runs a sync loop hitting `POST /api/room/sync` (~4–5 Hz in race, 1 Hz in lobby). Each
   request **writes** the local player's `dist / lane / hop / speed / finishTime` and **reads back**
   the full room state in the same round-trip.
3. Remote racers are rendered from that state and smoothly interpolated/extrapolated client-side
   (`RaceEngine.stepRacer`), so movement looks continuous between updates.
4. The host flips the room to `racing` with a server timestamp `start_at`; every client computes its
   own clock offset from `serverNow` so the countdown starts simultaneously everywhere.
5. Stale players (no heartbeat for 20 s) and old rooms are pruned automatically.

Open the game in two browsers/devices, create a room in one, join with the code in the other and you
will see both characters racing live.

---

## 🗄️ Database schema (Drizzle, `src/db/schema.ts`)

- `rooms` — code, track, visibility, status (`lobby | racing | finished`), `start_at`.
- `room_players` — live per-player race state + cosmetics + heartbeat timestamp.
- `leaderboard` — name, color, track, time, placement, mode.

---

## 🚀 Local development

```bash
cp .env.example .env         # point DATABASE_URL at your Postgres
npm install
npx drizzle-kit push         # create tables
npm run dev                  # http://localhost:3000
```

Health check: `GET /api/health`.

---

## ☁️ Deploying to Vercel + Supabase

1. **Create a Supabase project** (free tier is fine).
2. Copy the **Transaction pooler** connection string
   (`Project Settings → Database → Connection string → Transaction pooler`, port `6543`) and append
   `?sslmode=require`.
3. Push the schema from your machine:
   ```bash
   DATABASE_URL="postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require" \
     npx drizzle-kit push
   ```
4. **Import the repo into Vercel.** Framework preset: *Next.js*. Build command `npm run build`.
5. Add the environment variable `DATABASE_URL` (same pooler string) for
   *Production / Preview / Development*.
6. Deploy. Invite links use the deployment origin automatically (`https://your-app.vercel.app/?room=ABCDE`).

> Because every API route is `force-dynamic` and only performs short row reads/writes, the game runs
> comfortably inside Vercel serverless functions and the Supabase pooler.

---

## 📁 Project structure

```
src/
  app/
    page.tsx                 # menu / customize / leaderboard / lobby / results flow
    api/room/route.ts        # create | join | quick matchmaking
    api/room/sync/route.ts   # heartbeat + state exchange (the realtime channel)
    api/leaderboard/route.ts # global times
  components/
    RaceCanvas.tsx           # canvas mount + telemetry HUD & adaptive controls
    CharacterPreview.tsx     # 3D studio-lit racer preview for the customizer
    ui.tsx                   # menu rows, panels, inputs, toggles (with audio feedback)
  game/
    engine.ts                # race simulation, bots, camera, pickups, netcode + audio hooks
    audio.ts                 # procedural WebAudio SFX/music engine (no assets)
    characters.ts            # jointed PBR humanoid rig + run animation
    world.ts                 # track ribbon, turf/bark textures, barriers, jungle scenery
  lib/
    track.ts                 # original track definitions + deterministic feature layout
    roomStore.ts             # room/matchmaking data access
  db/                        # Drizzle client + schema
```

---

## 📝 Notes on originality

All artwork is generated procedurally in code (geometry + canvas textures) or by AI for the menu
backdrop. Characters, track names, logo wordmark and UI are original to this project and are not
derived from any existing game's assets.
