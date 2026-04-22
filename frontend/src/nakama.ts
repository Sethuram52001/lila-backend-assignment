import { Client, Session, Socket, Match } from '@heroiclabs/nakama-js';

// Nakama Client setup
const client = new Client("defaultkey", "127.0.0.1", "7350");
let useSSL = false;
client.useSSL = useSSL;

export let nakamaSession: Session | null = null;
export let nakamaSocket: Socket | null = null;
export let currentMatch: Match | null = null;

export const authenticate = async (username: string) => {
    // We use device auth for simplicity to auto-login based on username
    nakamaSession = await client.authenticateDevice(username, true, username);
    nakamaSocket = client.createSocket(useSSL, false);
    await nakamaSocket.connect(nakamaSession, true);
    return nakamaSession;
};

export const findMatch = async (): Promise<Match> => {
    if (!nakamaSocket) throw new Error("Socket not connected");
    
    // We can use the matchmaker or join a specific match
    // For this simple example, we use the matchmaker
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
