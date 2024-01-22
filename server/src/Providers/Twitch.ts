import { BaseConfigCacheFolder, BaseConfigDataFolder } from "@/Core/BaseConfig";
import { Config } from "@/Core/Config";
import { Helper } from "@/Core/Helper";
import { KeyValue } from "@/Core/KeyValue";
import { LiveStreamDVR } from "@/Core/LiveStreamDVR";
import { LOGLEVEL, censoredLogWords, log } from "@/Core/Log";
import type { AutomatorMetadata } from "@/Core/Providers/Twitch/TwitchAutomator";
import { TwitchAutomator } from "@/Core/Providers/Twitch/TwitchAutomator";
import { TwitchChannel } from "@/Core/Providers/Twitch/TwitchChannel";
import { execSimple } from "@/Helpers/Execute";
import { getNiceDuration } from "@/Helpers/Format";
import { xClearTimeout, xTimeout } from "@/Helpers/Timeout";
import type { TwitchCommentDumpTD } from "@common/Comments";
import { SubStatus } from "@common/Defs";
import type {
    TwitchAuthAppTokenResponse,
    TwitchAuthTokenValidationResponse,
    TwitchAuthUserTokenResponse,
} from "@common/TwitchAPI/Auth";
import type {
    ChatBadge,
    ChatBadgesResponse,
    GlobalChatBadgesResponse,
} from "@common/TwitchAPI/Badges";
import type {
    EventSubWebsocketMessage,
    EventSubWebsocketNotificationMessage,
} from "@common/TwitchAPI/EventSub/Websocket";
import type { GqlResponse } from "@common/TwitchAPI/GQL/Shared";
import type {
    ErrorResponse,
    EventSubTypes,
    Subscription,
} from "@common/TwitchAPI/Shared";
import type { Subscriptions } from "@common/TwitchAPI/Subscriptions";
import type { Axios, AxiosRequestConfig, AxiosResponse } from "axios";
import axios from "axios";
import chalk from "chalk";
import { format, parseJSON } from "date-fns";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { WebSocket } from "ws";

interface TwitchAuthAppTokenFile {
    access_token: string;
    expires_at: number;
    expires_in: number;
    token_type: string;
}

interface TwitchAuthUserTokenFile {
    access_token: string;
    expires_at: number;
    expires_in: number;
    refresh_token: string;
    scope: string[];
    token_type: string;
}

/**
 * For some reason, twitch uses "1h1m1s" for durations, not seconds
 * thanks copilot
 *
 * @param duration
 */
