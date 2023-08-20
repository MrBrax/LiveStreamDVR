import { log, LOGLEVEL } from "@/Core/Log";
import { TwitchGame } from "@/Core/Providers/Twitch/TwitchGame";
import type { ApiFavouriteGamesResponse } from "@common/Api/Api";
import type express from "express";

export function ListFavourites(
    req: express.Request,
    res: express.Response
): void {
    res.api(200, {
        status: "OK",
        data: TwitchGame.favourite_games,
    } as ApiFavouriteGamesResponse);
}

export function SaveFavourites(
    req: express.Request,
    res: express.Response
): void {
    const formdata: {
        games: string[];
    } = req.body;

    TwitchGame.favourite_games = formdata.games;

    TwitchGame.saveFavouriteGames();

    log(
        LOGLEVEL.INFO,
        "route.favourites.save",
        `Saved ${TwitchGame.favourite_games.length} favourite games.`
    );

    res.api(200, {
        status: "OK",
        message: `Saved ${TwitchGame.favourite_games.length} favourite games.`,
    });
}

export function AddFavourite(
    req: express.Request,
    res: express.Response
): void {
    const formdata: {
        game: string;
    } = req.body;

    TwitchGame.favourite_games.push(formdata.game);

    TwitchGame.saveFavouriteGames();

    log(
        LOGLEVEL.INFO,
        "route.favourites.add",
        `Added ${formdata.game} to favourites.`
    );

    res.api(200, {
        status: "OK",
        message: `Added ${formdata.game} to favourites.`,
    });
}
