import { useEffect, useState } from 'react';
import { sendMove, nakamaSession } from '../nakama';

interface BoardProps {
  gameState: any;
  onLeave: () => void;
}

const XIcon = () => (
  <svg className="w-12 h-12 text-rose-500 draw-path" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const OIcon = () => (
  <svg className="w-12 h-12 text-teal-400 draw-path" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
  </svg>
);

function useCountdown(turnDeadline: number | undefined): number {
  const [secondsLeft, setSecondsLeft] = useState(30);

  useEffect(() => {
    if (!turnDeadline) return;
    const update = () => {
      const diff = Math.max(0, Math.ceil((turnDeadline - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [turnDeadline]);

  return secondsLeft;
}

export default function Board({ gameState, onLeave }: BoardProps) {
  if (!gameState) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="animate-pulse flex space-x-2">
          <div className="w-3 h-3 bg-teal-500 rounded-full"></div>
          <div className="w-3 h-3 bg-teal-500 rounded-full"></div>
          <div className="w-3 h-3 bg-teal-500 rounded-full"></div>
        </div>
        <p className="mt-4 text-slate-400">Waiting for game start...</p>
      </div>
    );
  }

  const { board, player1, player2, currentPlayerTurn, winner, turnDeadline } = gameState;
  const myUserId = nakamaSession?.user_id;
  const secondsLeft = useCountdown(winner ? undefined : turnDeadline);

  let myPlayerNum = -1;
  let opponentPlayerNum = -1;
  let opponentName = "Waiting...";
  let myName = "You";

  if (player1 && player1.user_id === myUserId) {
    myPlayerNum = 1;
    opponentPlayerNum = 2;
    myName = player1.username;
    if (player2) opponentName = player2.username;
  } else if (player2 && player2.user_id === myUserId) {
    myPlayerNum = 2;
    opponentPlayerNum = 1;
    myName = player2.username;
    if (player1) opponentName = player1.username;
  }

  const isMyTurn = myPlayerNum === currentPlayerTurn;
  const isUrgent = !winner && secondsLeft <= 10;

  let statusMessage = "";
  if (winner) {
    if (winner === 3) statusMessage = "Draw!";
    else if (winner === myPlayerNum) statusMessage = "🎉 You Won!";
    else statusMessage = "😞 You Lost!";
  } else {
    statusMessage = isMyTurn ? "Your Turn" : "Opponent's Turn";
  }

  const handleCellClick = (index: number) => {
    if (!winner && isMyTurn && board[index] === null) {
      sendMove(index);
    }
  };

  // Timer color: green → yellow → red
  const timerColor = secondsLeft > 20
    ? "text-teal-400"
    : secondsLeft > 10
    ? "text-yellow-400"
    : "text-rose-500 animate-pulse";

  return (
    <div className="flex flex-col items-center w-full">
      {/* Player headers */}
      <div className="flex justify-between w-full mb-4 text-sm px-4">
        <div className={`flex flex-col items-center transition-all ${isMyTurn && !winner ? 'opacity-100 scale-110' : 'opacity-50'}`}>
          <span className="font-bold truncate w-20 text-center">{myName}</span>
          <span className="text-xs text-slate-400">(You)</span>
          <div className="mt-1">{myPlayerNum === 1
            ? <span className="text-rose-500 font-bold text-lg">X</span>
            : <span className="text-teal-400 font-bold text-lg">O</span>}
          </div>
        </div>

        <div className="flex flex-col items-center justify-center">
          <span className="font-bold text-lg">{statusMessage}</span>
          {/* Countdown timer */}
          {!winner && (
            <div className={`mt-1 text-2xl font-mono font-bold ${timerColor}`}>
              {secondsLeft}s
            </div>
          )}
        </div>

        <div className={`flex flex-col items-center transition-all ${!isMyTurn && !winner ? 'opacity-100 scale-110' : 'opacity-50'}`}>
          <span className="font-bold truncate w-20 text-center">{opponentName}</span>
          <span className="text-xs text-slate-400">(Opp)</span>
          <div className="mt-1">{opponentPlayerNum === 1
            ? <span className="text-rose-500 font-bold text-lg">X</span>
            : <span className="text-teal-400 font-bold text-lg">O</span>}
          </div>
        </div>
      </div>

      {/* Urgent warning bar */}
      {isUrgent && isMyTurn && (
        <div className="w-full mb-3 text-center text-xs text-rose-400 font-semibold animate-pulse">
          ⚠️ Make your move or you'll forfeit!
        </div>
      )}

      {/* Timer progress bar */}
      {!winner && (
        <div className="w-full h-1 bg-slate-700 rounded-full mb-4 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              secondsLeft > 20 ? 'bg-teal-400' : secondsLeft > 10 ? 'bg-yellow-400' : 'bg-rose-500'
            }`}
            style={{ width: `${(secondsLeft / 30) * 100}%` }}
          />
        </div>
      )}

      {/* Game Board */}
      <div className="grid grid-cols-3 gap-2 bg-slate-700/50 p-2 rounded-xl mb-6">
        {board.map((cell: number | null, index: number) => (
          <div
            key={index}
            onClick={() => handleCellClick(index)}
            className={`w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center bg-slate-900 rounded-lg cursor-pointer transition-all ${
              !cell && isMyTurn && !winner ? 'hover:bg-slate-800 hover:scale-105' : ''
            }`}
          >
            {cell === 1 && <XIcon />}
            {cell === 2 && <OIcon />}
          </div>
        ))}
      </div>

      {winner && (
        <div className="animate-pop-in flex flex-col items-center">
          <button
            onClick={onLeave}
            className="px-6 py-2 border border-slate-600 rounded-full text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Leave Match
          </button>
        </div>
      )}

      {!winner && (
        <button
          onClick={onLeave}
          className="mt-2 px-4 py-1 text-xs text-slate-500 hover:text-rose-400 transition-colors"
        >
          Forfeit & Leave
        </button>
      )}
    </div>
  );
}
