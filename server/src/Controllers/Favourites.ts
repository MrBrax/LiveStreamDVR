import { TwitchGame } from "../Core/TwitchGame";
import express from "express";
import { ApiFavouriteGamesResponse } from "../../../common/Api/Api";

export function ListFavourites(req: express.Request, res: express.Response): void {
    res.send({
        status: "OK",
        data: TwitchGame.favourite_games,
    } as ApiFavouriteGamesResponse);
}

export function SaveFavourites(req: express.Request, res: express.Response): void {

    const formdata: {
        games: { [key: string]: boolean }
    } = req.body;

    TwitchGame.favourite_games = Object.keys(formdata.games).filter((key) => formdata.games[key]);

    TwitchGame.saveFavouriteGames();

    res.send({
        status: "OK",
    });

}