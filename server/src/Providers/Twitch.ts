import axios, { Axios } from "axios";
import { format, parseJSON } from "date-fns";
import fs from "node:fs";
import { WebSocket } from "ws";
import path from "node:path";
import { EventSubTypes, Subscription, ErrorResponse } from "@common/TwitchAPI/Shared";
import type { TwitchAuthAppTokenResponse, TwitchAuthTokenValidationResponse, TwitchAuthUserTokenResponse } from "@common/TwitchAPI/Auth";
import { Subscriptions } from "@common/TwitchAPI/Subscriptions";
import { BaseConfigCacheFolder } from "../Core/BaseConfig";
import { Config } from "../Core/Config";
import { Log } from "../Core/Log";
import { TwitchCommentDumpTD } from "@common/Comments";
import { KeyValue } from "../Core/KeyValue";
import { SubStatus } from "@common/Defs";
import { Helper } from "../Core/Helper";

export interface ExecReturn {
    stdout: string[];
    stderr: string[];
    code: number;
}

export interface RemuxReturn {
    stdout: string[];
    stderr: string[];
    code: number;
    success: boolean;
}

export class TwitchHelper {
    static axios: Axios | undefined;

    static accessToken = "";
    static accessTokenType?: "user" | "app";
    static accessTokenTime = 0;
    static userRefreshToken = "";
    static userTokenUserId = "";

    static readonly accessTokenAppFileLegacy = path.join(
        BaseConfigCacheFolder.cache,
        "oauth.bin"
    );

    static readonly accessTokenAppFile = path.join(
        BaseConfigCacheFolder.cache,
        "oauth.json"
    );

    static readonly accessTokenUserFile = path.join(
        BaseConfigCacheFolder.cache,
        "oauth_user.json"
    );

    static readonly accessTokenUserRefreshFile = path.join(
        BaseConfigCacheFolder.cache,
        "oauth_user_refresh.json"
    );

    static readonly accessTokenExpireFile = path.join(
        BaseConfigCacheFolder.cache,
        "oauth_expire.json"
    );

    /** @deprecated */
    static readonly accessTokenExpire = 60 * 60 * 24 * 60 * 1000; // 60 days
    /** @deprecated */
    static readonly accessTokenRefresh = 60 * 60 * 24 * 30 * 1000; // 30 days

    static readonly PHP_DATE_FORMAT = "yyyy-MM-dd HH:mm:ss.SSSSSS";
    static readonly TWITCH_DATE_FORMAT = "yyyy-MM-dd'T'HH:mm:ss'Z'";
    static readonly TWITCH_DATE_FORMAT_MS = "yyyy-MM-dd'T'HH:mm:ss'.'SSS'Z'";

    static readonly eventWebsocketUrl = "wss://eventsub-beta.wss.twitch.tv/ws";
    static eventWebsocket: WebSocket | undefined;

    /*
    static readonly SUBSTATUS = {
        NONE: "0",
        WAITING: "1",
        SUBSCRIBED: "2",
        FAILED: "3",
    };
    */

    static readonly CHANNEL_SUB_TYPES: EventSubTypes[] = [
        "stream.online",
        "stream.offline",
        "channel.update",
    ];

    static async getAccessToken(force = false): Promise<string> {
        if (Config.getInstance().cfg("twitchapi.auth_type") == "app") {
            return await this.getAccessTokenApp(force);
        } else {
            return await this.getAccessTokenUser(force);
        }
    }

