import { TwitchGame } from "@/Core/Providers/Twitch/TwitchGame";
import type { ApiGamesResponse } from "@common/Api/Api";
import type { ApiGame } from "@common/Api/Client";
import type express from "express";

export function ListGames(req: express.Request, res: express.Response): void {
    const games: Record<string, ApiGame> = {};
    Object.values(TwitchGame.game_db).forEach((game: TwitchGame) => {
        games[game.id || ""] = game.toAPI();
    });

    const fmt = req.query.format == "array" ? "array" : "hash";

    res.api<ApiGamesResponse>(200, {
        // data: fmt == "array" ? Object.values(games) : games,
        data: games,
        status: "OK",
    });
}

export async function RefreshGame(
    req: express.Request,
    res: express.Response
): Promise<void> {
    const game_id = req.params.id;

    if (!game_id) {
        res.api(400, {
            status: "ERROR",
            error: "Missing game ID",
        });
        return;
    }

    const game = await TwitchGame.getGameAsync(game_id, true);

    res.api(200, {
        data: game ? game.toAPI() : null,
        status: "OK",
    });
}
