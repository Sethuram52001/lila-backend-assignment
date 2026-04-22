import React, { useState, useEffect } from 'react';
import { authenticate, findMatch, nakamaSocket, leaveMatch, nakamaSession } from './nakama';
import Board from './components/Board';
import Leaderboard from './components/Leaderboard';
import { Loader2, Users, Trophy } from 'lucide-react';

type AppState = 'login' | 'matchmaking' | 'game' | 'leaderboard';

function App() {
  const [appState, setAppState] = useState<AppState>('login');
  const [username, setUsername] = useState(`Player_${Math.floor(Math.random() * 9000) + 1000}`);
  const [error, setError] = useState('');
  const [gameState, setGameState] = useState<any>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Register match data listener whenever socket or appState changes
  useEffect(() => {
    if (nakamaSocket) {
      nakamaSocket.onmatchdata = (result: any) => {
        // OpCode 2 = STATE_UPDATE
        if (result.op_code === 2) {
          try {
            const decodedStr = new TextDecoder().decode(result.data);
            const state = JSON.parse(decodedStr);
            setGameState(state);
          } catch (e) {
            console.error("Failed to decode match state:", e);
          }
        }
      };
    }
  }, [appState, isLoggedIn]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    try {
      setError('');
      await authenticate(username);
      setIsLoggedIn(true);
      setAppState('matchmaking');
      handleMatchmaking();
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate');
    }
  };

  const handleMatchmaking = async () => {
    try {
      await findMatch();
      setAppState('game');
    } catch (err: any) {
      setError("Matchmaking failed. " + err.message);
      setAppState('login');
    }
  };

  const handleLeaveMatch = async () => {
    await leaveMatch();
    setAppState('login');
    setIsLoggedIn(false);
    setGameState(null);
  };

  const handlePlayAgain = async () => {
    await leaveMatch();
    setGameState(null);
    setAppState('matchmaking');
    handleMatchmaking();
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950 p-4">
      {/* Background blobs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-teal-500/20 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-rose-500/20 rounded-full blur-[100px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">

        {/* LOGIN */}
        {appState === 'login' && (
          <form onSubmit={handleLogin} className="glass-panel p-8 rounded-2xl animate-pop-in">
            <div className="flex justify-center mb-4 text-teal-400">
              <Users size={48} />
            </div>
            <h1 className="text-3xl font-bold text-center mb-6 neon-text-teal">Tic-Tac-Toe</h1>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Nickname</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 focus:ring-teal-500 text-white outline-none transition-all"
                  placeholder="Enter nickname..."
                />
              </div>
              {error && <p className="text-rose-500 text-sm">{error}</p>}
              <button
                type="submit"
                className="w-full bg-teal-500 hover:bg-teal-600 text-slate-900 font-bold py-3 rounded-lg transition-transform hover:scale-105 active:scale-95"
              >
                Find Match
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!nakamaSession) {
                    await authenticate(username);
                    setIsLoggedIn(true);
                  }
                  setAppState('leaderboard');
                }}
                className="w-full flex items-center justify-center gap-2 py-2 border border-slate-600 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors text-sm"
              >
                <Trophy size={16} className="text-yellow-400" />
                View Leaderboard
              </button>
            </div>
          </form>
        )}

        {/* MATCHMAKING */}
        {appState === 'matchmaking' && (
          <div className="glass-panel p-8 rounded-2xl flex flex-col items-center animate-pop-in">
            <Loader2 className="animate-spin text-teal-400 mb-4" size={48} />
            <h2 className="text-xl font-bold mb-2">Finding opponent...</h2>
            <p className="text-slate-400 text-sm text-center">
              Please wait while we connect you to an available player.
            </p>
          </div>
        )}

        {/* GAME */}
        {appState === 'game' && (
          <div className="glass-panel p-6 rounded-2xl animate-pop-in">
            <Board gameState={gameState} onLeave={handleLeaveMatch} />
            {gameState?.winner && (
              <button
                onClick={handlePlayAgain}
                className="mt-3 w-full bg-teal-500 hover:bg-teal-600 text-slate-900 font-bold py-2 rounded-lg transition-all hover:scale-105 active:scale-95 text-sm"
              >
                Play Again
              </button>
            )}
          </div>
        )}

        {/* LEADERBOARD */}
        {appState === 'leaderboard' && (
          <Leaderboard onBack={() => setAppState('login')} />
        )}
      </div>
    </div>
  );
}

export default App;
