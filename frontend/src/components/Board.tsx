import React from 'react';
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

  const { board, player1, player2, currentPlayerTurn, winner } = gameState;
  const myUserId = nakamaSession?.user_id;

  // Determine which player we are
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
  let statusMessage = winner ? "" : (isMyTurn ? "Your Turn" : "Opponent's Turn");
  
  if (winner) {
    if (winner === 3) statusMessage = "Draw!";
    else if (winner === myPlayerNum) statusMessage = "You Won!";
    else statusMessage = "You Lost!";
  }

  const handleCellClick = (index: number) => {
    if (!winner && isMyTurn && board[index] === null) {
      sendMove(index);
    }
  };

  return (
    <div className="flex flex-col items-center w-full">
      <div className="flex justify-between w-full mb-8 text-sm px-4">
        <div className={`flex flex-col items-center ${isMyTurn && !winner ? 'opacity-100 scale-110 shadow-glow' : 'opacity-50'} transition-all`}>
          <span className="font-bold truncate w-20 text-center">{myName}</span>
          <span className="text-xs text-slate-400">(You)</span>
          <div className="mt-1">{myPlayerNum === 1 ? <div className="text-rose-500 font-bold">X</div> : <div className="text-teal-400 font-bold">O</div>}</div>
        </div>
        
        <div className="flex flex-col items-center justify-center">
            <span className="font-bold text-lg">{statusMessage}</span>
        </div>

        <div className={`flex flex-col items-center ${!isMyTurn && !winner ? 'opacity-100 scale-110 shadow-glow' : 'opacity-50'} transition-all`}>
          <span className="font-bold truncate w-20 text-center">{opponentName}</span>
          <span className="text-xs text-slate-400">(Opp)</span>
          <div className="mt-1">{opponentPlayerNum === 1 ? <div className="text-rose-500 font-bold">X</div> : <div className="text-teal-400 font-bold">O</div>}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 bg-slate-700/50 p-2 rounded-xl mb-8">
        {board.map((cell: number | null, index: number) => (
          <div
            key={index}
            onClick={() => handleCellClick(index)}
            className={`w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center bg-slate-900 rounded-lg cursor-pointer transition-all ${
              !cell && isMyTurn && !winner ? 'hover:bg-slate-800' : ''
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

      {/* Leave button when game is active */}
       {!winner && (
        <button
          onClick={onLeave}
          className="mt-4 px-4 py-1 text-xs text-slate-500 hover:text-rose-400 transition-colors"
        >
          Forfeit & Leave
        </button>
      )}
    </div>
  );
}
