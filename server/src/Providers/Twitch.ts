import { TwitchCommentDumpTD } from "@common/Comments";
import { SubStatus } from "@common/Defs";
import type { TwitchAuthAppTokenResponse, TwitchAuthTokenValidationResponse, TwitchAuthUserTokenResponse } from "@common/TwitchAPI/Auth";
import { EventSubWebsocketMessage, EventSubWebsocketNotificationMessage } from "@common/TwitchAPI/EventSub/Websocket";
import { ErrorResponse, EventSubTypes, Subscription } from "@common/TwitchAPI/Shared";
import { Subscriptions } from "@common/TwitchAPI/Subscriptions";
import axios, { Axios, AxiosRequestConfig, AxiosResponse } from "axios";
import chalk from "chalk";
import { format, parseJSON } from "date-fns";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { WebSocket } from "ws";
import { BaseConfigCacheFolder, BaseConfigDataFolder } from "../Core/BaseConfig";
import { Config } from "../Core/Config";
import { KeyValue } from "../Core/KeyValue";
import { LiveStreamDVR } from "../Core/LiveStreamDVR";
import { Log } from "../Core/Log";
import { AutomatorMetadata, TwitchAutomator } from "../Core/Providers/Twitch/TwitchAutomator";
import { TwitchChannel } from "../Core/Providers/Twitch/TwitchChannel";
import { getNiceDuration } from "../Helpers/Format";

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
    // static eventSubSessionId = "";

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

    /** @deprecated */
    static readonly PHP_DATE_FORMAT = "yyyy-MM-dd HH:mm:ss.SSSSSS";
    static readonly TWITCH_DATE_FORMAT = "yyyy-MM-dd'T'HH:mm:ss'Z'";
    static readonly TWITCH_DATE_FORMAT_MS = "yyyy-MM-dd'T'HH:mm:ss'.'SSS'Z'";


    public static readonly eventWebsocketUrl = "wss://eventsub-beta.wss.twitch.tv/ws";
    /** @deprecated */
    public static eventWebsocket: WebSocket | undefined;
    public static eventWebsockets: EventWebsocket[] = [];
    // public static eventWebsocketReconnectUrl?: string;
    // public static eventWebsocketSubscribed = false;
    // public static eventWebsocketLastKeepalive?: Date;
    // public static eventWebsocketSubscriptions: Subscription[] = [];
    // public static eventWebsocketTimeoutCheck?: NodeJS.Timeout;
    // public static eventWebsocketConnectedAt?: Date;
    public static eventWebsocketMaxWebsockets = 3;
    public static eventWebsocketMaxSubscriptions = 100;

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
                    `Deleting old access token, too old: ${new Date(expire).toLocaleString()}`
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
                    `Access token expires at ${new Date(this.accessTokenTime).toLocaleString()}`
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

        fs.writeFileSync(
            this.accessTokenExpireFile,
            JSON.stringify(this.accessTokenTime)
        );

        this.accessTokenType = "app";

        this.updateAxiosToken();

        return access_token;
    }

    static async getAccessTokenUser(force = false): Promise<string> {

        const expire = fs.existsSync(this.accessTokenExpireFile) ? parseJSON(fs.readFileSync(this.accessTokenExpireFile, "utf8")).getTime() : 0;

        this.accessTokenType = "user";

        if (Date.now() < expire && !force && this.accessToken && this.accessTokenType == "user") {
            console.debug("Fetched user access token from memory");
            return this.accessToken;
        }

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
                    `Deleting old access token, too old: ${new Date(expire).toLocaleString()}`
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
            this.updateAxiosToken();
            return this.accessToken;
        }

        throw new Error("Can't automate user access token, and no user access token found in cache!");

    }

    // static async getAccessTokenUserRefresh(): Promise<string> {
    // 
    //     if (fs.existsSync(this.accessTokenUserRefreshFile)) {
    //         const data: TwitchAuthUserTokenRefreshResponse = JSON.parse(

    static async refreshUserAccessToken(): Promise<boolean> {
        if (this.accessTokenType !== "user") {
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

        this.updateAxiosToken();

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
        return getNiceDuration(seconds).replaceAll(" ", "").trim();
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
            response = await this.deleteRequest(
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

    /*
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
    */

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
                response = await this.getRequest<Subscriptions>(
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

        // TwitchHelper.eventWebsocketSubscriptions = [];
        TwitchHelper.eventWebsockets.forEach((ws) => {
            ws.removeSubscriptions();
        });

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

                if (sub.transport.method == "websocket") {
                    const session_id = sub.transport.session_id;
                    const ws = TwitchHelper.eventWebsockets.find(ws => ws.sessionId == session_id);
                    if (ws) {
                        ws.addSubscription(sub);
                        // ws.quotas = {
                        //     max: json.
                        // }
                    }
                    if (sub.status == "websocket_disconnected") {
                        // console.debug(chalk.red(`Sub ${sub.id} (websocket) is disconnected`));
                        // this.eventSubUnsubscribe(sub.id); // TODO: should we unsubscribe? would cause a lot of requests
                    }
                }
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

    static async setupAxios() {

        console.log(chalk.blue("Setting up axios..."));

        if (!Config.getInstance().cfg("api_client_id")) {
            console.error(chalk.red("API client id not set, can't setup axios"));
            return;
        }

        let token;
        try {
            token = await TwitchHelper.getAccessToken();
        } catch (error) {
            console.error(chalk.red(`Failed to get access token: ${error}`));
            return;
        }

        if (!token) {
            Log.logAdvanced(Log.Level.FATAL, "tw.helper.setupAxios", "Could not get access token!");
            throw new Error("Could not get access token!");
        }

        if (TwitchHelper.accessTokenType === "user") {
            const validateResult = await TwitchHelper.validateOAuth();
            if (!validateResult) {
                Log.logAdvanced(Log.Level.FATAL, "tw.helper.setupAxios", "Could not validate access token!");
                throw new Error("Could not validate access token!");
            } else {
                Log.logAdvanced(Log.Level.SUCCESS, "tw.helper.setupAxios", "Access token validated!");
            }
        }

        TwitchHelper.axios = axios.create({
            baseURL: "https://api.twitch.tv",
            headers: {
                "Client-ID": Config.getInstance().cfg("api_client_id"),
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
        });

        console.log(chalk.green(`✔ Axios setup with ${TwitchHelper.accessTokenType} token.`));

    }

    public static updateAxiosToken(): boolean {
        if (!TwitchHelper.axios) {
            Log.logAdvanced(Log.Level.ERROR, "config", "Axios not initialized, can't update token");
            return false;
        }
        TwitchHelper.axios.defaults.headers.common["Authorization"] = `Bearer ${TwitchHelper.accessToken}`;
        console.log(chalk.green(`✔ Axios token updated with ${TwitchHelper.accessTokenType} token.`));
        return true;
    }

    public static async getRequest<T>(url: string, config: AxiosRequestConfig = {}, retried = false): Promise<AxiosResponse<T>> {

        if (!TwitchHelper.axios) {
            throw new Error("Axios is not initialized");
        }

        Log.logAdvanced(Log.Level.DEBUG, "tw.helper.getRequest", `Requesting GET ${url} with config ${JSON.stringify(config)}, retried: ${retried}`);

        let response;
        try {
            response = await TwitchHelper.axios.get<T>(url, config);
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 401 && !retried) { // 401 Unauthorized, don't retry if already retried
                Log.logAdvanced(Log.Level.WARNING, "tw.helper", "Access token expired during get request");
                if (this.accessTokenType === "user") {
                    await TwitchHelper.refreshUserAccessToken();
                } else {
                    // TwitchHelper.refreshAppAccessToken();
                    await TwitchHelper.getAccessToken(true);
                }
                return TwitchHelper.getRequest(url, config, true);
            } else {
                Log.logAdvanced(Log.Level.DEBUG, "tw.helper", `Error during get request: ${error}`, error);
            }
            throw error;
        }

        return response;
    }

    public static async postRequest<T>(url: string, data: any, config: AxiosRequestConfig = {}, retried = false): Promise<AxiosResponse<T>> {

        if (!TwitchHelper.axios) {
            throw new Error("Axios is not initialized");
        }

        Log.logAdvanced(Log.Level.DEBUG, "tw.helper.postRequest", `Requesting POST ${url} with data ${JSON.stringify(data)} and config ${JSON.stringify(config)}, retried: ${retried}`);

        let response;
        try {
            response = await TwitchHelper.axios.post<T>(url, data, config);
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 401 && !retried) { // 401 Unauthorized, don't retry if already retried
                Log.logAdvanced(Log.Level.WARNING, "tw.helper", "Access token expired, during post request");
                if (this.accessTokenType === "user") {
                    await TwitchHelper.refreshUserAccessToken();
                } else {
                    // TwitchHelper.refreshAppAccessToken();
                    await TwitchHelper.getAccessToken(true);
                }
                return TwitchHelper.postRequest(url, data, config, true);
            }
            throw error;
        }

        return response;
    }

    public static async deleteRequest<T>(url: string, config: AxiosRequestConfig = {}, retried = false): Promise<AxiosResponse<T>> {

        if (!TwitchHelper.axios) {
            throw new Error("Axios is not initialized");
        }

        Log.logAdvanced(Log.Level.DEBUG, "tw.helper.deleteRequest", `Requesting DELETE ${url} with config ${JSON.stringify(config)}, retried: ${retried}`);

        let response;
        try {
            response = await TwitchHelper.axios.delete<T>(url, config);
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 401 && !retried) { // 401 Unauthorized, don't retry if already retried
                Log.logAdvanced(Log.Level.WARNING, "tw.helper", "Access token expired, during delete request");
                if (this.accessTokenType === "user") {
                    await TwitchHelper.refreshUserAccessToken();
                } else {
                    // TwitchHelper.refreshAppAccessToken();
                    await TwitchHelper.getAccessToken(true);
                }
                return TwitchHelper.deleteRequest(url, config, true);
            }
            throw error;
        }

        return response;
    }

    public static async setupWebsocket() {
        this.removeAllEventWebsockets();
        if (Config.getInstance().cfg("twitchapi.eventsub_type") == "websocket") {    
            const subs = await this.getSubsList();
            if (subs && subs.length > 0) {
                // let promiseList: Promise<boolean>[] = [];
                for (const sub of subs) {
                    if (sub.status == "websocket_disconnected") {
                        /**
                         * Websocket eventsub subscriptions get removed after 1 hour of inactivity.
                         * This unsubscribe call is mostly for the case where the server is restarted or for development purposes.
                         */
                        if (Config.getInstance().cfg("twitchapi.eventsub_unsub_on_start")) {
                            // console.debug(chalk.red(`Sub ${sub.id} (websocket) is disconnected and unsub_on_start is enabled, unsubscribing...`));
                            await this.eventSubUnsubscribe(sub.id); // just make it a config option
                            // promiseList.push(this.eventSubUnsubscribe(sub.id));
                        }
                    }
                }
                // await Promise.all(promiseList);
            }
            // this.connectEventWebsocket();
            this.createNewWebsocket(this.eventWebsocketUrl, true);

            if (Config.debug) {
                setTimeout(() => {
                    this.printWebsockets();
                }, 20000);
                console.log(chalk.green("✔ Websocket setup (debug mode)"));
            } else {
                console.log(chalk.green("✔ Websocket setup"));
            }
        } else {
            Log.logAdvanced(
                Log.Level.INFO,
                "tw.helper",
                "Eventsub is not using websocket"
            );
        }
    }

    public static removeEventWebsocket(id: string): boolean {
        const index = this.eventWebsockets.findIndex((sub) => sub.id == id);
        if (index > -1) {
            Log.logAdvanced(Log.Level.DEBUG, "tw.helper", `Removing websocket ${id}`);
            return this.eventWebsockets[index].disconnectAndRemove();
        } else {
            Log.logAdvanced(
                Log.Level.INFO,
                "tw.helper",
                `Eventsub websocket ${id} not found`
            );
            return false;
        }
    }

    public static removeAllEventWebsockets(): void {
        this.eventWebsockets.forEach((sub) => {
            this.removeEventWebsocket(sub.id);
        });
    }

    /*
    public static connectEventWebsocket() {

        if (TwitchHelper.accessTokenType !== "user") {
            Log.logAdvanced(
                Log.Level.ERROR,
                "tw.helper",
                "Eventsub websocket requires user access token"
            );
            return;
        }

        if (this.eventWebsocket) {
            Log.logAdvanced(
                Log.Level.ERROR,
                "tw.helper",
                "Eventsub websocket already exists"
            );
            return;
        }

        if (this.eventWebsocketReconnectUrl) {
            Log.logAdvanced(
                Log.Level.INFO,
                "tw.helper",
                `Eventsub websocket using reconnect url: ${this.eventWebsocketReconnectUrl}`
            );
        }

        const ws = new WebSocket(this.eventWebsocketReconnectUrl || this.eventWebsocketUrl);

        ws.on("open", () => {
            Log.logAdvanced(
                Log.Level.INFO,
                "tw.helper",
                `Connected to event websocket at ${this.eventWebsocketUrl}`
            );
        });

        ws.on("message", (data) => {
            // console.debug("tw.helper", `Received event websocket message: ${data}`);
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

            if (json.metadata && json.metadata.message_type) json._type = json.metadata.message_type; // hack for discriminated unions

            this.eventWebsocketMessageHandler(json);
        });

        ws.on("close", (code) => {

            /*
            4000 	Internal server error 	        Indicates a problem with the server (similar to an HTTP 500 status code).
            4001 	Client sent inbound traffic 	Sending outgoing messages to the server is prohibited with the exception of pong messages.
            4002 	Client failed ping-pong 	    You must respond to ping messages with a pong message. See Ping message.
            4003 	Connection unused 	            When you connect to the server, you must create a subscription within 10 seconds or the connection is closed. The time limit is subject to change.
            4004 	Reconnect grace time expired 	When you receive a session_reconnect message, you have 30 seconds to reconnect to the server and close the old connection. See Reconnect message.
            4005 	Network timeout 	            Transient network timeout.
            4006 	Network error 	                Transient network error.
            4007 	Invalid reconnect 	            The reconnect URL is invalid.
            *

            if (code === 4003) {
                Log.logAdvanced(
                    Log.Level.ERROR,
                    "tw.helper",
                    `Disconnected from event websocket at ${this.eventWebsocketUrl} (code ${code} - connection unused, not subscribed)`
                );
            } else if (code === 4004) {
                Log.logAdvanced(
                    Log.Level.ERROR,
                    "tw.helper",
                    `Disconnected from event websocket at ${this.eventWebsocketUrl} (code ${code} - didn't disconnect from old connection in time or didn't reconnect)`
                );
            } else {
                Log.logAdvanced(
                    Log.Level.ERROR,
                    "tw.helper",
                    `Disconnected from event websocket at ${this.eventWebsocketUrl} (code ${code})`
                );
            }

        });
        ws.on("error", (err) => {
            Log.logAdvanced(
                Log.Level.ERROR,
                "tw.helper",
                `Error on event websocket: ${err}`,
                err
            );
        });

        if (this.eventWebsocketTimeoutCheck) {
            clearTimeout(this.eventWebsocketTimeoutCheck);
        }

        this.eventWebsocketTimeoutCheck = setTimeout(() => {
            if (this.eventWebsocketLastKeepalive) {
                const diff = new Date().getTime() - this.eventWebsocketLastKeepalive.getTime();
                if (diff > 60000) {
                    Log.logAdvanced(
                        Log.Level.ERROR,
                        "tw.helper",
                        `Event websocket hasn't received a keepalive in ${diff}ms`
                    );
                }
            }
        }, 60000);

        this.eventWebsocket = ws;
    }
    */

    public static createNewWebsocket(url: string, autoSubscribe = false): Promise<EventWebsocket> {

        return new Promise<EventWebsocket>((resolve, reject) => {

            const randomId = randomUUID().substring(0, 8);

            if (this.eventWebsockets.length >= this.eventWebsocketMaxWebsockets) {
                Log.logAdvanced(
                    Log.Level.ERROR,
                    "tw.helper",
                    `Eventsub websocket limit of ${this.eventWebsocketMaxWebsockets} reached`
                );
                reject(new Error("Eventsub websocket limit reached"));
            }

            Log.logAdvanced(
                Log.Level.INFO,
                "tw.helper.ws",
                `Creating new websocket ${randomId} at ${url}`
            );

            const ws = new EventWebsocket(randomId, url);
            ws.autoSubscribe = autoSubscribe;
            ws.setup();
            this.eventWebsockets.push(ws);

            Log.logAdvanced(
                Log.Level.INFO,
                "tw.helper.ws",
                `We now have ${this.eventWebsockets.length} websockets, at a maximum of ${this.eventWebsocketMaxWebsockets}`
            );

            ws.onValidated = (sessionId, success) => {
                if (success) {
                    resolve(ws);
                } else {
                    reject(new Error("Eventsub websocket validation failed"));
                }
            };

        });

    }

    public static handleWebsocketReconnect(previousId: string, newUrl: string) {
        Log.logAdvanced(
            Log.Level.INFO,
            "tw.helper",
            `Received event websocket reconnect message for ${previousId} to ${newUrl}`
        );
        this.removeEventWebsocket(previousId);
        this.createNewWebsocket(newUrl);
    }

    public static findWebsocketSubscriptionBearer(user_id: string, sub_type: EventSubTypes): EventWebsocket | false {
        const ws = this.eventWebsockets.find((w) => w.getSubscriptions().find((s) => s.condition.broadcaster_user_id === user_id && s.type === sub_type));
        if (ws) {
            return ws;
        }
        return false;
    }

    public static printWebsockets() {
        if (LiveStreamDVR.shutting_down) return;
        console.log(chalk.yellow(`Current websockets: ${this.eventWebsockets.length}`));
        this.eventWebsockets.forEach((ws) => {
            console.log(`\t${ws.id} - ${ws.currentUrl}`);
            if (ws.quotas) {
                for (const [key, value] of Object.entries(ws.quotas)) {
                    console.log(`\t\t${key}: ${value}`);
                }
            } else {
                console.log("\t\tNo quotas");
            }
            console.log(`\t\tSession ID: ${ws.sessionId}`);
            console.log(`\t\tLast keepalive: ${ws.lastKeepalive}`);
            console.log(`\t\tSubscriptions: ${ws.getSubscriptions().length}`);
            ws.getSubscriptions().forEach((s) => {
                console.log(`\t\t\ttype: ${s.type} - user: ${s.condition.broadcaster_user_id} - status: ${s.status} - created: ${s.created_at} - cost: ${s.cost}`);
            });
            console.log(`\t\tIs available: ${ws.isAvailable(TwitchHelper.CHANNEL_SUB_TYPES.length)}`);
            console.log("");
        });
    }

    public static clearAccessToken() {
        Log.logAdvanced(
            Log.Level.INFO,
            "tw.helper",
            "Clearing access token from memory"
        );
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
                fs.writeFileSync(
                    this.accessTokenExpireFile,
                    JSON.stringify(new Date(this.accessTokenTime))
                );
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

/*
interface EventWebsocket {
    id: string;
    ws: WebSocket;
    sessionId?: string;
    reconnectUrl?: string;
    lastKeepalive?: Date;
    timeoutCheck?: NodeJS.Timeout;
    connectedAt?: Date;
    disconnectedAt?: Date;
    subscriptions: Subscription[];
}
*/

export class EventWebsocket {
    public id: string;
    public ws?: WebSocket;
    public sessionId?: string;
    public currentUrl: string;
    public reconnectUrl?: string;
    public lastKeepalive?: Date;
    public timeoutCheck?: NodeJS.Timeout;
    public connectedAt?: Date;
    public disconnectedAt?: Date;
    private subscriptions: Subscription[];
    public autoSubscribe = false;

    public onValidated?: (sessionId: string, success: boolean) => void;
    public isValidated = false;

    public quotas?: {
        max_total_cost: number;
        total_cost: number;
        total: number;
    };

    constructor(id: string, url: string) {
        this.id = id;
        this.currentUrl = url;
        this.subscriptions = [];
    }

    setup() {
        const ws = new WebSocket(this.currentUrl);

        ws.on("open", () => {
            Log.logAdvanced(
                Log.Level.INFO,
                "tw.helper.ew",
                `Connected to ${this.currentUrl} (${this.id})`
            );
        });

        ws.on("message", (data) => {
            // console.debug("tw.helper", `Received event websocket message: ${data}`);
            let json;
            try {
                json = JSON.parse(data.toString());
            } catch (err) {
                Log.logAdvanced(
                    Log.Level.ERROR,
                    "tw.helper.ew",
                    `Error parsing event websocket message for ${this.id}: ${err}`
                );
                return;
            }

            if (json.metadata && json.metadata.message_type) json._type = json.metadata.message_type; // hack for discriminated unions

            this.eventWebsocketMessageHandler(json);
        });

        ws.on("close", (code) => {

            /*
            4000 	Internal server error 	        Indicates a problem with the server (similar to an HTTP 500 status code).
            4001 	Client sent inbound traffic 	Sending outgoing messages to the server is prohibited with the exception of pong messages.
            4002 	Client failed ping-pong 	    You must respond to ping messages with a pong message. See Ping message.
            4003 	Connection unused 	            When you connect to the server, you must create a subscription within 10 seconds or the connection is closed. The time limit is subject to change.
            4004 	Reconnect grace time expired 	When you receive a session_reconnect message, you have 30 seconds to reconnect to the server and close the old connection. See Reconnect message.
            4005 	Network timeout 	            Transient network timeout.
            4006 	Network error 	                Transient network error.
            4007 	Invalid reconnect 	            The reconnect URL is invalid.
            */

            if (code === 4003) {
                Log.logAdvanced(
                    Log.Level.ERROR,
                    "tw.helper.ew",
                    `Disconnected from event websocket at ${this.currentUrl} (code ${code} - connection unused, not subscribed)`
                );
            } else if (code === 4004) {
                Log.logAdvanced(
                    Log.Level.ERROR,
                    "tw.helper.ew",
                    `Disconnected from event websocket at ${this.currentUrl} (code ${code} - didn't disconnect from old connection in time or didn't reconnect)`
                );
            } else {
                Log.logAdvanced(
                    Log.Level.ERROR,
                    "tw.helper.ew",
                    `Disconnected from event websocket at ${this.currentUrl} (code ${code})`
                );
            }

            if (!this.isValidated && this.onValidated) {
                this.onValidated(this.sessionId || "", false);
            }

            if (this.timeoutCheck) {
                clearTimeout(this.timeoutCheck);
            }

            this.disconnectAndRemove();

        });

        ws.on("error", (err) => {
            Log.logAdvanced(
                Log.Level.ERROR,
                "tw.helper.ew",
                `Error on event websocket: ${err}`,
                err
            );
        });

        // if (this.eventWebsocketTimeoutCheck) {
        //     clearTimeout(this.eventWebsocketTimeoutCheck);
        // }

        this.timeoutCheck = setTimeout(() => {
            if (this.lastKeepalive) {
                const diff = new Date().getTime() - this.lastKeepalive.getTime();
                if (diff > 60000) {
                    Log.logAdvanced(
                        Log.Level.ERROR,
                        "tw.helper.ew",
                        `Event websocket hasn't received a keepalive in ${diff}ms (${this.id})`
                    );
                }
            }
        }, 60000);
    }

    public disconnectAndRemove(): boolean {

        Log.logAdvanced(
            Log.Level.INFO,
            "tw.helper.ew",
            `Disconnecting and removing EventWebsocket at ${this.currentUrl} (${this.id})`
        );

        if (this.timeoutCheck) {
            clearTimeout(this.timeoutCheck);
        }
        if (this.ws) {
            this.ws.close();
        } else {
            Log.logAdvanced(
                Log.Level.INFO,
                "tw.helper.ew",
                `EventWebsocket websocket ${this.id} is already disconnected`
            );
        }

        const index = TwitchHelper.eventWebsockets.findIndex((ws) => ws.id === this.id);
        if (index > -1) {
            TwitchHelper.eventWebsockets.splice(index, 1);
            Log.logAdvanced(
                Log.Level.INFO,
                "tw.helper.ew",
                `Removed event websocket ${this.id}, now ${TwitchHelper.eventWebsockets.length} websockets out of a maximum of ${TwitchHelper.eventWebsocketMaxWebsockets}`
            );
            return true;
        } else {
            Log.logAdvanced(
                Log.Level.ERROR,
                "tw.helper.ew",
                `Couldn't remove event websocket ${this.id}, it wasn't found in the list of websockets`
            );
        }
        return false;
    }

    public eventWebsocketMessageHandler(json: EventSubWebsocketMessage): void {

        if (json._type === "session_welcome") {
            this.sessionId = json.payload.session.id;
            console.debug("tw.helper.ew", `Received session_welcome event websocket message for ${this.id}: ${this.sessionId}`);
            console.debug("tw.helper.ew", `Event websocket session id: ${this.sessionId}`);
            console.debug("tw.helper.ew", `Event websocket keepalive: ${json.payload.session.keepalive_timeout_seconds}`);
            console.debug("tw.helper.ew", `Event websocket status: ${json.payload.session.status}`);
            console.debug("tw.helper.ew", `Event websocket reconnect url: ${json.payload.session.reconnect_url}`);

            this.isValidated = true;
            if (this.onValidated) {
                this.onValidated(this.sessionId, true);
            }

            // subscribe to all subscriptions
            if (this.autoSubscribe) {
                TwitchChannel.subscribeToAllChannels();
            }

            this.connectedAt = new Date(json.payload.session.connected_at);

        } else if (json._type === "session_keepalive") {
            this.lastKeepalive = parseJSON(json.metadata.message_timestamp);
            // console.debug("tw.helper.ew", `Event websocket keepalive at ${this.eventWebsocketLastKeepalive}`);
            // this is a keepalive, do nothing. it spams the console every 10 seconds

        } else if (json._type === "notification") {
            console.debug("tw.helper.ew", "Event websocket notification", json);
            this.eventSubNotificationHandler(json);

        } else if (json._type === "session_reconnect") {
            console.debug("tw.helper.ew", "Event websocket reconnect", json);
            console.debug("tw.helper.ew", `Event websocket reconnect new url: ${json.payload.session.reconnect_url}`);
            TwitchHelper.handleWebsocketReconnect(this.id, json.payload.session.reconnect_url);

        } else if (json._type === "revocation") {
            console.debug("tw.helper.ew", "Event websocket revocation", json);
            // json.payload.subscription
            /*
            const index = this.subscriptions.findIndex((s) => s.id === json.payload.subscription.id);
            if (index > -1) {
                this.subscriptions.splice(index, 1);
                console.debug("tw.helper.ew", `Event websocket revocation removed subscription ${json.payload.subscription.id}`);
            } else {
                console.debug("tw.helper.ew", `Event websocket revocation subscription ${json.payload.subscription.id} not found`);
            }
            */
            Log.logAdvanced(
                Log.Level.ERROR,
                "tw.helper.ew",
                `Event websocket revocation: ${json.payload.subscription.id}`
            );
            this.removeSubscription(json.payload.subscription.id);
        } else {
            console.debug("tw.helper.ew", "Event websocket unknown message", json);

        }
    }

    public eventSubNotificationHandler(message: EventSubWebsocketNotificationMessage): void {

        if (Config.debug || Config.getInstance().cfg<boolean>("dump_payloads")) {
            let payload_filename = `tw_ew_${new Date().toISOString().replaceAll(/[-:.]/g, "_")}`;
            if (message.payload.subscription.type) payload_filename += `_${message.payload.subscription.type}`;
            payload_filename += ".json";
            const payload_filepath = path.join(BaseConfigDataFolder.payloads, payload_filename);
            Log.logAdvanced(Log.Level.INFO, "hook", `Dumping debug hook payload to ${payload_filepath}`);
            try {
                fs.writeFileSync(payload_filepath, JSON.stringify({
                    body: message,
                }, null, 4));
            } catch (error) {
                Log.logAdvanced(Log.Level.ERROR, "hook", `Failed to dump payload to ${payload_filepath}`, error);
            }

        }

        const metadata_proxy: AutomatorMetadata = {
            message_id: message.metadata.message_id,
            message_retry: 0, // not supported with websockets
            message_type: message.metadata.message_type,
            message_signature: "", // not supported with websockets
            message_timestamp: message.metadata.message_timestamp,
            subscription_type: message.metadata.subscription_type,
            subscription_version: message.metadata.subscription_version,
        };

        const TA = new TwitchAutomator();

        /* await */ TA.handle(message.payload, metadata_proxy).catch(error => {
            Log.logAdvanced(Log.Level.FATAL, "hook", `Automator returned error: ${error.message}`);
        });

    }

    /**
     * Add subscription to the list
     * 
     * The max cost for websocket subscriptions is just 10 due to it only allowing user access tokens.
     * This makes it quite useless to use, but one can hope that Twitch will change this in the future.
     * 
     * @param subscription 
     */
    public addSubscription(subscription: Subscription): void {
        this.subscriptions.push(subscription);
        if (this.subscriptions.length > TwitchHelper.eventWebsocketMaxSubscriptions) {
            Log.logAdvanced(
                Log.Level.ERROR,
                "tw.helper.ew",
                `Event websocket ${this.id} has too many subscriptions (${this.subscriptions.length})`
            );
        } else {
            Log.logAdvanced(
                Log.Level.DEBUG,
                "tw.helper.ew",
                `Added subscription ${subscription.id} to event websocket ${this.id}, now ${this.subscriptions.length} subscriptions (quota ${this.quotas?.total_cost}/${this.quotas?.max_total_cost})`
            );
        }
    }

    public removeSubscription(id: string): boolean {
        const index = this.subscriptions.findIndex((s) => s.id === id);
        if (index > -1) {
            this.subscriptions.splice(index, 1);
            Log.logAdvanced(
                Log.Level.INFO,
                "tw.helper.ew",
                `Removed subscription ${id} from event websocket ${this.id}, now ${this.subscriptions.length} subscriptions`
            );
            if (this.subscriptions.length === 0) {
                this.disconnectAndRemove();
            }
            return true;
        } else {
            Log.logAdvanced(
                Log.Level.ERROR,
                "tw.helper.ew",
                `Failed to remove subscription ${id} from event websocket ${this.id}, not found`
            );
            return false;
        }
    }

    public getSubscriptions(): Subscription[] {
        return this.subscriptions;
    }

    public removeSubscriptions() {
        this.subscriptions = [];
    }

    public isAvailable(amountWanted: number): boolean {
        if ((this.subscriptions.length + amountWanted) > TwitchHelper.eventWebsocketMaxSubscriptions) return false;
        if (
            this.quotas &&
            this.quotas.total_cost &&
            this.quotas.max_total_cost &&
            this.quotas.total_cost + amountWanted > this.quotas.max_total_cost
        ) return false;
        return true;
    }

}

// TwitchHelper.connectEventWebsocket();
