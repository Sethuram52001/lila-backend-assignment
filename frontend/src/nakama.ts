import { Client, Session, Socket, Match } from '@heroiclabs/nakama-js';

// Nakama Client setup — dynamically read from env for deployment
const host = import.meta.env.VITE_NAKAMA_URL || "127.0.0.1";
const port = import.meta.env.VITE_NAKAMA_URL ? "443" : "7350";
const useSSL = !!import.meta.env.VITE_NAKAMA_URL;

const client = new Client("defaultkey", host, port, useSSL);

export let nakamaSession: Session | null = null;
export let nakamaSocket: Socket | null = null;
export let currentMatch: Match | null = null;

export const authenticate = async (username: string) => {
    nakamaSession = await client.authenticateDevice(username, true, username);
    nakamaSocket = client.createSocket(useSSL, false);
    await nakamaSocket.connect(nakamaSession, true);
    return nakamaSession;
};

export const findMatch = async (): Promise<Match> => {
    if (!nakamaSocket) throw new Error("Socket not connected");

    return new Promise((resolve, reject) => {
        nakamaSocket!.onmatchmakermatched = async (matched) => {
            try {
                const match = await nakamaSocket!.joinMatch(matched.match_id, matched.token);
                currentMatch = match;
                resolve(match);
            } catch (err) {
                reject(err);
            }
        };

        // Add user to matchmaker: min 2, max 2
        nakamaSocket!.addMatchmaker("*", 2, 2, { "engine": "tictactoe" });
    });
};

export const leaveMatch = async () => {
    if (nakamaSocket && currentMatch) {
        await nakamaSocket.leaveMatch(currentMatch.match_id);
        currentMatch = null;
    }
};

export const sendMove = async (position: number) => {
    if (nakamaSocket && currentMatch) {
        await nakamaSocket.sendMatchState(currentMatch.match_id, 1, JSON.stringify({ position }));
    }
};

export const getUserId = () => {
    return nakamaSession?.user_id;
};

export interface LeaderboardEntry {
    rank: number;
    username: string;
    score: number;
    user_id: string;
}

export const getLeaderboard = async (): Promise<LeaderboardEntry[]> => {
    if (!nakamaSession) return [];
    try {
        // nakama-js returns `payload` as an object when it's valid JSON.
        // It may also be a string depending on client/version, so handle both.
        const result = await client.rpc(nakamaSession, "get_leaderboard", {});
        const payload: any = (result as any).payload;
        const data =
          payload && typeof payload === "object"
            ? payload
            : JSON.parse(payload ? String(payload) : '{"entries":[]}');
        return (data.entries || []) as LeaderboardEntry[];
    } catch (e) {
        console.error("Failed to fetch leaderboard:", e);
        return [];
    }
};
