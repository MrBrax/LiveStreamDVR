import express from "express";
import { TwitchHelper } from "../Providers/Twitch";
import { Log } from "../Core/Log";
import fs from "node:fs";
import { formatDistanceToNow, formatISO9075 } from "date-fns";
import { Config } from "../Core/Config";

export function Authenticate(req: express.Request, res: express.Response): void {

    Log.logAdvanced(Log.Level.INFO, "Twitch", "Begin auth process...");

    const clientId = Config.getInstance().cfg("api_client_id");
    const redirectUriBase = Config.getInstance().cfg("app_url");

    const redirectUri = `${redirectUriBase}/api/v0/twitch/callback`;

    const scopes = [
        "chat:read",
    ];

    const url = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scopes.join(" ")}`;

    Log.logAdvanced(Log.Level.INFO, "Twitch", `Redirecting to ${url}`);

    res.redirect(url);

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