export function parseTwitchDuration(duration: string) {
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

export function twitchDuration(seconds: number): string {
    return getNiceDuration(seconds).replaceAll(" ", "").trim();
}

export class TwitchHelper {
    public static accessToken = "";
    public static accessTokenType?: "user" | "app";
    public static accessTokenTime = 0;
    public static userRefreshToken = "";
    public static userTokenUserId = "";
    // static eventSubSessionId = "";

    // static readonly accessTokenAppFileLegacy = path.join(
    //     BaseConfigCacheFolder.cache,
    //     "oauth.bin"
    // );

    public static readonly accessTokenAppFile = path.join(
        BaseConfigCacheFolder.cache,
        "oauth_app.json"
    );

    public static readonly accessTokenUserFile = path.join(
        BaseConfigCacheFolder.cache,
        "oauth_user.json"
    );

    public static readonly accessTokenUserRefreshFile = path.join(
        BaseConfigCacheFolder.cache,
        "oauth_user_refresh.json"
    );

    public static readonly TWITCH_DATE_FORMAT = "yyyy-MM-dd'T'HH:mm:ss'Z'";
    public static readonly TWITCH_DATE_FORMAT_MS =
        "yyyy-MM-dd'T'HH:mm:ss'.'SSS'Z'";

    public static readonly eventWebsocketUrl =
        "wss://eventsub.wss.twitch.tv/ws";
    /** @deprecated */
    public static eventWebsocket: WebSocket | undefined;
    public static eventWebsockets: EventWebsocket[] = [];

    public static eventWebsocketMaxWebsockets = 3;
    public static eventWebsocketMaxSubscriptions = 300;

    public static readonly CHANNEL_SUB_TYPES: EventSubTypes[] = [
        "stream.online",
        "stream.offline",
        "channel.update",
    ];
    private static axios: Axios | undefined;

    public static async getAccessToken(force = false): Promise<string> {
        if (Config.getInstance().cfg("twitchapi.auth_type") == "app") {
            return await this.getAccessTokenApp(force);
        } else {
            return await this.getAccessTokenUser(force);
        }
    }

    public static getAxios(): Axios | undefined {
        return this.axios;
    }

    public static hasAxios(): boolean {
        return this.getAxios() !== undefined;
    }

    public static async getAccessTokenApp(force = false): Promise<string> {
        // const expire = fs.existsSync(this.accessTokenExpireFile) ? parseJSON(fs.readFileSync(this.accessTokenExpireFile, "utf8")).getTime() : 0;

        if (fs.existsSync(this.accessTokenAppFile)) {
            const data: TwitchAuthAppTokenFile = JSON.parse(
                fs.readFileSync(this.accessTokenAppFile, "utf8")
            );

            const expire = data.expires_at || 0;

            if (Date.now() > expire) {
                log(
                    LOGLEVEL.INFO,
                    "tw.helper.getAccessTokenApp",
                    `Deleting old app access token, too old: ${new Date(
                        expire
                    ).toLocaleString()}`
                );
                fs.unlinkSync(this.accessTokenAppFile);
            } else if (!force) {
                log(
                    LOGLEVEL.DEBUG,
                    "tw.helper.getAccessTokenApp",
                    "Fetched app access token from cache"
                );
                this.accessTokenType = "app";

                this.accessToken = data.access_token;
                this.accessTokenTime = expire;
                log(
                    LOGLEVEL.INFO,
                    "tw.helper.getAccessTokenApp",
                    `Stored app access token expires at ${new Date(
                        this.accessTokenTime
                    ).toLocaleString()}`
                );
                return this.accessToken;
            }
        }

        if (
            !Config.getInstance().hasValue("api_secret") ||
            !Config.getInstance().hasValue("api_client_id")
        ) {
            log(
                LOGLEVEL.ERROR,
                "tw.helper.getAccessTokenApp",
                "Missing either api secret or client id, aborting fetching of access token!"
            );
            throw new Error(
                "Missing either api secret or client id, aborting fetching of access token!"
            );
        }

        // oauth2
        const oauthUrl = "https://id.twitch.tv/oauth2/token";

        const response = await axios.post<TwitchAuthAppTokenResponse>(
            oauthUrl,
            {
                client_id: Config.getInstance().cfg("api_client_id"),
                client_secret: Config.getInstance().cfg("api_secret"),
                grant_type: "client_credentials",
            },
            {
                headers: {
                    "Client-ID": Config.getInstance().cfg("api_client_id", ""),
                },
            }
        );

        if (response.status != 200) {
            log(
                LOGLEVEL.FATAL,
                "tw.helper.getAccessTokenApp",
                `Tried to get oauth token but server returned: ${response.statusText}`
            );
            throw new Error(
                `Tried to get oauth token but server returned: ${response.statusText}`
            );
        }

        const json = response.data;

        if (!json || !json.access_token) {
            log(
                LOGLEVEL.ERROR,
                "tw.helper.getAccessTokenApp",
                `Failed to fetch app access token: ${JSON.stringify(json)}`
            );
            throw new Error(
                `Failed to fetch access token: ${JSON.stringify(json)}`
            );
        }

        const accessToken = json.access_token;

        const expiresAt = Date.now() + json.expires_in * 1000;

        this.accessToken = accessToken;
        this.accessTokenTime = expiresAt;

        fs.writeFileSync(
            this.accessTokenAppFile,
            JSON.stringify({
                access_token: accessToken,
                expires_at: expiresAt,
                expires_in: json.expires_in,
                token_type: json.token_type,
            } as TwitchAuthAppTokenFile)
        );

        log(
            LOGLEVEL.INFO,
            "tw.helper.getAccessTokenApp",
            `Fetched new app access token, expires at ${format(
                expiresAt,
                Config.getInstance().dateFormat
            )}`
        );

        this.accessTokenType = "app";

        this.updateAxiosToken();

        return accessToken;
    }

    public static async getAccessTokenUser(force = false): Promise<string> {
        // const expire = fs.existsSync(this.accessTokenExpireFile) ? parseJSON(fs.readFileSync(this.accessTokenExpireFile, "utf8")).getTime() : 0;

        this.accessTokenType = "user";

        // if (Date.now() < expire && !force && this.accessToken && this.accessTokenType == "user") {
        //     console.debug("Fetched user access token from memory");
        //     return this.accessToken;
        // }

        if (fs.existsSync(this.accessTokenUserFile)) {
            const data: TwitchAuthUserTokenFile = JSON.parse(
                fs.readFileSync(this.accessTokenUserFile, "utf8")
            );

            const expire = data.expires_at || 0;

            if (
                Date.now() < expire &&
                !force &&
                this.accessToken &&
                this.accessTokenType == "user"
            ) {
                log(
                    LOGLEVEL.DEBUG,
                    "tw.helper.getAccessTokenUser",
                    "Fetched user access token from cache"
                );
                this.accessToken = data.access_token;
                this.accessTokenTime = expire;
                this.userRefreshToken = data.refresh_token;
                log(
                    LOGLEVEL.INFO,
                    "tw.helper.getAccessTokenUser",
                    `User access token expires at ${new Date(
                        this.accessTokenTime
                    ).toLocaleString()}`
                );
                return this.accessToken;
            }

            this.userRefreshToken = data.refresh_token;

            if (Date.now() > expire) {
                log(
                    LOGLEVEL.INFO,
                    "tw.helper",
                    `Deleting old user access token, too old: ${new Date(
                        expire
                    ).toLocaleString()}`
                );
                // fs.unlinkSync(this.accessTokenUserFile);
            } else if (!force) {
                log(
                    LOGLEVEL.DEBUG,
                    "tw.helper",
                    "Fetched user access token from cache"
                );
                // const data = fs.readFileSync(this.accessTokenUserFile, "utf8");
                // this.accessToken = data.
                this.accessToken = data.access_token;
                this.accessTokenTime = expire;
                this.userRefreshToken = data.refresh_token;
                log(
                    LOGLEVEL.INFO,
                    "tw.helper",
                    `User access token expires at ${new Date(
                        this.accessTokenTime
                    ).toLocaleString()}`
                );
                return this.accessToken;
            }
        }

        log(LOGLEVEL.INFO, "tw.helper", "Refreshing access token, expired");

        const refresh = await this.refreshUserAccessToken();
        if (refresh) {
            this.updateAxiosToken();
            return this.accessToken;
        }

        throw new Error(
            "Can't automate user access token, and no user access token found in cache!"
        );
    }

    // static async getAccessTokenUserRefresh(): Promise<string> {
    //
    //     if (fs.existsSync(this.accessTokenUserRefreshFile)) {
    //         const data: TwitchAuthUserTokenRefreshResponse = JSON.parse(

    public static async refreshUserAccessToken(): Promise<boolean> {
        if (this.accessTokenType !== "user") {
            log(
                LOGLEVEL.ERROR,
                "tw.helper.refreshUserAccessToken",
                "Can't refresh access token, not a user access token!"
            );
            throw new Error(
                "Can't refresh access token, not using a user access token!"
            );
        }

        if (
            !Config.getInstance().hasValue("api_secret") ||
            !Config.getInstance().hasValue("api_client_id")
        ) {
            log(
                LOGLEVEL.ERROR,
                "tw.helper.refreshUserAccessToken",
                "Missing either api secret or client id, aborting fetching of access token!"
            );
            throw new Error(
                "Missing either api secret or client id, aborting fetching of access token!"
            );
        }

        if (!this.userRefreshToken) {
            log(
                LOGLEVEL.ERROR,
                "tw.helper.refreshUserAccessToken",
                "Missing refresh token, aborting fetching of access token!"
            );
            throw new Error(
                "Missing refresh token, aborting fetching of access token!"
            );
        }

        // oauth2
        const oauthUrl = "https://id.twitch.tv/oauth2/token";

        let response;
        try {
            response = await axios.post<
                TwitchAuthUserTokenResponse | ErrorResponse
            >(
                oauthUrl,
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
            if (axios.isAxiosError<ErrorResponse>(error)) {
                log(
                    LOGLEVEL.FATAL,
                    "tw.helper.refreshUserAccessToken",
                    `Tried to refresh oauth token but server returned: ${error.response?.data.message}`
                );
            } else {
                log(
                    LOGLEVEL.FATAL,
                    "tw.helper.refreshUserAccessToken",
                    `Tried to refresh oauth token but server returned: ${
                        (error as Error).message
                    }`
                );
            }
            return false;
        }

        if (response.data && "error" in response.data) {
            log(
                LOGLEVEL.FATAL,
                "tw.helper.refreshUserAccessToken",
                "Tried to refresh oauth token but server returned: " +
                    response.data.message
            );
            // throw new Error("Tried to refresh oauth token but server returned: " + response.data.message);
            return false;
        }

        const json = response.data;

        const expiresAt = Date.now() + json.expires_in * 1000;

        this.accessToken = json.access_token;
        this.accessTokenTime = expiresAt;
        this.userRefreshToken = json.refresh_token;

        fs.writeFileSync(this.accessTokenUserRefreshFile, JSON.stringify(json));
        // fs.writeFileSync(this.accessTokenUserFile, JSON.stringify(json)); // i don't understand this

        fs.writeFileSync(
            this.accessTokenUserFile,
            JSON.stringify({
                access_token: json.access_token,
                expires_in: json.expires_in,
                expires_at: expiresAt,
                refresh_token: json.refresh_token,
                scope: json.scope,
                token_type: json.token_type,
            } as TwitchAuthUserTokenFile)
        );

        log(
            LOGLEVEL.SUCCESS,
            "tw.helper.refreshUserAccessToken",
            `Refreshed user access token, expires at ${new Date(
                this.accessTokenTime
            ).toISOString()}`
        );

        this.updateAxiosToken();

        return true;
    }

    public static async getGlobalChatBadges(): Promise<ChatBadge[] | false> {
        if (!TwitchHelper.hasAxios()) {
            throw new Error("Axios is not initialized");
        }

        let response;

        try {
            response = await TwitchHelper.getRequest<GlobalChatBadgesResponse>(
                "/helix/chat/badges/global"
            );
        } catch (error) {
            log(
                LOGLEVEL.ERROR,
                "tw.helper.getGlobalChatBadges",
                `Error getting global chat badges: ${(error as Error).message}`,
                error
            );
            return false;
        }

        const json = response.data;

        if (!json || !json.data) {
            log(
                LOGLEVEL.ERROR,
                "tw.helper.getGlobalChatBadges",
                `Error getting global chat badges: ${JSON.stringify(json)}`
            );
            return false;
        }

        return json.data;
    }

    public static async getChannelChatBadges(
        broadcaster_id: string
    ): Promise<ChatBadge[] | false> {
        if (!TwitchHelper.hasAxios()) {
            throw new Error("Axios is not initialized");
        }

        let response;

        try {
            response = await TwitchHelper.getRequest<ChatBadgesResponse>(
                "/helix/chat/badges",
                {
                    params: {
                        broadcaster_id,
                    },
                }
            );
        } catch (error) {
            log(
                LOGLEVEL.ERROR,
                "tw.helper.getChannelChatBadges",
                `Error getting channel chat badges: ${
                    (error as Error).message
                }`,
                error
            );
            return false;
        }

        const json = response.data;

        if (!json || !json.data) {
            log(
                LOGLEVEL.ERROR,
                "tw.helper.getChannelChatBadges",
                `Error getting channel chat badges: ${JSON.stringify(json)}`
            );
            return false;
        }

        return json.data;
    }

    public static async eventSubUnsubscribe(subscription_id: string) {
        log(
            LOGLEVEL.INFO,
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
        } catch (error) {
            log(
                LOGLEVEL.FATAL,
                "tw.helper",
                `Unsubscribe from eventsub ${subscription_id} error: ${
                    (error as Error).message
                }`,
                error
            );
            return false;
        }

        if (response.status > 299) {
            log(
                LOGLEVEL.FATAL,
                "tw.helper",
                `Unsubscribe from eventsub ${subscription_id} error: ${response.statusText}`
            );
            return false;
        }

        log(
            LOGLEVEL.SUCCESS,
            "tw.helper",
            `Unsubscribed from eventsub ${subscription_id} successfully`
        );

        return true;
    }

    // not sure if this is even working correctly, chat is horrible to work with, not even worth it
    public static cutChat(
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
        const baseOffset = json.comments[0].content_offset_seconds;
        json.comments.forEach((comment) => {
            comment.content_offset_seconds -= baseOffset;
        });

        // set length
        // json.video.length = end_second - start_second;
        json.video.start = 0;
        json.video.end = end_second - start_second;
        // json.video.duration = TwitchHelper.twitchDuration(end_second-start_second);

        fs.writeFileSync(output, JSON.stringify(json));

        return fs.existsSync(output) && fs.statSync(output).size > 0;
    }

    public static async getSubsList(): Promise<Subscription[] | false> {
        log(
            LOGLEVEL.INFO,
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
            log(
                LOGLEVEL.INFO,
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
            } catch (error) {
                log(
                    LOGLEVEL.FATAL,
                    "tw.helper.getSubsList",
                    `Subs return: ${(error as Error).message}`,
                    error
                );
                return false;
            }

            const json = response.data;

            subscriptions = subscriptions.concat(json.data);

            cursor = json.pagination.cursor || "";
        } while (cursor && page++ < maxpages);

        log(
            LOGLEVEL.INFO,
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
                    const sessionId = sub.transport.session_id;
                    const ws = TwitchHelper.eventWebsockets.find(
                        (ws) => ws.sessionId == sessionId
                    );
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
        log(LOGLEVEL.INFO, "tw.helper", `Requesting subscription ${id}`);

        if (!this.axios) {
            throw new Error("Axios is not initialized");
        }

        const subs = await this.getSubsList();

        if (!subs) {
            return false;
        }

        const sub = subs.find((s) => s.id == id);

        if (!sub) {
            log(LOGLEVEL.ERROR, "tw.helper", `Subscription ${id} not found`);
            return false;
        }

        return sub;
    }

    public static async setupAxios() {
        // console.log(chalk.blue("Setting up axios..."));
        log(LOGLEVEL.INFO, "tw.helper.setupAxios", "Setting up axios...");

        if (!Config.getInstance().hasValue("api_client_id")) {
            console.error(
                chalk.red("API client id not set, can't setup axios")
            );
            return;
        }

        let token;
        try {
            token = await TwitchHelper.getAccessToken();
        } catch (error) {
            // console.error(chalk.red(`Failed to get access token: ${error}`));
            log(
                LOGLEVEL.FATAL,
                "tw.helper.setupAxios",
                `Failed to get access token: ${(error as Error).message}`,
                error
            );
            return;
        }

        if (!token) {
            log(
                LOGLEVEL.FATAL,
                "tw.helper.setupAxios",
                "Could not get access token!"
            );
            throw new Error("Could not get access token!");
        }

        censoredLogWords.add(token);

        if (TwitchHelper.accessTokenType === "user") {
            const validateResult = await TwitchHelper.validateOAuth();
            if (!validateResult) {
                log(
                    LOGLEVEL.FATAL,
                    "tw.helper.setupAxios",
                    "Could not validate access token!"
                );
                throw new Error("Could not validate access token!");
            } else {
                log(
                    LOGLEVEL.SUCCESS,
                    "tw.helper.setupAxios",
                    "Access token validated!"
                );
            }
        }

        TwitchHelper.axios = axios.create({
            baseURL: "https://api.twitch.tv",
            headers: {
                "Client-ID": Config.getInstance().cfg("api_client_id", ""),
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
        });

        // interceptor for authorization header
        TwitchHelper.axios.interceptors.request.use((config) => {
            if (!config.headers) {
                console.debug("No headers in config");
                return config; // ???
            }
            config.headers[
                "Authorization"
            ] = `Bearer ${TwitchHelper.accessToken}`;
            return config;
        });

        // console.log(chalk.green(`✔ Axios setup with ${TwitchHelper.accessTokenType} token.`));
        log(
            LOGLEVEL.SUCCESS,
            "tw.helper.setupAxios",
            `Axios setup with ${TwitchHelper.accessTokenType} token.`
        );
    }

    public static updateAxiosToken(): boolean {
        if (!TwitchHelper.axios) {
            log(
                LOGLEVEL.ERROR,
                "helper.updateAxiosToken",
                "Axios not initialized, can't update token"
            );
            return false;
        }

        // set authorization header for both default and instance
        TwitchHelper.axios.defaults.headers.common[
            "Authorization"
        ] = `Bearer ${TwitchHelper.accessToken}`;

        censoredLogWords.add(TwitchHelper.accessToken);
        console.log(
            chalk.green(
                `✔ Axios token updated with ${TwitchHelper.accessTokenType} token.`
            )
        );
        return true;
    }

    public static async getRequest<T>(
        url: string,
        config: AxiosRequestConfig = {},
        retried = false
    ): Promise<AxiosResponse<T>> {
        if (!TwitchHelper.axios) {
            // TODO: use hasAxios() and getAxios() instead, but that won't type guard against undefined
            throw new Error("Axios is not initialized");
        }

        log(
            LOGLEVEL.DEBUG,
            "tw.helper.getRequest",
            `Requesting GET ${url} with config ${JSON.stringify(
                config
            )}, retried: ${retried}`
        );

        let response: AxiosResponse<T>;
        try {
            response = await TwitchHelper.axios.get<T>(url, config);
        } catch (error) {
            if (
                axios.isAxiosError(error) &&
                error.response?.status === 401 &&
                !retried
            ) {
                // 401 Unauthorized, don't retry if already retried
                log(
                    LOGLEVEL.WARNING,
                    "tw.helper",
                    "Access token expired during get request"
                );
                if (this.accessTokenType === "user") {
                    await TwitchHelper.refreshUserAccessToken();
                } else {
                    // TwitchHelper.refreshAppAccessToken();
                    await TwitchHelper.getAccessToken(true);
                }
                return TwitchHelper.getRequest(url, config, true);
            } else {
                log(
                    LOGLEVEL.DEBUG,
                    "tw.helper",
                    `Error during get request: ${(error as Error).message}`,
                    error
                );
            }
            throw error;
        }

        return response;
    }

    public static async postRequest<T>(
        url: string,
        data: unknown,
        config: AxiosRequestConfig = {},
        retried = false
    ): Promise<AxiosResponse<T>> {
        if (!TwitchHelper.axios) {
            throw new Error("Axios is not initialized");
        }

        log(
            LOGLEVEL.DEBUG,
            "tw.helper.postRequest",
            `Requesting POST ${url} with data ${JSON.stringify(
                data
            )} and config ${JSON.stringify(config)}, retried: ${retried}`
        );

        let response;
        try {
            response = await TwitchHelper.axios.post<T>(url, data, config);
        } catch (error) {
            if (
                axios.isAxiosError(error) &&
                error.response?.status === 401 &&
                !retried
            ) {
                // 401 Unauthorized, don't retry if already retried
                log(
                    LOGLEVEL.WARNING,
                    "tw.helper",
                    "Access token expired, during post request"
                );
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

    public static async deleteRequest<T>(
        url: string,
        config: AxiosRequestConfig = {},
        retried = false
    ): Promise<AxiosResponse<T>> {
        if (!TwitchHelper.axios) {
            throw new Error("Axios is not initialized");
        }

        log(
            LOGLEVEL.DEBUG,
            "tw.helper.deleteRequest",
            `Requesting DELETE ${url} with config ${JSON.stringify(
                config
            )}, retried: ${retried}`
        );

        let response;
        try {
            response = await TwitchHelper.axios.delete<T>(url, config);
        } catch (error) {
            if (
                axios.isAxiosError(error) &&
                error.response?.status === 401 &&
                !retried
            ) {
                // 401 Unauthorized, don't retry if already retried
                log(
                    LOGLEVEL.WARNING,
                    "tw.helper",
                    "Access token expired, during delete request"
                );
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

    public static async gqlRequest<T extends GqlResponse>(
        query: object
        // variables?: Record<string, unknown>
    ): Promise<T> {
        if (!Config.getInstance().cfg("twitchapi.enable_gql")) {
            throw new Error("GQL requests are disabled. Check your config.");
        }

        log(
            LOGLEVEL.DEBUG,
            "tw.helper.gqlRequest",
            `Requesting GQL query ${JSON.stringify(query)})}`
        );

        let response;
        try {
            response = await axios.post<T>(
                "https://gql.twitch.tv/gql",
                // {
                query,
                //     variables,
                // },
                {
                    headers: {
                        "Client-Id": "kd1unb4b3q4t58fwlpcbzcbnm76a8fp",
                    },
                }
            );
        } catch (error) {
            if (axios.isAxiosError(error)) {
                log(
                    LOGLEVEL.ERROR,
                    "tw.helper",
                    `Error during gql request: ${
                        error.response?.data?.message || error
                    }`,
                    error
                );
                console.error(error);
            }
            throw error;
        }

        log(
            LOGLEVEL.DEBUG,
            "tw.helper.gqlRequest",
            `GQL response: ${JSON.stringify(response.data)}`
        );

        return response.data;
    }

    public static async setupWebsocket() {
        this.removeAllEventWebsockets();
        if (
            Config.getInstance().cfg("twitchapi.eventsub_type") == "websocket"
        ) {
            const subs = await this.getSubsList();
            if (subs && subs.length > 0) {
                // let promiseList: Promise<boolean>[] = [];
                for (const sub of subs) {
                    if (sub.status == "websocket_disconnected") {
                        /**
                         * Websocket eventsub subscriptions get removed after 1 hour of inactivity.
                         * This unsubscribe call is mostly for the case where the server is restarted or for development purposes.
                         */
                        if (
                            Config.getInstance().cfg(
                                "twitchapi.eventsub_unsub_on_start"
                            )
                        ) {
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
                xTimeout(() => {
                    this.printWebsockets();
                }, 20000);
                console.log(chalk.green("✔ Websocket setup (debug mode)"));
            } else {
                console.log(chalk.green("✔ Websocket setup"));
            }
        } else {
            log(LOGLEVEL.INFO, "tw.helper", "Eventsub is not using websocket");
        }
    }

    public static removeEventWebsocket(id: string): boolean {
        const index = this.eventWebsockets.findIndex((sub) => sub.id == id);
        if (index > -1) {
            log(LOGLEVEL.DEBUG, "tw.helper", `Removing websocket ${id}`);
            return this.eventWebsockets[index].disconnectAndRemove();
        } else {
            log(
                LOGLEVEL.INFO,
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
            logAdvanced(
                LOGLEVEL.ERROR,
                "tw.helper",
                "Eventsub websocket requires user access token"
            );
            return;
        }

        if (this.eventWebsocket) {
            logAdvanced(
                LOGLEVEL.ERROR,
                "tw.helper",
                "Eventsub websocket already exists"
            );
            return;
        }

        if (this.eventWebsocketReconnectUrl) {
            logAdvanced(
                LOGLEVEL.INFO,
                "tw.helper",
                `Eventsub websocket using reconnect url: ${this.eventWebsocketReconnectUrl}`
            );
        }

        const ws = new WebSocket(this.eventWebsocketReconnectUrl || this.eventWebsocketUrl);

        ws.on("open", () => {
            logAdvanced(
                LOGLEVEL.INFO,
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
                logAdvanced(
                    LOGLEVEL.ERROR,
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
                logAdvanced(
                    LOGLEVEL.ERROR,
                    "tw.helper",
                    `Disconnected from event websocket at ${this.eventWebsocketUrl} (code ${code} - connection unused, not subscribed)`
                );
            } else if (code === 4004) {
                logAdvanced(
                    LOGLEVEL.ERROR,
                    "tw.helper",
                    `Disconnected from event websocket at ${this.eventWebsocketUrl} (code ${code} - didn't disconnect from old connection in time or didn't reconnect)`
                );
            } else {
                logAdvanced(
                    LOGLEVEL.ERROR,
                    "tw.helper",
                    `Disconnected from event websocket at ${this.eventWebsocketUrl} (code ${code})`
                );
            }

        });
        ws.on("error", (err) => {
            logAdvanced(
                LOGLEVEL.ERROR,
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
                    logAdvanced(
                        LOGLEVEL.ERROR,
                        "tw.helper",
                        `Event websocket hasn't received a keepalive in ${diff}ms`
                    );
                }
            }
        }, 60000);

        this.eventWebsocket = ws;
    }
    */

    public static createNewWebsocket(
        url: string,
        autoSubscribe = false
    ): Promise<EventWebsocket> {
        return new Promise<EventWebsocket>((resolve, reject) => {
            const randomId = randomUUID().substring(0, 8);

            if (
                this.eventWebsockets.length >= this.eventWebsocketMaxWebsockets
            ) {
                log(
                    LOGLEVEL.ERROR,
                    "tw.helper",
                    `Eventsub websocket limit of ${this.eventWebsocketMaxWebsockets} reached`
                );
                reject(new Error("Eventsub websocket limit reached"));
            }

            log(
                LOGLEVEL.INFO,
                "tw.helper.ws",
                `Creating new websocket ${randomId} at ${url}`
            );

            const ws = new EventWebsocket(randomId, url);
            ws.autoSubscribe = autoSubscribe;
            ws.setup();
            this.eventWebsockets.push(ws);

            log(
                LOGLEVEL.INFO,
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
        log(
            LOGLEVEL.INFO,
            "tw.helper",
            `Received event websocket reconnect message for ${previousId} to ${newUrl}`
        );
        this.removeEventWebsocket(previousId);
        this.createNewWebsocket(newUrl);
    }

    public static findWebsocketSubscriptionBearer(
        user_id: string,
        sub_type: EventSubTypes
    ): EventWebsocket | false {
        const ws = this.eventWebsockets.find((w) =>
            w
                .getSubscriptions()
                .find(
                    (s) =>
                        s.condition.broadcaster_user_id === user_id &&
                        s.type === sub_type
                )
        );
        if (ws) {
            return ws;
        }
        return false;
    }

    public static printWebsockets() {
        if (LiveStreamDVR.shutting_down) return;
        console.log(
            chalk.yellow(`Current websockets: ${this.eventWebsockets.length}`)
        );
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
                console.log(
                    `\t\t\ttype: ${s.type} - user: ${s.condition.broadcaster_user_id} - status: ${s.status} - created: ${s.created_at} - cost: ${s.cost}`
                );
            });
            console.log(
                `\t\tIs available: ${ws.isAvailable(
                    TwitchHelper.CHANNEL_SUB_TYPES.length
                )}`
            );
            console.log("");
        });
    }

    public static clearAccessToken() {
        log(LOGLEVEL.INFO, "tw.helper", "Clearing access token from memory");
        this.axios = undefined;
        this.accessToken = "";
        this.userRefreshToken = "";
        this.userTokenUserId = "";
        this.accessTokenTime = 0;
    }

    /**
     * Validates OAuth token, only works for user tokens
     * @returns
     */
    public static async validateOAuth(): Promise<boolean> {
        const token = TwitchHelper.accessToken;
        if (TwitchHelper.accessTokenType !== "user") return false;
        if (!token) {
            log(
                LOGLEVEL.ERROR,
                "tw.helper",
                "No access token set for validation"
            );
            return false;
        }

        let res;
        try {
            res = await axios.get<TwitchAuthTokenValidationResponse>(
                "https://id.twitch.tv/oauth2/validate",
                {
                    headers: {
                        Authorization: `OAuth ${token}`,
                    },
                }
            );
        } catch (error) {
            if (axios.isAxiosError<ErrorResponse>(error)) {
                log(
                    LOGLEVEL.ERROR,
                    "tw.helper.validateOAuth",
                    `Failed to validate oauth token: ${error.response?.data?.message}`
                );
                console.error(error.response?.data);
            } else {
                log(
                    LOGLEVEL.ERROR,
                    "tw.helper.validateOAuth",
                    `Failed to validate oauth token: ${
                        (error as Error).message
                    }`,
                    error
                );
            }
            return false;
        }

        if (res.status === 200) {
            if (res.data.user_id) {
                TwitchHelper.userTokenUserId = res.data.user_id;
                TwitchHelper.accessTokenTime =
                    Date.now() + res.data.expires_in * 1000;
                log(
                    LOGLEVEL.INFO,
                    "tw.helper.validateOAuth",
                    `OAuth token is valid until ${new Date(
                        TwitchHelper.accessTokenTime
                    ).toLocaleString()}`
                );
                if (fs.existsSync(this.accessTokenUserFile)) {
                    const oldData = JSON.parse(
                        fs.readFileSync(this.accessTokenUserFile).toString()
                    ) as TwitchAuthUserTokenResponse;
                    fs.writeFileSync(
                        this.accessTokenUserFile,
                        JSON.stringify({
                            ...oldData,
                            access_token: TwitchHelper.accessToken,
                            expires_in: TwitchHelper.accessTokenTime,
                        } as TwitchAuthUserTokenResponse)
                    );
                } else {
                    log(
                        LOGLEVEL.ERROR,
                        "tw.helper.validateOAuth",
                        `Failed to write user token to file, file does not exist: ${this.accessTokenUserFile}`
                    );
                }
                return true;
            } else {
                log(
                    LOGLEVEL.ERROR,
                    "tw.helper.validateOAuth",
                    "OAuth token is not valid"
                );
                return false;
            }
        } else {
            log(
                LOGLEVEL.ERROR,
                "tw.helper.validateOAuth",
                `Failed to validate oauth token: ${res.status} ${res.statusText}`,
                res.data
            );
            TwitchHelper.clearAccessToken();
            return false;
        }
    }

    public static async checkTTVLolPlugin() {

        const bin = Helper.path_streamlink();

        if (!bin) {
            throw new Error("Streamlink binary not found");
        }

        const args = [
            "--twitch-proxy-playlist",
        ];

        const execReturn = await execSimple(bin, args, "streamlink ttv lol plugin check");

        const log = execReturn.stdout.join("\n") + "\n" + execReturn.stderr.join("\n");

        if (log.includes("unrecognized arguments: --twitch-proxy-playlist")) {
            return false;
        }

        return true;
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
    public autoSubscribe = false;

    public onValidated?: (sessionId: string, success: boolean) => void;
    public isValidated = false;

    public quotas?: {
        max_total_cost: number;
        total_cost: number;
        total: number;
    };
    private subscriptions: Subscription[];

    public constructor(id: string, url: string) {
        this.id = id;
        this.currentUrl = url;
        this.subscriptions = [];
    }

    public setup() {
        const ws = new WebSocket(this.currentUrl);

        ws.on("open", () => {
            log(
                LOGLEVEL.INFO,
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
                log(
                    LOGLEVEL.ERROR,
                    "tw.helper.ew",
                    `Error parsing event websocket message for ${this.id}: ${err}`
                );
                return;
            }

            if (json.metadata && json.metadata.message_type)
                json._type = json.metadata.message_type; // hack for discriminated unions

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
                log(
                    LOGLEVEL.ERROR,
                    "tw.helper.ew",
                    `Disconnected from event websocket at ${this.currentUrl} (code ${code} - connection unused, not subscribed)`
                );
            } else if (code === 4004) {
                log(
                    LOGLEVEL.ERROR,
                    "tw.helper.ew",
                    `Disconnected from event websocket at ${this.currentUrl} (code ${code} - didn't disconnect from old connection in time or didn't reconnect)`
                );
            } else {
                log(
                    LOGLEVEL.ERROR,
                    "tw.helper.ew",
                    `Disconnected from event websocket at ${this.currentUrl} (code ${code})`
                );
            }

            if (!this.isValidated && this.onValidated) {
                this.onValidated(this.sessionId || "", false);
            }

            if (this.timeoutCheck) {
                xClearTimeout(this.timeoutCheck);
            }

            this.disconnectAndRemove();
        });

        ws.on("error", (err) => {
            log(
                LOGLEVEL.ERROR,
                "tw.helper.ew",
                `Error on event websocket: ${err.message}`,
                err
            );
        });

        // if (this.eventWebsocketTimeoutCheck) {
        //     clearTimeout(this.eventWebsocketTimeoutCheck);
        // }

        this.timeoutCheck = xTimeout(() => {
            if (this.lastKeepalive) {
                const diff =
                    new Date().getTime() - this.lastKeepalive.getTime();
                if (diff > 60000) {
                    log(
                        LOGLEVEL.ERROR,
                        "tw.helper.ew",
                        `Event websocket hasn't received a keepalive in ${diff}ms (${this.id})`
                    );
                }
            }
        }, 60000);
    }

    public disconnectAndRemove(): boolean {
        log(
            LOGLEVEL.INFO,
            "tw.helper.ew",
            `Disconnecting and removing EventWebsocket at ${this.currentUrl} (${this.id})`
        );

        if (this.timeoutCheck) {
            xClearTimeout(this.timeoutCheck);
        }
        if (this.ws) {
            this.ws.close();
        } else {
            log(
                LOGLEVEL.INFO,
                "tw.helper.ew",
                `EventWebsocket websocket ${this.id} is already disconnected`
            );
        }

        const index = TwitchHelper.eventWebsockets.findIndex(
            (ws) => ws.id === this.id
        );
        if (index > -1) {
            TwitchHelper.eventWebsockets.splice(index, 1);
            log(
                LOGLEVEL.INFO,
                "tw.helper.ew",
                `Removed event websocket ${this.id}, now ${TwitchHelper.eventWebsockets.length} websockets out of a maximum of ${TwitchHelper.eventWebsocketMaxWebsockets}`
            );
            return true;
        } else {
            log(
                LOGLEVEL.ERROR,
                "tw.helper.ew",
                `Couldn't remove event websocket ${this.id}, it wasn't found in the list of websockets`
            );
        }
        return false;
    }

    public eventWebsocketMessageHandler(json: EventSubWebsocketMessage): void {
        if (json._type === "session_welcome") {
            this.sessionId = json.payload.session.id;
            console.debug(
                "tw.helper.ew",
                `Received session_welcome event websocket message for ${this.id}: ${this.sessionId}`
            );
            console.debug(
                "tw.helper.ew",
                `Event websocket session id: ${this.sessionId}`
            );
            console.debug(
                "tw.helper.ew",
                `Event websocket keepalive: ${json.payload.session.keepalive_timeout_seconds}`
            );
            console.debug(
                "tw.helper.ew",
                `Event websocket status: ${json.payload.session.status}`
            );
            console.debug(
                "tw.helper.ew",
                `Event websocket reconnect url: ${json.payload.session.reconnect_url}`
            );

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
            console.debug(
                "tw.helper.ew",
                `Event websocket reconnect new url: ${json.payload.session.reconnect_url}`
            );
            TwitchHelper.handleWebsocketReconnect(
                this.id,
                json.payload.session.reconnect_url
            );
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
            log(
                LOGLEVEL.ERROR,
                "tw.helper.ew",
                `Event websocket revocation: ${json.payload.subscription.id}`
            );
            this.removeSubscription(json.payload.subscription.id);
        } else {
            console.debug(
                "tw.helper.ew",
                "Event websocket unknown message",
                json
            );
        }
    }

    public eventSubNotificationHandler(
        message: EventSubWebsocketNotificationMessage
    ): void {
        if (
            Config.debug ||
            Config.getInstance().cfg<boolean>("dump_payloads")
        ) {
            let payloadFilename = `tw_ew_${new Date()
                .toISOString()
                .replaceAll(/[-:.]/g, "_")}`;
            if (message.payload.subscription.type)
                payloadFilename += `_${message.payload.subscription.type}`;
            payloadFilename += ".json";
            const payloadFilepath = path.join(
                BaseConfigDataFolder.payloads,
                payloadFilename
            );
            log(
                LOGLEVEL.INFO,
                "tw.helper.ew",
                `Dumping debug hook payload to ${payloadFilepath}`
            );
            try {
                fs.writeFileSync(
                    payloadFilepath,
                    JSON.stringify(
                        {
                            body: message,
                        },
                        null,
                        4
                    )
                );
            } catch (error) {
                log(
                    LOGLEVEL.ERROR,
                    "tw.helper.ew",
                    `Failed to dump payload to ${payloadFilepath}`,
                    error
                );
            }
        }

        const metadataProxy: AutomatorMetadata = {
            message_id: message.metadata.message_id,
            message_retry: 0, // not supported with websockets
            message_type: message.metadata.message_type,
            message_signature: "", // not supported with websockets
            message_timestamp: message.metadata.message_timestamp,
            subscription_type: message.metadata.subscription_type,
            subscription_version: message.metadata.subscription_version,
        };

        const TA = new TwitchAutomator();

        /* await */ TA.handle(message.payload, metadataProxy).catch((error) => {
            log(
                LOGLEVEL.FATAL,
                "tw.helper.ew",
                `Automator returned error: ${(error as Error).message}`,
                error
            );
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
        if (
            this.subscriptions.length >
            TwitchHelper.eventWebsocketMaxSubscriptions
        ) {
            log(
                LOGLEVEL.ERROR,
                "tw.helper.ew",
                `Event websocket ${this.id} has too many subscriptions (${this.subscriptions.length})`
            );
        } else {
            log(
                LOGLEVEL.DEBUG,
                "tw.helper.ew",
                `Added subscription ${subscription.id} to event websocket ${this.id}, now ${this.subscriptions.length} subscriptions (quota ${this.quotas?.total_cost}/${this.quotas?.max_total_cost})`
            );
        }
    }

    public removeSubscription(id: string): boolean {
        const index = this.subscriptions.findIndex((s) => s.id === id);
        if (index > -1) {
            this.subscriptions.splice(index, 1);
            log(
                LOGLEVEL.INFO,
                "tw.helper.ew",
                `Removed subscription ${id} from event websocket ${this.id}, now ${this.subscriptions.length} subscriptions`
            );
            if (this.subscriptions.length === 0) {
                this.disconnectAndRemove();
            }
            return true;
        } else {
            log(
                LOGLEVEL.ERROR,
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
        if (
            this.subscriptions.length + amountWanted >
            TwitchHelper.eventWebsocketMaxSubscriptions
        )
            return false;
        if (
            this.quotas &&
            this.quotas.total_cost &&
            this.quotas.max_total_cost &&
            this.quotas.total_cost + amountWanted > this.quotas.max_total_cost
        )
            return false;
        return true;
    }
}

export function getTwitchClipId(clip_url: string): string | false {
    const idMatch1 = clip_url.match(/\/clip\/([0-9a-zA-Z_-]+)/);
    const idMatch2 = clip_url.match(/clip=([0-9a-zA-Z_-]+)/);
    const idMatch3 = clip_url.match(/clips\.twitch\.tv\/([0-9a-zA-Z_-]+)/);
    const idMatch4 = clip_url.match(
        /clips\.twitch\.tv\/embed\/([0-9a-zA-Z_-]+)/
    );
    if (idMatch1) return idMatch1[1];
    if (idMatch2) return idMatch2[1];
    if (idMatch3) return idMatch3[1];
    if (idMatch4) return idMatch4[1];
    return false;
}

export function getTwitchVideoId(video_url: string): string | false {
    const idMatch1 = video_url.match(/\/videos\/([0-9]+)/);
    const idMatch2 = video_url.match(/video=([0-9]+)/);
    const idMatch3 = video_url.match(/twitch\.tv\/videos\/([0-9]+)/);
    if (idMatch1) return idMatch1[1];
    if (idMatch2) return idMatch2[1];
    if (idMatch3) return idMatch3[1];
    return false;
}
