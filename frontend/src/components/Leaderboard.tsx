import { useEffect, useState } from 'react';
import { getLeaderboard, LeaderboardEntry, nakamaSession } from '../nakama';
import { Trophy, RefreshCw } from 'lucide-react';

interface LeaderboardProps {
  onBack: () => void;
}

export default function Leaderboard({ onBack }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLeaderboard = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getLeaderboard();
      setEntries(data);
    } catch (e: any) {
      setError('Failed to load leaderboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const myUserId = nakamaSession?.user_id;

  const medalColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-400';
    if (rank === 2) return 'text-slate-300';
    if (rank === 3) return 'text-amber-600';
    return 'text-slate-500';
  };

  const medalEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  return (
    <div className="glass-panel p-6 rounded-2xl animate-pop-in w-full max-w-md">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-yellow-400">
          <Trophy size={24} />
          <h2 className="text-xl font-bold">Leaderboard</h2>
        </div>
        <button
          onClick={fetchLeaderboard}
          className="p-2 rounded-full hover:bg-slate-700 transition-colors text-slate-400 hover:text-white"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Content */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="animate-pulse flex space-x-2">
            <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
            <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
            <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
          </div>
        </div>
      )}

      {error && !loading && (
        <p className="text-rose-400 text-center py-4 text-sm">{error}</p>
      )}

      {!loading && !error && entries.length === 0 && (
        <p className="text-slate-400 text-center py-8 text-sm">
          No games played yet. Be the first to win!
        </p>
      )}

      {!loading && entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((entry) => {
            const isMe = entry.user_id === myUserId;
            return (
              <div
                key={entry.user_id}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isMe
                    ? 'bg-teal-500/20 border border-teal-500/40'
                    : 'bg-slate-800/60 hover:bg-slate-800'
                }`}
              >
                {/* Rank */}
                <span className={`text-lg font-bold w-8 text-center ${medalColor(entry.rank)}`}>
                  {medalEmoji(entry.rank)}
                </span>

                {/* Name */}
                <span className={`flex-1 font-medium truncate ${isMe ? 'text-teal-300' : 'text-white'}`}>
                  {entry.username}
                  {isMe && <span className="ml-2 text-xs text-teal-400">(you)</span>}
                </span>

                {/* Wins */}
                <div className="flex items-center gap-1">
                  <span className="text-yellow-400 font-bold text-lg">{entry.score}</span>
                  <span className="text-slate-400 text-xs">wins</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Back button */}
      <button
        onClick={onBack}
        className="mt-6 w-full py-2 border border-slate-600 rounded-full text-slate-300 hover:bg-slate-800 transition-colors text-sm"
      >
        ← Back
      </button>
    </div>
  );
}
