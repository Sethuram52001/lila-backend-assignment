export interface GameState {
  board: (number | null)[];
  presences: { [userId: string]: nkruntime.Presence };
  player1: nkruntime.Presence | null;
  player2: nkruntime.Presence | null;
  currentPlayerTurn: 1 | 2;
  winner: 1 | 2 | 3 | null; // null = in progress, 1 = player1, 2 = player2, 3 = draw
  turnDeadline: number;      // Unix ms when the current turn expires
}

const OP_CODES = {
  MOVE: 1,
  STATE_UPDATE: 2,
};

const TURN_TIMEOUT_MS = 30_000; // 30 seconds per turn
const LEADERBOARD_ID = "tictactoe_wins";

// Convert server-side camelCase Presence to client-friendly snake_case
const serializePresence = (p: nkruntime.Presence | null) => {
  if (!p) return null;
  return { user_id: p.userId, session_id: p.sessionId, username: p.username };
};

const serializeState = (state: GameState): string => {
  return JSON.stringify({
    board: state.board,
    player1: serializePresence(state.player1),
    player2: serializePresence(state.player2),
    currentPlayerTurn: state.currentPlayerTurn,
    winner: state.winner,
    turnDeadline: state.turnDeadline,
  });
};

const checkWin = (board: (number | null)[]): 1 | 2 | 3 | null => {
  const winLines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
    [0, 4, 8], [2, 4, 6]             // diagonals
  ];

  for (let i = 0; i < winLines.length; i++) {
    const [a, b, c] = winLines[i];
    if (board[a] !== null && board[a] === board[b] && board[a] === board[c]) {
      return board[a] as 1 | 2;
    }
  }

  if (board.every(cell => cell !== null)) {
    return 3; // Draw
  }

  return null;
};

// Record leaderboard win for the winner (and optionally a loss for the loser)
const recordLeaderboard = (
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  winner: nkruntime.Presence | null,
) => {
  if (!winner) return;
  try {
    // Lazily create the leaderboard — DB not accessible during InitModule
    try {
      nk.leaderboardCreate(LEADERBOARD_ID, false);
      logger.info("Leaderboard created successfully");
    } catch (e) {
      logger.info("Leaderboard already exists or creation failed: %s", e);
    }
    // Use default operator/expiry semantics; keep args minimal to avoid runtime binding pitfalls.
    nk.leaderboardRecordWrite(LEADERBOARD_ID, winner.userId, winner.username, 1, 0);
    logger.info("Recorded leaderboard win for user: %s", winner.username);
  } catch (e) {
    logger.error("Failed to write leaderboard record: %s", e);
  }
};

export const matchInit: nkruntime.MatchInitFunction = (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  params: { [key: string]: string }
): { state: nkruntime.MatchState; tickRate: number; label: string } => {
  const state: GameState = {
    board: Array(9).fill(null),
    presences: {},
    player1: null,
    player2: null,
    currentPlayerTurn: 1,
    winner: null,
    turnDeadline: Date.now() + TURN_TIMEOUT_MS,
  };

  return {
    state,
    tickRate: 5, // 5 ticks per second
    label: "tictactoe"
  };
};

export const matchJoinAttempt: nkruntime.MatchJoinAttemptFunction = (
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    dispatcher: nkruntime.MatchDispatcher,
    tick: number,
    state: nkruntime.MatchState,
    presence: nkruntime.Presence,
    metadata: { [key: string]: any }
): { state: nkruntime.MatchState, accept: boolean, rejectMessage?: string } | null => {
  const gameState = state as GameState;

  // Accept if lobby is not full
  const numPlayers = Object.keys(gameState.presences).length;
  if (numPlayers >= 2) {
      return { state: gameState, accept: false, rejectMessage: "Match is full" };
  }

  return { state: gameState, accept: true };
};

export const matchJoin: nkruntime.MatchJoinFunction = (
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    dispatcher: nkruntime.MatchDispatcher,
    tick: number,
    state: nkruntime.MatchState,
    presences: nkruntime.Presence[]
): { state: nkruntime.MatchState } | null => {
  const gameState = state as GameState;

  for (const presence of presences) {
    gameState.presences[presence.userId] = presence;
    if (!gameState.player1) {
        gameState.player1 = presence;
    } else if (!gameState.player2 && gameState.player1.userId !== presence.userId) {
        gameState.player2 = presence;
    }
  }

  // Consistent ordering: sort by userId so player1 is always the lexicographically smaller id
  if (gameState.player1 && gameState.player2 && gameState.player1.userId > gameState.player2.userId) {
    const temp = gameState.player1;
    gameState.player1 = gameState.player2;
    gameState.player2 = temp;
  }

  // Start the turn timer once both players have joined
  if (gameState.player1 && gameState.player2) {
    gameState.turnDeadline = Date.now() + TURN_TIMEOUT_MS;
  }

  dispatcher.broadcastMessage(OP_CODES.STATE_UPDATE, serializeState(gameState));
  return { state: gameState };
};

