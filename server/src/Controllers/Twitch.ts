import express from "express";
import { TwitchHelper } from "../Providers/Twitch";
import { Log } from "../Core/Log";
import fs from "node:fs";
import { formatDistanceToNow, formatISO9075 } from "date-fns";
import { Config } from "../Core/Config";
import { TwitchChannel } from "Core/Providers/Twitch/TwitchChannel";

export function Authenticate(req: express.Request, res: express.Response): void {

    Log.logAdvanced(Log.Level.INFO, "Twitch", "Begin auth process...");

    const clientId = Config.getInstance().cfg("api_client_id");

    let app_url = Config.getInstance().cfg("app_url");
    if (app_url == "debug") {
        app_url = `http://${Config.debugLocalUrl()}`;
    }

    const redirectUri = `${app_url}/api/v0/twitch/callback`;

    const scopes: string[] = [];

    const url = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scopes.join(" ")}`;

    if (req.query.rawurl) {
        Log.logAdvanced(Log.Level.SUCCESS, "Twitch", `Send raw URL to user: ${url}`);
        res.status(200).send({
            status: "OK",
            data: url,
        });
        return;
    } else {
        Log.logAdvanced(Log.Level.SUCCESS, "Twitch", `Send user to: ${url}`);
        res.redirect(302, url);
    }

}

export function Callback(req: express.Request, res: express.Response): void {

    Log.logAdvanced(Log.Level.INFO, "Twitch", "Callback received");

    const code = req.query.code as string;

    if (!code) {
        res.status(500).send({
            status: "ERROR",
            message: "No code received from Twitch. Check your settings.",
        });
        Log.logAdvanced(Log.Level.ERROR, "Twitch", "No code received from Twitch, user stuck.");
        return;
    }

    TwitchHelper.accessTokenType = "user";
    TwitchHelper.accessToken = code;

    fs.writeFileSync(TwitchHelper.accessTokenUserFile, code);

    res.send("Success! You can now close this window.");

}

export async function Status(req: express.Request, res: express.Response): Promise<void> {

    if (TwitchHelper.accessTokenType !== "user") {
        res.send({
            status: "ERROR",
            message: "Access token is not a user token.",
        });
        return;
    }

    // if (!YouTubeHelper.authenticated) {
    //     res.status(403).send({
    //         status: "ERROR",
    //         message: "YouTube not authenticated",
    //     });
    //     return;
    // }

    let data;
    try {
        data = await TwitchChannel.getUserDataById("0"); // TODO: Get channel ID from config
    } catch (error) {
        res.status(500).send({
            status: "ERROR",
            message: `Twitch not authenticated: ${(error as Error).message}`,
        });
        return;
    }

    const end_date = new Date(TwitchHelper.accessTokenTime);

    const expires_in = formatDistanceToNow(end_date);

    if (data && data.login !== "") {
        if (TwitchHelper.accessTokenTime > 0) {
            res.send({
                status: "OK",
                message: `Twitch authenticated with user: ${data.login}, expires in ${expires_in} (${formatISO9075(end_date)})`,
            });
        } else {
            res.send({
                status: "OK",
                message: `Twitch authenticated with user: ${data.login}, unknown expiration.`,
            });
        }
    } else {
        res.status(500).send({
            status: "ERROR",
            message: "Twitch not authenticated, login is blank",
        });
    }

}