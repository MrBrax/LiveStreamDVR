import { SettingField, TwitchConfig } from "../Core/TwitchConfig";
import express from "express";
import { version } from "../../package.json";
import { TwitchChannel } from "../Core/TwitchChannel";
import { TwitchGame } from "../Core/TwitchGame";

export function GetSettings(req: express.Request, res: express.Response): void {

    // flatten settings fields to key value pairs
    const fields = TwitchConfig.settingsFields.reduce((acc: Record<string, SettingField<any>>, cur) => {
        acc[cur.key] = cur;
        return acc;
    }, {});

    res.send({
        data: {
            config: TwitchConfig.config,
            channels: TwitchChannel.channels_config,
            favourite_games: TwitchGame.favourite_games,
            fields: fields,
            version: version,
            server: "ts-server",
        },
        status: "OK",
    });
}