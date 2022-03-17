import { TwitchGame } from "../Core/TwitchGame";
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