export const matchLeave: nkruntime.MatchLeaveFunction = (
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    dispatcher: nkruntime.MatchDispatcher,
    tick: number,
    state: nkruntime.MatchState,
    presences: nkruntime.Presence[]
): { state: nkruntime.MatchState } | null => {
    const gameState = state as GameState;

    for (const presence of presences) {
        delete gameState.presences[presence.userId];
        if (gameState.player1 && gameState.player1.userId === presence.userId) {
            gameState.player1 = null;
        } else if (gameState.player2 && gameState.player2.userId === presence.userId) {
            gameState.player2 = null;
        }
    }

    if (Object.keys(gameState.presences).length === 0) {
        return null; // Empty match, terminate
    }

    // Forfeit: the player who stayed wins
    if (gameState.winner === null) {
      if (gameState.player1 && !gameState.player2) {
          gameState.winner = 1;
          recordLeaderboard(nk, logger, gameState.player1);
      } else if (!gameState.player1 && gameState.player2) {
          gameState.winner = 2;
          recordLeaderboard(nk, logger, gameState.player2);
      }
    }

    dispatcher.broadcastMessage(OP_CODES.STATE_UPDATE, serializeState(gameState));
    return { state: gameState };
};

export const matchLoop: nkruntime.MatchLoopFunction = (
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    dispatcher: nkruntime.MatchDispatcher,
    tick: number,
    state: nkruntime.MatchState,
    messages: nkruntime.MatchMessage[]
): { state: nkruntime.MatchState } | null => {
    const gameState = state as GameState;
    let stateChanged = false;

    // Only run game logic when both players are present
    const bothPresent = gameState.player1 && gameState.player2;

    if (bothPresent && gameState.winner === null) {
        // --- Turn timeout ---
        if (Date.now() > gameState.turnDeadline) {
            // The current player forfeited their turn by timing out → other player wins
            gameState.winner = gameState.currentPlayerTurn === 1 ? 2 : 1;
            const winnerPresence = gameState.winner === 1 ? gameState.player1 : gameState.player2;
            recordLeaderboard(nk, logger, winnerPresence);
            stateChanged = true;
        }

        // --- Process moves ---
        for (const message of messages) {
            if (message.opCode === OP_CODES.MOVE && gameState.winner === null) {
                const senderUserId = message.sender.userId;

                const isPlayer1 = gameState.player1 && gameState.player1.userId === senderUserId;
                const isPlayer2 = gameState.player2 && gameState.player2.userId === senderUserId;

                if (
                    (isPlayer1 && gameState.currentPlayerTurn === 1) ||
                    (isPlayer2 && gameState.currentPlayerTurn === 2)
                ) {
                    try {
                        const data = JSON.parse(nk.binaryToString(message.data));
                        const cellIndex = data.position;

                        if (typeof cellIndex === 'number' && cellIndex >= 0 && cellIndex < 9) {
                            if (gameState.board[cellIndex] === null) {
                                gameState.board[cellIndex] = gameState.currentPlayerTurn;
                                gameState.currentPlayerTurn = gameState.currentPlayerTurn === 1 ? 2 : 1;
                                gameState.winner = checkWin(gameState.board);
                                // Reset turn timer after a valid move
                                gameState.turnDeadline = Date.now() + TURN_TIMEOUT_MS;
                                stateChanged = true;

                                if (gameState.winner && gameState.winner !== 3) {
                                    const winnerPresence = gameState.winner === 1 ? gameState.player1 : gameState.player2;
                                    recordLeaderboard(nk, logger, winnerPresence);
                                }
                            }
                        }
                    } catch (e) {
                        logger.error("Failed to parse MOVE message: %s", e);
                    }
                }
            }
        }
    }

    // Terminate if no players remain
    if (Object.keys(gameState.presences).length === 0) {
        return null;
    }

    if (stateChanged) {
        dispatcher.broadcastMessage(OP_CODES.STATE_UPDATE, serializeState(gameState));
    }

    return { state: gameState };
};

export const matchTerminate: nkruntime.MatchTerminateFunction = (
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    dispatcher: nkruntime.MatchDispatcher,
    tick: number,
    state: nkruntime.MatchState,
    graceSeconds: number
): { state: nkruntime.MatchState } | null => {
    return { state };
};

export const matchSignal: nkruntime.MatchSignalFunction = (
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    dispatcher: nkruntime.MatchDispatcher,
    tick: number,
    state: nkruntime.MatchState,
    data: string
): { state: nkruntime.MatchState, data?: string } | null => {
    return { state };
};
