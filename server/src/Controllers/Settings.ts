import express from "express";
import type { ApiSettingsResponse } from "../../../common/Api/Api";
import { version } from "../../package.json";
import { AppName } from "../Core/BaseConfig";
import { Config } from "../Core/Config";
import { TwitchHelper } from "../Providers/Twitch";
import { KeyValue } from "../Core/KeyValue";
import { LiveStreamDVR } from "../Core/LiveStreamDVR";
import { TwitchGame } from "../Core/Providers/Twitch/TwitchGame";

export function GetSettings(req: express.Request, res: express.Response): void {

    const is_guest = Config.getInstance().cfg<boolean>("guest_mode", false) && !req.session.authenticated;

    const config: Record<string, any> = {};
    for (const field of Config.settingsFields) {
        // if (field.secret) continue;
        if (is_guest && !field.guest) continue;
        config[field.key] = Config.getInstance().cfg(field.key);
    }

    res.send({
        data: {
            app_name: AppName,
            config: config,
            channels: LiveStreamDVR.getInstance().channels_config,
            favourite_games: TwitchGame.favourite_games,
            fields: Config.settingsFields,
            version: version,
            server: "ts-server",
            websocket_url: Config.getInstance().getWebsocketClientUrl(),
            errors: LiveStreamDVR.getErrors(),
            server_git_hash: Config.getInstance().gitHash,
            quotas: {
                twitch: {
                    max_total_cost: KeyValue.getInstance().getInt("twitch.max_total_cost"),
                    total_cost: KeyValue.getInstance().getInt("twitch.total_cost"),
                    total: KeyValue.getInstance().getInt("twitch.total"),
                },
            },
            // guest: is_guest,
        },
        status: "OK",
    } as ApiSettingsResponse);
}

export function SaveSettings(req: express.Request, res: express.Response): void {

    let force_new_token = false;
    if (Config.getInstance().cfg("api_client_id") !== req.body.api_client_id) {
        force_new_token = true;
    }

    let fields = 0;
    for (const setting of Config.settingsFields) {
        const key = setting.key;
        if (setting.required && req.body[key] === undefined) {
            res.status(400).send({
                status: "ERROR",
                message: `Missing required setting: ${key}`,
            });
            return;
        }
        if (req.body[key] !== undefined) {
            fields++;
        }
    }

    if (fields == 0) {
        res.status(400).send({
            status: "ERROR",
            message: "No settings to save",
        });
        return;
    }

    for (const setting of Config.settingsFields) {
        const key = setting.key;
        if (setting.type === "boolean") {
            Config.getInstance().setConfig<boolean>(key, req.body[key]);
        } else if (setting.type === "number") {
            if (req.body[key] !== undefined) {
                Config.getInstance().setConfig<number>(key, parseInt(req.body[key]));
            }
        } else {
            if (req.body[key] !== undefined) {
                Config.getInstance().setConfig(key, req.body[key]);
            }
        }
    }

    Config.getInstance().saveConfig("settings form saved");

    if (force_new_token) {
        TwitchHelper.getAccessToken(true);
    }

    res.send({
        message: "Settings saved",
        status: "OK",
    });

    return;
}

export async function ValidateExternalURL(req: express.Request, res: express.Response): Promise<void> {

    // const test_url = req.body.url;

    /*
    // verify app_url
    if (req.body.app_url !== undefined && req.body.app_url !== "debug") {

        const test_url = req.body.app_url;

        try {
            await Config.getInstance().validateExternalURL(test_url);
        } catch (error) {
            res.send({
                status: "ERROR",
                message: `External URL is invalid: ${(error as Error).message}`,
            });
            return;
        }

    }
    */

    try {
        await Config.getInstance().validateExternalURL();
    } catch (error) {
        res.send({
            status: "ERROR",
            message: `External URL is invalid: ${(error as Error).message}`,
        });
        return;
    }

    res.send({
        status: "OK",
        message: "External URL is valid",
    });

    return;

}

export function SetDebug(req: express.Request, res: express.Response): void {

    if (req.query.enable === undefined) {
        res.status(400).send({
            status: "ERROR",
            message: "Missing enable parameter",
        });
        return;
    }

    Config.getInstance().forceDebug = req.query.enable === "1";

    res.send({
        status: "OK",
        message: `Debug mode set to ${Config.getInstance().forceDebug}`,
    });

}