    static async getAccessTokenApp(force = false): Promise<string> {

        const expire = fs.existsSync(this.accessTokenExpireFile) ? parseJSON(fs.readFileSync(this.accessTokenExpireFile, "utf8")).getTime() : 0;

        if (fs.existsSync(this.accessTokenAppFile)) {
            if (Date.now() > expire) {
                Log.logAdvanced(
                    Log.Level.INFO,
                    "tw.helper.getAccessTokenApp",
                    `Deleting old access token, too old: ${format(
                        fs.statSync(this.accessTokenAppFile).mtimeMs,
                        this.PHP_DATE_FORMAT
                    )}`
                );
                fs.unlinkSync(this.accessTokenAppFile);
            } else if (!force) {
                Log.logAdvanced(
                    Log.Level.DEBUG,
                    "tw.helper.getAccessTokenApp",
                    "Fetched access token from cache"
                );
                this.accessTokenType = "app";
                const data: TwitchAuthAppTokenResponse = JSON.parse(
                    fs.readFileSync(this.accessTokenAppFile, "utf8")
                );
                this.accessToken = data.access_token;
                this.accessTokenTime = expire;
                // fs.writeFileSync(
                //     this.accessTokenExpireFile,
                //     JSON.stringify(new Date(this.accessTokenTime))
                // );
                Log.logAdvanced(
                    Log.Level.INFO,
                    "tw.helper.getAccessTokenApp",
                    `Access token expires at ${format(this.accessTokenTime, Config.getInstance().dateFormat)}`
                );
                return this.accessToken;
            }
        } else if (fs.existsSync(this.accessTokenAppFileLegacy)) {
            if (
                Date.now() >
                fs.statSync(this.accessTokenAppFileLegacy).mtimeMs +
                    this.accessTokenRefresh
            ) {
                Log.logAdvanced(
                    Log.Level.INFO,
                    "tw.helper.getAccessTokenApp",
                    `Deleting old access token, too old: ${format(
                        fs.statSync(this.accessTokenAppFileLegacy).mtimeMs,
                        this.PHP_DATE_FORMAT
                    )}`
                );
                fs.unlinkSync(this.accessTokenAppFileLegacy);
            } else if (!force) {
                Log.logAdvanced(
                    Log.Level.DEBUG,
                    "tw.helper.getAccessTokenApp",
                    "Fetched access token from cache"
                );
                this.accessTokenType = "app";
                return fs.readFileSync(this.accessTokenAppFileLegacy, "utf8");
            }
        }


        if (
            !Config.getInstance().cfg("api_secret") ||
            !Config.getInstance().cfg("api_client_id")
        ) {
            Log.logAdvanced(
                Log.Level.ERROR,
                "tw.helper.getAccessTokenApp",
                "Missing either api secret or client id, aborting fetching of access token!"
            );
            throw new Error(
                "Missing either api secret or client id, aborting fetching of access token!"
            );
        }

        // oauth2
        const oauth_url = "https://id.twitch.tv/oauth2/token";

        /*
        try {
            $response = $client->post($oauth_url, [
                'query' => [
                    'client_id' => TwitchConfig::cfg('api_client_id'),
                    'client_secret' => TwitchConfig::cfg('api_secret'),
                    'grant_type' => 'client_credentials'
                ],
                'headers' => [
                    'Client-ID: ' . TwitchConfig::cfg('api_client_id')
                ]
            ]);
        } catch (\Throwable $th) {
            TwitchLog.logAdvanced(Log.Level.FATAL, "tw.helper.getAccessTokenApp", "Tried to get oauth token but server returned: " . $th->getMessage());
            sleep(5);
            return false;
        }
        */

        const response = await axios.post<TwitchAuthAppTokenResponse>(
            oauth_url,
            {
                client_id: Config.getInstance().cfg("api_client_id"),
                client_secret: Config.getInstance().cfg("api_secret"),
                grant_type: "client_credentials",
            },
            {
                headers: {
                    "Client-ID": Config.getInstance().cfg("api_client_id"),
                },
            }
        );

        if (response.status != 200) {
            Log.logAdvanced(
                Log.Level.FATAL,
                "tw.helper.getAccessTokenApp",
                "Tried to get oauth token but server returned: " +
                    response.statusText
            );
            throw new Error(
                "Tried to get oauth token but server returned: " +
                    response.statusText
            );
        }

        const json = response.data;

        if (!json || !json.access_token) {
            Log.logAdvanced(
                Log.Level.ERROR,
                "tw.helper.getAccessTokenApp",
                `Failed to fetch access token: ${json}`
            );
            throw new Error(`Failed to fetch access token: ${json}`);
        }

        const access_token = json.access_token;

        this.accessToken = access_token;
        this.accessTokenTime = Date.now() + (json.expires_in * 1000);

        // fs.writeFileSync(this.accessTokenAppFileLegacy, access_token);
        fs.writeFileSync(this.accessTokenAppFile, JSON.stringify(json));

        Log.logAdvanced(
            Log.Level.INFO,
            "tw.helper.getAccessTokenApp",
            `Fetched new access token, expires at ${format(this.accessTokenTime, Config.getInstance().dateFormat)}`
        );

        this.accessTokenType = "app";

        return access_token;
    }

