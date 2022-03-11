import { TwitchGame } from "@/Core/TwitchGame";
import express from "express";

export function ListFavourites(req: express.Request, res: express.Response): void {
    res.send({
        status: "OK",
        data: TwitchGame.favourite_games,
    });
}

export function SaveFavourites(req: express.Request, res: express.Response): void {

    const formdata: {
        games: { [key: string]: boolean }
    } = req.body;

    TwitchGame.favourite_games = Object.keys(formdata.games).filter((key) => formdata.games[key]);

    res.send({
        status: "OK",
    });

}