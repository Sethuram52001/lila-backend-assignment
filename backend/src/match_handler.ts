export interface GameState {
  board: (number | null)[];
  presences: { [userId: string]: nkruntime.Presence };
  player1: nkruntime.Presence | null;
  player2: nkruntime.Presence | null;
  currentPlayerTurn: 1 | 2;
  winner: 1 | 2 | 3 | null; // null = in progress, 1 = player 1, 2 = player 2, 3 = draw
}

const OP_CODES = {
  MOVE: 1,
  STATE_UPDATE: 2,
};

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

  return null; // Game continues
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
  };

  return {
    state,
    tickRate: 5, // 5 ticks per second is enough for tic-tac-toe
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

  // Ensure consistent player ordering by sorting on userId
  if (gameState.player1 && gameState.player2 && gameState.player1.userId > gameState.player2.userId) {
    const temp = gameState.player1;
    gameState.player1 = gameState.player2;
    gameState.player2 = temp;
  }

  // Broadcast state to let clients know someone joined
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

    // Usually if a player leaves in TicTacToe, the other player wins by default, or the game aborts.
    // We'll just end the match effectively or broadcast.
    if (Object.keys(gameState.presences).length === 0) {
        return null; // Empty match, terminate
    }

    // If one player remains and game was in progress, they win by forfeit.
    if (gameState.winner === null) {
      if (gameState.player1 && !gameState.player2) {
          gameState.winner = 1;
      } else if (!gameState.player1 && gameState.player2) {
          gameState.winner = 2;
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

    // Process incoming messages
    for (const message of messages) {
        // We only care about moves if the game is active
        if (message.opCode === OP_CODES.MOVE && gameState.winner === null) {
            const senderUserId = message.sender.userId;
            
            // Check if it's sender's turn
            let isPlayer1 = gameState.player1 && gameState.player1.userId === senderUserId;
            let isPlayer2 = gameState.player2 && gameState.player2.userId === senderUserId;

            if (
                (isPlayer1 && gameState.currentPlayerTurn === 1) || 
                (isPlayer2 && gameState.currentPlayerTurn === 2)
            ) {
                try {
                    const data = JSON.parse(nk.binaryToString(message.data));
                    const cellIndex = data.position;
                    
                    if (typeof cellIndex === 'number' && cellIndex >= 0 && cellIndex < 9) {
                        // isValidMove
                        if (gameState.board[cellIndex] === null) {
                            gameState.board[cellIndex] = gameState.currentPlayerTurn;
                            gameState.currentPlayerTurn = gameState.currentPlayerTurn === 1 ? 2 : 1;
                            gameState.winner = checkWin(gameState.board);
                            stateChanged = true;
                        }
                    }
                } catch (e) {
                    logger.error(`Failed to parse MOVE message: ${e}`);
                }
            }
        }
    }

    // Auto terminate if game ended a few ticks ago
    // For simplicity, we keep it alive for players to see result, but typically we'd end it.
    // If we want to end, we could check if winner is not null and shut down after X ticks.
    
    // Terminate if no players
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