    static async getAccessTokenUser(force = false): Promise<string> {

        const expire = fs.existsSync(this.accessTokenExpireFile) ? parseJSON(fs.readFileSync(this.accessTokenExpireFile, "utf8")).getTime() : 0;

        this.accessTokenType = "user";

        if (fs.existsSync(this.accessTokenUserFile)) {

            const data: TwitchAuthUserTokenResponse = JSON.parse(
                fs.readFileSync(this.accessTokenUserFile, "utf8")
            );

            this.userRefreshToken = data.refresh_token;

            if (
                Date.now() > expire
            ) {
                Log.logAdvanced(
                    Log.Level.INFO,
                    "tw.helper",
                    `Deleting old access token, too old: ${format(
                        fs.statSync(this.accessTokenUserFile).mtimeMs,
                        this.PHP_DATE_FORMAT
                    )}`
                );
                // fs.unlinkSync(this.accessTokenUserFile);
            } else if (!force) {
                Log.logAdvanced(
                    Log.Level.DEBUG,
                    "tw.helper",
                    "Fetched access token from cache"
                );
                // const data = fs.readFileSync(this.accessTokenUserFile, "utf8");
                // this.accessToken = data.
                this.accessToken = data.access_token;
                this.accessTokenTime = expire;
                this.userRefreshToken = data.refresh_token;
                // fs.writeFileSync(
                //     this.accessTokenExpireFile,
                //     JSON.stringify(new Date(this.accessTokenTime))
                // );
                // Log.logAdvanced(
                //     Log.Level.INFO,
                //     "tw.helper",
                //     `Access token expires at ${format(this.accessTokenTime, Config.getInstance().dateFormat)}`
                // );
                return this.accessToken;
            }
        }

        Log.logAdvanced(
            Log.Level.INFO,
            "tw.helper",
            "Refreshing access token, expired"
        );

        const refresh = await this.refreshUserAccessToken();
        if (refresh) {
            return this.accessToken;
        }

        throw new Error("Can't automate user access token, and no user access token found in cache!");

    }

    // static async getAccessTokenUserRefresh(): Promise<string> {
    // 
    //     if (fs.existsSync(this.accessTokenUserRefreshFile)) {
    //         const data: TwitchAuthUserTokenRefreshResponse = JSON.parse(

