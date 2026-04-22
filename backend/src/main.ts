import { matchInit, matchJoinAttempt, matchJoin, matchLeave, matchLoop, matchTerminate, matchSignal } from "./match_handler";

const LEADERBOARD_ID = "tictactoe_wins";

function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, initializer: nkruntime.Initializer) {
    logger.info("Nakama Tic-Tac-Toe Backend logic initialized");

    initializer.registerMatch("tictactoe", {
        matchInit,
        matchJoinAttempt,
        matchJoin,
        matchLeave,
        matchLoop,
        matchTerminate,
        matchSignal
    });

    // When the matchmaker pairs two players, create an authoritative match
    initializer.registerMatchmakerMatched(matchmakerMatched);

    // RPCs
    initializer.registerRpc("create_match", rpcCreateMatch);
    initializer.registerRpc("get_leaderboard", rpcGetLeaderboard);
}

const matchmakerMatched: nkruntime.MatchmakerMatchedFunction = (
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    matches: nkruntime.MatchmakerResult[]
): string => {
    logger.info("Matchmaker matched %d players, creating authoritative match", matches.length);
    return nk.matchCreate("tictactoe", {});
};

const rpcCreateMatch: nkruntime.RpcFunction = (
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    payload: string
): string => {
    const matchId = nk.matchCreate("tictactoe", { fast: true });
    return JSON.stringify({ matchId });
};

const rpcGetLeaderboard: nkruntime.RpcFunction = (
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    payload: string
): string => {
    try {
        // Create leaderboard lazily — nk DB calls fail during InitModule, so we do it here
        try {
            nk.leaderboardCreate(LEADERBOARD_ID, false);
            logger.info("Leaderboard created successfully");
        } catch (e) {
            logger.info("Leaderboard already exists or creation failed: %s", e);
        }
        // Note: don't pass an explicit expiry override here. In Nakama 3.21 the JS runtime
        // binding is sensitive to argument count/types, and an explicit `0` can filter out
        // non-expiring records depending on server config.
        const records = nk.leaderboardRecordsList(LEADERBOARD_ID, undefined, 10, undefined);
        const entries = (records.records || []).map((r) => ({
            rank: (r as any).rank ?? 0,
            username: r.username,
            score: r.score,
            user_id: r.ownerId,
        }));
        return JSON.stringify({ entries });
    } catch (e) {
        logger.error("Failed to fetch leaderboard: %s", e);
        return JSON.stringify({ entries: [] });
    }
};

// Reference InitModule to avoid it being removed by bundler
!InitModule && InitModule.bind(null);
