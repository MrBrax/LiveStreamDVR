import axios, { AxiosResponse } from "axios";
import express from "express";
import type { ApiSettingsResponse } from "../../../common/Api/Api";
// import type { SettingField } from "../../../common/Config";
import { version } from "../../package.json";
import { TwitchChannel } from "../Core/TwitchChannel";
import { Config } from "../Core/Config";
import { TwitchGame } from "../Core/TwitchGame";
import { Helper } from "../Core/Helper";

export function GetSettings(req: express.Request, res: express.Response): void {

    const config: Record<string, any> = {};
    for (const key in Config.config) {
        config[key] = Config.cfg(key);
    }

    res.send({
        data: {
            config: config,
            channels: TwitchChannel.channels_config,
            favourite_games: TwitchGame.favourite_games,
            fields: Config.settingsFields,
            version: version,
            server: "ts-server",
            websocket_url: Config.getWebsocketClientUrl(),
        },
        status: "OK",
    } as ApiSettingsResponse);
}

export async function SaveSettings(req: express.Request, res: express.Response): Promise<void> {

    let force_new_token = false;
    if (Config.cfg("api_client_id") !== req.body.api_client_id) {
        force_new_token = true;
    }

    // @todo: don't set config values unless everything is valid, like the http check
    let fields = 0;
    for(const setting of Config.settingsFields) {
        const key = setting.key;

        if (setting.type === "boolean") {
            Config.setConfig<boolean>(key, req.body[key] !== undefined);
            fields++;
        } else if (setting.type === "number") {
            if (req.body[key] !== undefined) {
                Config.setConfig<number>(key, parseInt(req.body[key]));
                fields++;
            }
        } else {
            if (req.body[key] !== undefined) {
                Config.setConfig(key, req.body[key]);
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
    if (Config.cfg("app_url") !== undefined) {

        let full_url = Config.cfg("app_url") + "/api/v0/hook";

        if (Config.cfg("instance_id") !== undefined) {
            full_url += "?instance=" + Config.cfg("instance_id");
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

    Config.saveConfig("settings form saved");

    if (force_new_token) {
        Helper.getAccessToken(true);
    }

    res.send({
        message: "Settings saved",
        status: "OK",
    });

    return;
}