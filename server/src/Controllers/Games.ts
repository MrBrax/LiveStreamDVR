import { TwitchGame } from "../Core/TwitchGame";
import express from "express";

export function ListGames(req: express.Request, res: express.Response): void {

    const games = TwitchGame.game_db;
    const fmt = req.query.format == "array" ? "array" : "hash";

    res.send({
        data: fmt == "array" ? Object.values(games) : games,
        status: "OK",
    });

}