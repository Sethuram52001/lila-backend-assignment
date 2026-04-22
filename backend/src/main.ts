import { matchInit, matchJoinAttempt, matchJoin, matchLeave, matchLoop, matchTerminate, matchSignal } from "./match_handler";

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

    // We can also register an RPC call to create a match if we want direct matchmaking
    initializer.registerRpc("create_match", rpcCreateMatch);
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

// Reference InitModule to avoid it being removed by bundler
!InitModule && InitModule.bind(null);
