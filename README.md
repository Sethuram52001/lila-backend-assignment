# Multiplayer Tic-Tac-Toe

A production-ready, multiplayer Tic-Tac-Toe game with a server-authoritative architecture powered by Nakama and a modern responsive frontend built with React.

## Features

- **Server-Authoritative Game Logic:** All game state management, win/loss evaluation, and move validation happens securely on the Nakama server. Clients can never spoof a move.
- **Automated Matchmaking:** Players are paired automatically via Nakama's authoritative matchmaker. A `registerMatchmakerMatched` hook creates a dedicated authoritative match for every pairing.
- **Turn Timeout & Auto-Forfeit:** Each player has **30 seconds** to make a move. If the timer expires, the server automatically forfeits that player's turn and declares the opponent the winner.
- **Leaderboard:** A persistent `tictactoe_wins` leaderboard tracks cumulative wins per player. Wins are recorded server-side on game end (by move, timeout, or opponent disconnect). The top 10 is accessible from the main menu.
- **Real-Time Communication:** WebSocket-based state sync — every board change, turn switch, and game result is broadcast instantly to all match participants.
- **Modern Responsive UI:** Dark glassmorphism theme with colour-coded countdown timers, animated progress bars, medal rankings (🥇🥈🥉), and a Play Again flow.

---

## Setup and Installation Instructions

This project is split into two environments: `backend/` and `frontend/`.

### 1. Backend (Nakama Server) Setup

**Prerequisites:** Node.js (for compilation), Docker & Docker Compose.

1. Navigate to the `backend/` directory and copy the config template:
   ```bash
   cd backend
   cp local.yml.example local.yml
   ```
   Edit `local.yml` if you want to change the console password or encryption key.

2. Install builder dependencies and compile the TypeScript module:
   ```bash
   npm install
   npm run build
   ```

3. Start the backend (Nakama + CockroachDB) via Docker Compose:
   ```bash
   docker-compose up
   ```
   *Nakama API: `127.0.0.1:7350` · Developer Console: `http://127.0.0.1:7351` (admin / password)*

> **Apple Silicon (ARM) note:** The official Nakama image is `linux/amd64`. Enable **Rosetta** emulation in Docker Desktop → Settings → General to avoid runtime crashes.

### 2. Frontend Setup

**Prerequisites:** Node.js (npm).

1. Navigate to the `frontend/` directory:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   *Frontend runs at `http://localhost:5173`.*

---

## Testing Multiplayer Locally

1. Ensure both the Nakama Docker stack and the Vite dev server are running.
2. Open **two separate browser windows** (e.g. one normal + one private/incognito).
3. Go to `http://localhost:5173` in both windows.
4. Enter unique nicknames and click **Find Match** in both windows.
5. Once matched, the game board loads. Each player gets **30 seconds** per turn — the timer is shown in the header.
6. After the game ends, click **Play Again** to re-queue immediately, or **View Leaderboard** from the home screen to see win rankings.

---

## Architecture & Design Decisions

- **Authoritative Match Handler:** A custom `match_handler.ts` registers the `tictactoe` engine with Nakama. All logic (move validation, win detection, turn enforcement, timeout) runs server-side. Clients only submit a proposed cell index.
- **Matchmaker Hook:** `registerMatchmakerMatched` creates a fresh authoritative match the moment two players are paired — ensuring the custom handler runs (not a relayed match).
- **Turn Timeout:** `matchLoop` runs at 5 ticks/sec and checks `Date.now() > turnDeadline` on every tick. A valid move resets `turnDeadline = now + 30 000ms`. On expiry the inactive player loses.
- **Leaderboard:** `nk.leaderboardCreate` is called idempotently on every boot. `nk.leaderboardRecordWrite` records a win increment when a player wins by move, timeout, or opponent disconnect. A `get_leaderboard` RPC returns the top 10 for the frontend.
- **Serialization:** Server `Presence` objects use camelCase (`userId`). A `serializePresence` helper converts them to snake_case (`user_id`) before broadcasting, matching what the Nakama JS SDK exposes on the client.
- **Player Ordering:** Players are sorted by `userId` lexicographically at join time — player1 (X) always has the smaller ID, making role assignment deterministic across both clients.
- **Frontend Stack:** Vite + React — ultra-fast HMR, no bundler config overhead. Vanilla CSS + Tailwind utility classes for the glassmorphism / neon aesthetic.

