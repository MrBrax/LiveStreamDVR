import { TwitchConfig } from "../Core/TwitchConfig";
import express from "express";
import { version } from "../../package.json";
import { TwitchChannel } from "../Core/TwitchChannel";
import { TwitchGame } from "../Core/TwitchGame";
import axios, { AxiosResponse } from "axios";
import { TwitchHelper } from "../Core/TwitchHelper";
import { SettingField } from "../../../common/Config";

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

export async function SaveSettings(req: express.Request, res: express.Response): Promise<void> {

    let force_new_token = false;
    if (TwitchConfig.cfg("api_client_id") !== req.body.api_client_id) {
        force_new_token = true;
    }

    let fields = 0;
    for(const setting of TwitchConfig.settingsFields) {
        const key = setting.key;

        if (setting.type === "boolean") {
            TwitchConfig.setConfig(key, req.body[key] !== undefined);
            fields++;
        } else if (setting.type === "number") {
            if (req.body[key] !== undefined) {
                TwitchConfig.setConfig(key, parseInt(req.body[key]));
                fields++;
            }
        } else {
            if (req.body[key] !== undefined) {
                TwitchConfig.setConfig(key, req.body[key]);
                fields++;
            }
        }

    }

    if (fields == 0) {
        res.status(400).send({
            status: "ERROR",
            message: "No settings to save",
        });
        return;
    }

    // verify app_url
    if (TwitchConfig.cfg("app_url") !== undefined) {

        let full_url = TwitchConfig.cfg("app_url") + "/api/v0/hook";

        if (TwitchConfig.cfg("instance_id") !== undefined) {
            full_url += "?instance=" + TwitchConfig.cfg("instance_id");
        }

        let req: AxiosResponse;

        try {
            req = await axios.get(full_url, {
                timeout: 10000,
            });
        } catch (error) {
            console.error(error);
            res.status(400).send({
                status: "ERROR",
                message: `External app url could not be contacted on '${full_url}' due to a bad response: ${error}`,
            });
            return;
        }

        if (req.data !== "No data supplied") {
            res.status(400).send({
                status: "ERROR",
                message: `External app url responded with an unexpected response: ${req.data}`,
            });
            return;
        }
        
    }

    TwitchConfig.saveConfig("settings form saved");

    if (force_new_token) {
        TwitchHelper.getAccessToken(true);
    }

    res.send({
        message: "Settings saved",
        status: "OK",
    });

    return;
}