    static async refreshUserAccessToken(): Promise<boolean> {
        if (this.accessTokenType != "user") {
            Log.logAdvanced(
                Log.Level.ERROR,
                "tw.helper.refreshUserAccessToken",
                "Can't refresh access token, not a user access token!"
            );
            throw new Error("Can't refresh access token, not using a user access token!");
        }

        if (!Config.getInstance().cfg("api_secret") || !Config.getInstance().cfg("api_client_id")) {
            Log.logAdvanced(
                Log.Level.ERROR,
                "tw.helper.refreshUserAccessToken",
                "Missing either api secret or client id, aborting fetching of access token!"
            );
            throw new Error("Missing either api secret or client id, aborting fetching of access token!");
        }

        if (!this.userRefreshToken) {
            Log.logAdvanced(
                Log.Level.ERROR,
                "tw.helper.refreshUserAccessToken",
                "Missing refresh token, aborting fetching of access token!"
            );
            throw new Error("Missing refresh token, aborting fetching of access token!");
        }

        // oauth2
        const oauth_url = "https://id.twitch.tv/oauth2/token";

        let response;
        try {
            response = await axios.post<TwitchAuthUserTokenResponse | ErrorResponse>(
                oauth_url,
                {
                    client_id: Config.getInstance().cfg("api_client_id"),
                    client_secret: Config.getInstance().cfg("api_secret"),
                    grant_type: "refresh_token",
                    refresh_token: encodeURIComponent(this.userRefreshToken),
                },
                {
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                }
            );
        } catch (error) {
            if (axios.isAxiosError(error)) {
                Log.logAdvanced(
                    Log.Level.FATAL,
                    "tw.helper.refreshUserAccessToken",
                    `Tried to refresh oauth token but server returned: ${error.response?.data.message}`
                );
            } else {
                Log.logAdvanced(
                    Log.Level.FATAL,
                    "tw.helper.refreshUserAccessToken",
                    `Tried to refresh oauth token but server returned: ${error}`
                );
            }
            return false;
        }

        if (response.data && "error" in response.data) {
            Log.logAdvanced(
                Log.Level.FATAL,
                "tw.helper.refreshUserAccessToken",
                "Tried to refresh oauth token but server returned: " + response.data.message
            );
            // throw new Error("Tried to refresh oauth token but server returned: " + response.data.message);
            return false;
        }

        const json = response.data;

        this.accessToken = json.access_token;
        this.accessTokenTime = Date.now() + (json.expires_in * 1000);
        this.userRefreshToken = json.refresh_token;

        fs.writeFileSync(this.accessTokenUserRefreshFile, JSON.stringify(json));
        fs.writeFileSync(this.accessTokenUserFile, JSON.stringify(json)); // i don't understand this

        fs.writeFileSync(
            this.accessTokenExpireFile,
            JSON.stringify(new Date(this.accessTokenTime))
        );

        Log.logAdvanced(
            Log.Level.SUCCESS,
            "tw.helper.refreshUserAccessToken",
            `Refreshed user access token, expires at ${new Date(this.accessTokenTime).toISOString()}`
        );

        return true;

    }

    /**
     * For some reason, twitch uses "1h1m1s" for durations, not seconds
     * thanks copilot
     *
     * @param duration
     */
    public static parseTwitchDuration(duration: string) {
        const regex = /(\d+)([a-z]+)/g;
        let match;
        let seconds = 0;
        while ((match = regex.exec(duration)) !== null) {
            const num = parseInt(match[1]);
            const unit = match[2];
            switch (unit) {
            case "h":
                seconds += num * 3600;
                break;
            case "m":
                seconds += num * 60;
                break;
            case "s":
                seconds += num;
                break;
            }
        }
        return seconds;
    }

    public static twitchDuration(seconds: number): string {
        return Helper.getNiceDuration(seconds).replaceAll(" ", "").trim();
        // return trim(str_replace(" ", "", self::getNiceDuration($seconds)));
    }

    public static async eventSubUnsubscribe(subscription_id: string) {
        Log.logAdvanced(
            Log.Level.INFO,
            "tw.helper",
            `Unsubscribing from eventsub id ${subscription_id}`
        );

        if (!this.axios) {
            throw new Error("Axios is not initialized");
        }

        let response;

        try {
            // $response = $this->$guzzler->request("DELETE", "/helix/eventsub/subscriptions?id={$subscription_id}");
            response = await this.axios.delete(
                `/helix/eventsub/subscriptions?id=${subscription_id}`
            );
        } catch (th) {
            Log.logAdvanced(
                Log.Level.FATAL,
                "tw.helper",
                `Unsubscribe from eventsub ${subscription_id} error: ${th}`
            );
            return false;
        }

        if (response.status > 299) {
            Log.logAdvanced(
                Log.Level.FATAL,
                "tw.helper",
                `Unsubscribe from eventsub ${subscription_id} error: ${response.statusText}`
            );
            return false;
        }

        Log.logAdvanced(
            Log.Level.SUCCESS,
            "tw.helper",
            `Unsubscribed from eventsub ${subscription_id} successfully`
        );

        return true;
    }

