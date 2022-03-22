import axios, { AxiosResponse } from "axios";
import express from "express";
import type { ApiSettingsResponse } from "../../../common/Api/Api";
import type { SettingField } from "../../../common/Config";
import { version } from "../../package.json";
import { TwitchChannel } from "../Core/TwitchChannel";
import { TwitchConfig } from "../Core/TwitchConfig";
import { TwitchGame } from "../Core/TwitchGame";
import { TwitchHelper } from "../Core/TwitchHelper";

export function GetSettings(req: express.Request, res: express.Response): void {

    // flatten settings fields to key value pairs
    /*
    const fields = TwitchConfig.settingsFields.reduce((acc: Record<string, SettingField<any>>, cur) => {
        acc[cur.key] = cur;
        return acc;
    }, {});
    */

    res.send({
        data: {
            config: TwitchConfig.config,
            channels: TwitchChannel.channels_config,
            favourite_games: TwitchGame.favourite_games,
            fields: TwitchConfig.settingsFields,
            version: version,
            server: "ts-server",
            websocket_url: TwitchConfig.getWebsocketUrl(),
        },
        status: "OK",
    } as ApiSettingsResponse);
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

        let req: AxiosResponse | undefined;
        let response_body = "";

        try {
            req = await axios.get(full_url, {
                timeout: 10000,
            });
        } catch (error) {
            if (axios.isAxiosError(error)) {
                response_body = error.response?.data ?? "";
            } else {
                console.error("app url check error", error);
                res.status(400).send({
                    status: "ERROR",
                    message: `External app url could not be contacted on '${full_url}' due to an error: ${error}`,
                });
                return;
            }
        }

        if (req) response_body = req.data;

        if (response_body !== "No data supplied") {
            res.status(400).send({
                status: "ERROR",
                message: `External app url responded with an unexpected response: ${response_body}`,
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