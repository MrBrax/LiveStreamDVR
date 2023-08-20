import { Config } from "@/Core/Config";
import { log, LOGLEVEL } from "@/Core/Log";
import { TwitchChannel } from "@/Core/Providers/Twitch/TwitchChannel";
import type { TwitchAuthUserTokenResponse } from "@common/TwitchAPI/Auth";
import axios from "axios";
import { formatDistanceToNow, formatISO9075 } from "date-fns";
import type express from "express";
import fs from "node:fs";
import { TwitchHelper } from "../Providers/Twitch";

function redirectUri(): string {
    let app_url = Config.getInstance().cfg("app_url");
    if (app_url == "debug") {
        app_url = `http://${Config.debugLocalUrl()}`;
    }
    return `${app_url}/api/v0/twitch/callback`;
}
export function Authenticate(
    req: express.Request,
    res: express.Response
): void {
    log(LOGLEVEL.INFO, "route.twitch", "Begin auth process...");

    const clientId = Config.getInstance().cfg("api_client_id");

    const scopes: string[] = [];

    const url = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri()}&response_type=code&scope=${scopes.join(
        " "
    )}`;

    if (req.query.rawurl) {
        log(LOGLEVEL.SUCCESS, "route.twitch", `Send raw URL to user: ${url}`);
        res.api(200, {
            status: "OK",
            data: url,
        });
        return;
    } else {
        log(LOGLEVEL.SUCCESS, "route.twitch", `Send user to: ${url}`);
        res.redirect(302, url);
    }
}

export async function Callback(
    req: express.Request,
    res: express.Response
): Promise<void> {
    log(LOGLEVEL.INFO, "route.twitch", "Callback received");

    const code = req.query.code as string;

    if (!code) {
        res.api(500, {
            status: "ERROR",
            message: "No code received from Twitch. Check your settings.",
        });
        log(
            LOGLEVEL.ERROR,
            "route.twitch",
            "No code received from Twitch, user stuck."
        );
        return;
    }

    // TwitchHelper.accessTokenType = "user";
    // TwitchHelper.accessToken = code;
    // fs.writeFileSync(TwitchHelper.accessTokenUserFile, code);

    const body = {
        client_id: Config.getInstance().cfg("api_client_id"),
        client_secret: Config.getInstance().cfg("api_secret"),
        code: code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri(),
    };

    let tokenResponse;
    try {
        // tokenResponse = await axios.post<TwitchAuthUserTokenResponse>("https://id.twitch.tv/oauth2/token", formdata);
        tokenResponse = await axios.request<TwitchAuthUserTokenResponse>({
            method: "POST",
            url: "https://id.twitch.tv/oauth2/token",
            data: body,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
        });
    } catch (e) {
        if (axios.isAxiosError(e)) {
            log(
                LOGLEVEL.ERROR,
                "route.twitch",
                `Error while getting access token: ${
                    (e as Error).message || e
                }, ${JSON.stringify(e.response?.data)}`
            );
            console.log(body);
            console.error(e.response?.data);
            res.api(500, {
                status: "ERROR",
                message: `Error while getting access token: ${e.response?.data.message} (${e.status})`,
            });
        } else {
            console.error(e);
            res.api(500, {
                status: "ERROR",
                message:
                    "Error while getting access token. Check the log for more information.",
            });
        }
        return;
    }

    const token = tokenResponse.data.access_token;

    TwitchHelper.accessTokenType = "user";
    TwitchHelper.accessToken = token;
    TwitchHelper.accessTokenTime = Date.now() + tokenResponse.data.expires_in;
    TwitchHelper.userRefreshToken = tokenResponse.data.refresh_token;

    fs.writeFileSync(
        TwitchHelper.accessTokenUserFile,
        JSON.stringify(tokenResponse.data)
    );

    res.send("Success! You can now close this window.");

    log(
        LOGLEVEL.SUCCESS,
        "route.twitch",
        "Successfully authenticated user, switched to user token."
    );
}

export async function Status(
    req: express.Request,
    res: express.Response
): Promise<void> {
    if (TwitchHelper.accessTokenType !== "user") {
        res.api(500, {
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

    if (!TwitchHelper.userTokenUserId) {
        res.api(500, {
            status: "ERROR",
            message: "No user ID found.",
        });
        return;
    }

    let data;
    try {
        data = await TwitchChannel.getUserDataById(
            TwitchHelper.userTokenUserId
        );
    } catch (error) {
        res.api(500, {
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
                message: `Twitch authenticated with user: ${
                    data.login
                }, expires in ${expires_in} (${formatISO9075(
                    end_date
                )})` /*, ${TwitchHelper.eventWebsocketSubscriptions.length} websocket subscriptions of which ${TwitchHelper.eventWebsocketSubscriptions.filter((s) => s.status === "enabled").length} are active.`,*/,
            });
        } else {
            res.send({
                status: "OK",
                message: `Twitch authenticated with user: ${data.login}, unknown expiration.`,
            });
        }
    } else {
        res.api(500, {
            status: "ERROR",
            message: "Twitch not authenticated, login is blank",
        });
    }
}