    // not sure if this is even working correctly, chat is horrible to work with, not even worth it
    static cutChat(
        input: string,
        output: string,
        start_second: number,
        end_second: number,
        overwrite = false
    ): boolean {
        // return new Promise((resolve, reject) => {

        if (!fs.existsSync(input)) {
            throw new Error(`Input file ${input} does not exist`);
        }

        if (!overwrite && fs.existsSync(output)) {
            throw new Error(`Output file ${output} already exists`);
        }

        const json: TwitchCommentDumpTD = JSON.parse(
            fs.readFileSync(input, "utf8")
        );

        // delete comments outside of the time range
        json.comments = json.comments.filter((comment) => {
            return (
                comment.content_offset_seconds >= start_second &&
                comment.content_offset_seconds <= end_second
            );
        });

        // normalize the offset of each comment
        const base_offset = json.comments[0].content_offset_seconds;
        json.comments.forEach((comment) => {
            comment.content_offset_seconds -= base_offset;
        });

        // set length
        // json.video.length = end_second - start_second;
        json.video.start = 0;
        json.video.end = end_second - start_second;
        // json.video.duration = TwitchHelper.twitchDuration(end_second-start_second);

        fs.writeFileSync(output, JSON.stringify(json));

        return fs.existsSync(output) && fs.statSync(output).size > 0;
    }

    /**
     * @deprecated use getSubsList instead
     */
    public static async getSubs(): Promise<Subscriptions | false> {
        Log.logAdvanced(
            Log.Level.INFO,
            "tw.helper.getSubs",
            "Requesting subscriptions list"
        );

        if (!this.axios) {
            throw new Error("Axios is not initialized");
        }

        let response;

        try {
            response = await this.axios.get<Subscriptions>("/helix/eventsub/subscriptions");
        } catch (err) {
            Log.logAdvanced(
                Log.Level.FATAL,
                "tw.helper.getSubs",
                `Subs return: ${err}`
            );
            return false;
        }

        const json = response.data;

        Log.logAdvanced(
            Log.Level.INFO,
            "tw.helper.getSubs",
            `${json.total} subscriptions`
        );

        return json;
    }

    public static async getSubsList(): Promise<Subscription[] | false> {
        Log.logAdvanced(
            Log.Level.INFO,
            "tw.helper.getSubsList",
            "Requesting subscriptions list"
        );

        if (!this.axios) {
            throw new Error("Axios is not initialized");
        }

        let subscriptions: Subscription[] = [];
        let cursor = "";
        const maxpages = 5;
        let page = 0;

        do {
            Log.logAdvanced(
                Log.Level.INFO,
                "tw.helper.getSubsList",
                `Fetch subs page ${page}`
            );

            let response;

            try {
                response = await this.axios.get<Subscriptions>(
                    "/helix/eventsub/subscriptions",
                    {
                        params: {
                            after: cursor,
                        },
                    }
                );
            } catch (err) {
                Log.logAdvanced(
                    Log.Level.FATAL,
                    "tw.helper.getSubsList",
                    `Subs return: ${err}`
                );
                return false;
            }

            const json = response.data;

            subscriptions = subscriptions.concat(json.data);

            cursor = json.pagination.cursor || "";
        } while (cursor && page++ < maxpages);

        Log.logAdvanced(
            Log.Level.INFO,
            "tw.helper.getSubsList",
            `${subscriptions.length} subscriptions`
        );

        if (subscriptions) {
            subscriptions.forEach((sub) => {
                KeyValue.getInstance().set(
                    `${sub.condition.broadcaster_user_id}.sub.${sub.type}`,
                    sub.id
                );
                KeyValue.getInstance().set(
                    `${sub.condition.broadcaster_user_id}.substatus.${sub.type}`,
                    sub.status == "enabled"
                        ? SubStatus.SUBSCRIBED
                        : SubStatus.NONE
                );
            });
        }

        return subscriptions;
    }

    /**
     * Get subscription by ID, this is very hacky since it gets all subscriptions and filters by ID
     *
     * @param id
     * @returns
     */
    public static async getSubscription(
        id: string
    ): Promise<Subscription | false> {
        Log.logAdvanced(
            Log.Level.INFO,
            "tw.helper",
            `Requesting subscription ${id}`
        );

        if (!this.axios) {
            throw new Error("Axios is not initialized");
        }

        const subs = await this.getSubsList();

        if (!subs) {
            return false;
        }

        const sub = subs.find((s) => s.id == id);

        if (!sub) {
            Log.logAdvanced(
                Log.Level.ERROR,
                "tw.helper",
                `Subscription ${id} not found`
            );
            return false;
        }

        return sub;
    }

