# Multiplayer Tic-Tac-Toe

A production-ready, multiplayer Tic-Tac-Toe game with a server-authoritative architecture powered by Nakama and a modern responsive frontend built with React.

## Features

- **Server-Authoritative Game Logic:** All game state management, win/loss evaluation, and move validation happens securely on the Nakama server.
- **Matchmaking Engine:** Automated room search and robust player pairing using Nakama's default matchmaking mechanics.
- **Real-Time Communication:** Real-time state synchronisation utilizing WebSockets.
- **Modern Responsive UI:** A smooth UI implemented with TailwindCSS featuring micro-animations, neon themes, and dark mode optimizations suitable for Desktop and Mobile.

---

## Setup and Installation Instructions

This project is segmented into two environments: `backend/` and `frontend/`.

### 1. Backend (Nakama Server) Setup

The backend utilizes `nakama-runtime` in TypeScript to securely process gameplay.

**Prerequisites:** Node.js (for compilation), Docker & Docker Compose (for running).

1. Open a terminal and navigate to the `backend/` directory.
2. Install the builder dependencies to compile the custom TypeScript module:
   ```bash
   cd backend
   npm install
   npm run build
   ```
3. Run the local backend using Docker Compose. This spins up the Nakama Server and a CockroachDB instance:
   ```bash
   docker-compose up
   ```
   *The Nakama server should now be running on `127.0.0.1:7350` and the developer console is available at `127.0.0.1:7351` (admin/password).*

### 2. Frontend Setup

The frontend utilizes React, Vite, and TailwindCSS.

**Prerequisites:** Node.js (npm).

1. In a new terminal, navigate to the `frontend/` directory.
2. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The frontend should now be running on `http://localhost:5173` (or similar).*

---

## Testing Multiplayer Functionality Locally

1. Ensure both the Nakama server (Docker Compose) and the frontend Vite server are running.
2. Open two separate web browser windows (e.g. one Chrome, one Safari or Private Window).
3. Navigate to `http://localhost:5173` in both windows.
4. Enter unique nicknames (e.g. "Player 1" and "Player 2") in each window and click **Find Match**.
5. Once matched, the gameplay UI will mount. 
6. Play alternating moves! The backend instantly broadcasts state updates natively blocking invalid plays.

---

## Architecture and Design Decisions

- **Why TypeScript for Nakama?**: While Nakama natively supports Lua, Go, and TypeScript, we chose TypeScript to allow for potential module/type sharing in huge scale systems, plus native integration via `rollup`. 
- **Match Handling**: A custom Authoritative Match Handler (`match_handler.ts`) governs the `tictactoe` engine. We avoid creating matches explicitly; instead, Nakama's matchmaker handles it (`addMatchmaker`).
- **Real-time Engine**: Moves are sent specifying positions (e.g. `{ position: 4 }`) through OpCodes (`OP_CODE: 1`). The server independently triggers state broadcasts (`OP_CODE: 2`). Clients are completely disjoint from calculating correctness or wins.
- **Frontend Stack**: Vite + React + Tailwind was selected for its ultra-fast cold start times, high-fidelity HMR (Hot Module Replacement) and extreme flexibility in modeling smooth visual effects. 
- **Security Checkpoints**: Clients can only ever submit a proposed cell index. The Nakama server guarantees it is truly that user's turn and that the specified cell is currently unoccupied.

---

## API & Server Configuration Details

- Server Config: Managed by `backend/local.yml`
- Internal API uses standard `@heroiclabs/nakama-js` payloads connecting to `127.0.0.1:7350`.  
- Default connection bypasses TLS in `development`, and defaults to Device ID Authentication based primarily on the typed nickname.

### Match State Design Structure
```ts
{
  board: (number | null)[],      // Length 9 representing the 3x3 board
  player1: nkruntime.Presence,   // Presence data
  player2: nkruntime.Presence,
  currentPlayerTurn: 1 | 2,      // Enforces execution rules
  winner: 1 | 2 | 3 | null       // 3 stands for Draw, null for Active match
}
```

---

## Deployment Process Documentation

### Deploying the Nakama Backend
*Recommended: DigitalOcean Droplets, AWS EC2, or Nakama Enterprise Cloud.*
The easiest production layout mimics our Docker setup (or using Kubernetes).

1. Generate your production bundle using the provided `Dockerfile` found in `backend/`. This file is tailored to compile the TS configuration via Node, then securely copy the generated outputs into the official Heroiclabs Nakama image (`heroiclabs/nakama:3.21.1`).
2. Example script pushing to a container registry:
   ```bash
   cd backend
   docker build -t your-registry/nakama-tictactoe-backend:latest .
   docker push your-registry/nakama-tictactoe-backend:latest
   ```
3. Set up a VPS. Write a `.env` file containing CockroachDB URLs. Run standard `docker-compose.yml` substituting localhost Cockroach dependencies for your cloud db. Expose port `7350` to the web securely using an Nginx reverse proxy mapped with SSL certificates (Let's encrypt).

### Deploying the React Frontend
*Recommended: Vercel, Netlify, or Github Pages*

1. Ensure the `nakama.ts` client file is updated to hit your deployed backend URL. Change `127.0.0.1` to `api.yourdomain.com` and `client.useSSL = true`.
2. Connect your repository to **Vercel** or **Netlify**.
3. Choose **Vite** as your framework.
4. The Build command will automatically map to `npm run build` triggering `tsc && vite build`.
5. The deployment outputs to `dist/`, which your platform resolves into a live link instantly.