---

## API & Match State

- Server config: `backend/local.yml` (git-ignored; copy from `local.yml.example`)
- Client connects to `127.0.0.1:7350` via `@heroiclabs/nakama-js` (no TLS in development)
- Authentication: Device ID auth keyed on the player's chosen nickname

### Match State (broadcast on every change, OpCode 2)
```ts
{
  board: (number | null)[],   // 9 cells; null = empty, 1 = X, 2 = O
  player1: { user_id, session_id, username },
  player2: { user_id, session_id, username },
  currentPlayerTurn: 1 | 2,
  winner: 1 | 2 | 3 | null,  // 3 = draw, null = in progress
  turnDeadline: number,        // Unix ms — client counts down from this
}
```

### OpCodes
| Code | Direction | Meaning |
|------|-----------|---------|
| `1` | Client → Server | Move: `{ position: 0–8 }` |
| `2` | Server → Client | Full state update |

### RPCs
| ID | Description |
|----|-------------|
| `create_match` | Creates a standalone authoritative match |
| `get_leaderboard` | Returns top 10 players by cumulative wins |

---

## Deployment Process Documentation (Zero-Cost Strategy)

To achieve a **100% free** deployment, we recommend the following stack:
- **Database:** Supabase (Free Managed PostgreSQL)
- **Nakama Backend:** Render (Free Docker Web Service)
- **Frontend:** Vercel or Netlify (Free Static Hosting)

### 1. Database (Supabase)
Nakama officially supports PostgreSQL. We can use Supabase to host this for free.
1. Create a free account at [Supabase](https://supabase.com).
2. Create a new project and save the database password.
3. Once provisioned, go to **Project Settings -> Database** and copy the Connection String (URI). 
   - *Example: `postgres://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`*

### 2. Backend (Render)
Render allows you to deploy Docker containers for free.
1. Push your code to a GitHub repository.
2. Go to [Render](https://render.com) and create a new **Web Service**.
3. Connect your GitHub repository and select the `backend` directory as the Root Directory (if prompted).
4. Select the **Docker** runtime.
5. In the Render environment variables, configure the following:
   - `DB_URL`: The Supabase connection string you copied earlier.
   - `NAKAMA_PASSWORD`: A secure password for your Nakama developer console.
6. **Important Dockerfile Adjustment for Render:**
   Render exposes a single `PORT` environment variable. You may need to modify the `docker-compose.yml` or entrypoint in the Dockerfile to bind Nakama's API port to the Render-provided port, or use a customized startup script:
   ```bash
   # Add this to your Dockerfile to run migrations and start Nakama on the provided port
   CMD /nakama/nakama migrate up --database.address $DB_URL && /nakama/nakama --database.address $DB_URL --socket.port $PORT
   ```
7. Click **Deploy**. Note: Render's free tier spins down after 15 minutes of inactivity, so the initial connection might take ~50 seconds to wake up.

### 3. Frontend (Vercel)
1. Go to [Vercel](https://vercel.com) and import your GitHub repository.
2. Set the Root Directory to `frontend`.
3. The framework should be automatically detected as **Vite**.
4. Set an Environment Variable for your production backend URL (e.g., `VITE_NAKAMA_URL=your-render-app.onrender.com`).
5. Update `frontend/src/nakama.ts` to use this variable dynamically:
   ```ts
   const host = import.meta.env.VITE_NAKAMA_URL || "127.0.0.1";
   const port = import.meta.env.VITE_NAKAMA_URL ? "443" : "7350";
   const useSSL = !!import.meta.env.VITE_NAKAMA_URL;
   const client = new Client("defaultkey", host, port, useSSL);
   ```
6. Click **Deploy**. Vercel will build and host your game, providing you with a live URL.

### Deliverables Checklist
- [x] **Source code repository:** Managed via your GitHub.
- [x] **Deployed Game URL:** Provided by Vercel upon deployment.
- [x] **Deployed Nakama Server Endpoint:** Provided by Render upon deployment.
- [x] **README Content:** Setup, Architecture, Config, Testing, and Deployment all covered above.