    public static eventWebsocketSubscribed = false;
    /**
     * Only user access tokens work with this, app access tokens will not work.
     * Gonna have to think this over if it's worth changing the token type and all the connected stuff
     */
    public static connectEventWebsocket() {

        const ws = new WebSocket(this.eventWebsocketUrl);

        ws.on("open", () => {
            Log.logAdvanced(
                Log.Level.INFO,
                "tw.helper",
                `Connected to event websocket at ${this.eventWebsocketUrl}`
            );
        });

        ws.on("message", (data) => {
            console.debug("tw.helper", `Received event websocket message: ${data}`);
            let json;
            try {
                json = JSON.parse(data.toString());
            } catch (err) {
                Log.logAdvanced(
                    Log.Level.ERROR,
                    "tw.helper",
                    `Error parsing event websocket message: ${err}`
                );
                return;
            }

            this.eventWebsocketMessageHandler(json);
        });

        ws.on("close", () => {
            Log.logAdvanced(
                Log.Level.ERROR,
                "tw.helper",
                `Disconnected from event websocket at ${this.eventWebsocketUrl}`
            );
        });
    }

    public static eventWebsocketMessageHandler(json: EventSubWebsocketBaseMessage) {
        const metadata = json.metadata;
        const payload = json.payload;
        console.debug(metadata, payload);
        if (metadata.message_type == "session_welcome") {
            // subscribe to all subscriptions
        }
    }

    public static clearAccessToken() {
        this.axios = undefined;
        this.accessToken = "";
        this.userRefreshToken = "";
        this.userTokenUserId = "";
        this.accessTokenTime = 0;
    }

    public static async validateOAuth(): Promise<boolean> {
        const token = TwitchHelper.accessToken;
        if (TwitchHelper.accessTokenType !== "user") return false;
        if (!token) {
            Log.logAdvanced(
                Log.Level.ERROR,
                "tw.helper",
                "No access token set for validation"
            );
            return false;
        }

        let res;
        try {
            res = await axios.get<TwitchAuthTokenValidationResponse>("https://id.twitch.tv/oauth2/validate", {
                headers: {
                    Authorization: `OAuth ${token}`,
                },
            });
        } catch (error) {
            if (axios.isAxiosError(error)) {
                Log.logAdvanced(Log.Level.ERROR, "tw.helper.validateOAuth", `Failed to validate oauth token: ${error.response?.data?.message}`);
                console.error(error.response?.data);
            } else {
                Log.logAdvanced(Log.Level.ERROR, "tw.helper.validateOAuth", `Failed to validate oauth token: ${(error as Error).message}`, error);
            }
            return false;
        }

        if (res.status === 200) {
            if (res.data.user_id) {
                TwitchHelper.userTokenUserId = res.data.user_id;
                TwitchHelper.accessTokenTime = Date.now() + (res.data.expires_in * 1000);
                Log.logAdvanced(Log.Level.INFO, "tw.helper.validateOAuth", `OAuth token is valid until ${new Date(TwitchHelper.accessTokenTime).toLocaleString()}`);
                return true;
            } else {
                Log.logAdvanced(Log.Level.ERROR, "tw.helper.validateOAuth", "OAuth token is not valid");
                return false;
            }
        } else {
            Log.logAdvanced(Log.Level.ERROR, "tw.helper.validateOAuth", `Failed to validate oauth token: ${res.status} ${res.statusText}`, res.data);
            TwitchHelper.clearAccessToken();
            return false;
        }

    }

}

interface EventSubWebsocketBaseMessage {
    metadata: {
        message_id: string;
        message_type: string;
        message_timestamp: string;
    };
    payload: any;
}

interface EventSubWebsocketSessionMessage extends EventSubWebsocketBaseMessage {
    metadata: {
        message_id: string;
        message_type: "session_welcome";
        message_timestamp: string;
    };
    payload: {
        session: {
            id: string;
            status: string;
            connected_at: string;
            keepalive_timeout_seconds: number;
            reconnect_url: string | null;
        }
    };
}

// TwitchHelper.connectEventWebsocket();
