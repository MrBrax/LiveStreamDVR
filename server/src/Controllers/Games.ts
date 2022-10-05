import { TwitchGame } from "../Core/Providers/Twitch/TwitchGame";
import express from "express";
import { ApiGamesResponse } from "../../../common/Api/Api";
import { ApiGame } from "../../../common/Api/Client";

export function ListGames(req: express.Request, res: express.Response): void {

    const games: Record<string, ApiGame> = {};
    Object.values(TwitchGame.game_db).forEach((game: TwitchGame) => { games[game.id || ""] = game.toAPI(); });
    
    const fmt = req.query.format == "array" ? "array" : "hash";

    res.send({
        // data: fmt == "array" ? Object.values(games) : games,
        data: games,
        status: "OK",
    } as ApiGamesResponse);

}

export async function RefreshGame(req: express.Request, res: express.Response): Promise<void> {

    const game_id = req.params.id;

    if (!game_id) {
        res.status(400).send({
            status: "ERROR",
            error: "Missing game ID",
        });
        return;
    }

    const game = await TwitchGame.getGameAsync(game_id, true);

    res.send({
        data: game ? game.toAPI() : null,
        status: "OK",
    });

}