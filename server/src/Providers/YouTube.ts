import { BaseConfigCacheFolder } from "@/Core/BaseConfig";
// import { OAuth2Client } from "googleapis-common";
import { Config } from "@/Core/Config";
import { KeyValue } from "@/Core/KeyValue";
import { LOGLEVEL, log } from "@/Core/Log";
import { youtube_v3 } from "@googleapis/youtube";
import { addDays, isAfter, isBefore, isValid, set } from "date-fns";
import type { Credentials } from "google-auth-library";
import { OAuth2Client } from "google-auth-library";
import fs from "node:fs";
import path from "node:path";

/**
 * So as far as i can understand this whole token and refresh token thing:
 * - The token is valid for 1 hour
 * - The refresh token is valid for a few days at least, maybe a week
 * - The token can be refreshed with the refresh token, and this is done automatically by oauth2client
 * - Previously, the token was never refreshed, and the refresh token was never used
 * - The token was previously deleted if it was thought to be expired, but this is not necessary
 * So now, it seems the refresh token is the most important thing, and the token is just a temporary thing
 */
export class YouTubeHelper {
    public static readonly SCOPES = [
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/youtube.readonly",

        // create playlists
        // "https://www.googleapis.com/auth/youtube", // this might be too much?
        // "https://www.googleapis.com/auth/youtube.force-ssl",
        "https://www.googleapis.com/auth/youtubepartner",
    ];

    private static readonly accessTokenFile = path.join(
        BaseConfigCacheFolder.cache,
        "youtube_oauth.json"
    );

    private static readonly accessTokenExpiryFile = path.join(
        BaseConfigCacheFolder.cache,
        "youtube_oauth_expiry.txt"
    );

    private static readonly accessTokenRefreshFile = path.join(
        BaseConfigCacheFolder.cache,
        "youtube_oauth_refresh.bin"
    );

    static readonly accessTokenExpire = 60 * 60 * 24 * 60 * 1000; // 60 days
    // static readonly accessTokenRefresh = 60 * 60 * 24 * 30 * 1000; // 30 days

    static oAuth2Client?: OAuth2Client;
    static authenticated = false;
    static username = "";
    static username_file = path.join(
        BaseConfigCacheFolder.cache,
        "youtube_username.txt"
    );
    // static accessTokenTime = 0;
    public static accessTokenExpiryDate?: Date;
    private static accessToken?: Credentials;
    private static accessTokenRefresh?: string;

    static isTokenExpired(): boolean {
        if (!this.accessTokenExpiryDate) {
            return true;
        }

        return isBefore(new Date(), this.accessTokenExpiryDate);
    }

    static hasToken(): boolean {
        return !!this.accessToken;
    }

    static hasRefreshToken(): boolean {
        return !!this.accessTokenRefresh;
    }

    static hasSetOAuth2ClientToken(): boolean {
        return !!this.oAuth2Client?.credentials.access_token;
    }

    static hasSetOAuth2ClientRefreshToken(): boolean {
        return !!this.oAuth2Client?.credentials.refresh_token;
    }

    static async setupClient() {
        const client_id = Config.getInstance().cfg<string>("youtube.client_id");
        const client_secret = Config.getInstance().cfg<string>(
            "youtube.client_secret"
        );
        let app_url = Config.getInstance().cfg<string>("app_url");

        if (app_url == "debug") {
            app_url = `http://${Config.debugLocalUrl()}`;
        }

        const full_app_url = `${app_url}/api/v0/youtube/callback`;

        this.authenticated = false;
        this.oAuth2Client = undefined;

        if (!client_id || !client_secret) {
            log(
                LOGLEVEL.WARNING,
                "YouTubeHelper.setupClient",
                "No client_id or client_secret set up. YouTube uploads will not work."
            );
            return;
        }

        if (fs.existsSync(this.username_file)) {
            fs.unlinkSync(this.username_file);
        }

        this.oAuth2Client = new OAuth2Client(
            client_id,
            client_secret,
            // "http://localhost:8081/api/v0/youtube/callback"
            full_app_url
        );

        log(
            LOGLEVEL.INFO,
            "YouTubeHelper.setupClient",
            `Created OAuth2Client with redirect ${full_app_url}`
        );

        this.oAuth2Client.on("tokens", (tokens) => {
            if (tokens.refresh_token) {
                log(
                    LOGLEVEL.INFO,
                    "YouTubeHelper.setupClient",
                    `Got refresh token for YouTube`
                );
                this.storeRefreshToken(tokens.refresh_token);
                this.applyRefreshToken(tokens.refresh_token);
            } else {
                log(
                    LOGLEVEL.WARNING,
                    "YouTubeHelper.setupClient",
                    `Got new tokens, but no refresh.`
                );
                this.storeToken(tokens);
                this.applyToken(tokens);
            }

            // console.log("youtube access token", tokens.access_token);
        });

        const token = this.loadTokenFromDisk();
        if (token) {
            log(
                LOGLEVEL.INFO,
                "YouTubeHelper.setupClient",
                "Found stored token, setting credentials..."
            );
            this.applyToken(token);
            // this.oAuth2Client.setCredentials(token);
            try {
                await this.fetchUsername();
            } catch (error) {
                log(
                    LOGLEVEL.ERROR,
                    "YouTubeHelper.setupClient",
                    `Failed to fetch username: ${(error as Error).message}`
                );
            }
            this.authenticated = true;
        } else {
            log(
                LOGLEVEL.INFO,
                "YouTubeHelper.setupClient",
                "No stored token found."
            );
            return;
        }

        const refreshToken = this.loadRefreshTokenFromDisk();
        if (refreshToken) {
            this.applyRefreshToken(refreshToken);
        } else {
            log(
                LOGLEVEL.WARNING,
                "YouTubeHelper.setupClient",
                "No refresh token found."
            );
        }

        log(
            LOGLEVEL.SUCCESS,
            "YouTubeHelper.setupClient",
            `YouTubeHelper setup complete, authenticated: ${this.authenticated}`
        );
    }

    static storeToken(token: Credentials) {
        const json = JSON.stringify(token);
        log(
            LOGLEVEL.DEBUG,
            "YouTubeHelper.storeToken",
            `Storing token in ${this.accessTokenFile}`
        );
        fs.writeFileSync(this.accessTokenFile, json);

        if (token.expiry_date) {
            const expiry_date = new Date(token.expiry_date);
            fs.writeFileSync(
                this.accessTokenExpiryFile,
                expiry_date.toISOString()
            );
            log(
                LOGLEVEL.DEBUG,
                "YouTubeHelper.storeToken",
                `Updated expiry date to ${expiry_date.toISOString()}`
            );
            this.accessTokenExpiryDate = expiry_date;
        }
    }

    static applyToken(token: Credentials) {
        if (!this.oAuth2Client) {
            log(
                LOGLEVEL.ERROR,
                "YouTubeHelper.applyToken",
                `No OAuth2Client set up.`
            );
            return;
        }
        log(
            LOGLEVEL.INFO,
            "YouTubeHelper.applyToken",
            `Applying regular token to OAuth2Client, keeping old refresh token.`
        );
        this.accessToken = token;
        this.oAuth2Client.setCredentials({
            ...token,
            refresh_token: this.hasRefreshToken()
                ? this.accessTokenRefresh
                : "",
        });
        // this.oAuth2Client?.setCredentials(token);
    }

    static loadTokenFromDisk(): Credentials | undefined {
        if (!fs.existsSync(this.accessTokenFile)) {
            log(
                LOGLEVEL.DEBUG,
                "YouTubeHelper.loadToken",
                `No token found in ${this.accessTokenFile}`
            );
            return undefined;
        }

        const json = fs.readFileSync(this.accessTokenFile, "utf8");

        const creds: Credentials = JSON.parse(json);

        let expiry_date: Date | undefined = undefined;

        if (fs.existsSync(this.accessTokenExpiryFile)) {
            const expiry_date_str = fs.readFileSync(
                this.accessTokenExpiryFile,
                "utf8"
            );
            expiry_date = new Date(expiry_date_str);

            if (isValid(expiry_date) && isAfter(expiry_date, new Date())) {
                log(
                    LOGLEVEL.WARNING,
                    "YouTubeHelper.loadToken",
                    `Token expired at ${creds.expiry_date}`
                );
                // fs.unlinkSync(this.accessTokenFile);
                // this.accessToken = undefined;
                // return undefined;
            }

            this.accessTokenExpiryDate = expiry_date;
        } else {
            log(
                LOGLEVEL.WARNING,
                "YouTubeHelper.loadToken",
                `No expiry date found in ${this.accessTokenExpiryFile}`
            );
        }

        this.accessToken = creds;

        log(
            LOGLEVEL.DEBUG,
            "YouTubeHelper.loadToken",
            `Loaded token from ${this.accessTokenFile}`
        );
        return creds;
    }

    static storeRefreshToken(refreshToken: string) {
        log(
            LOGLEVEL.DEBUG,
            "YouTubeHelper.storeRefreshToken",
            `Storing refresh token in ${this.accessTokenRefreshFile}`
        );
        fs.writeFileSync(this.accessTokenRefreshFile, refreshToken);
    }

    static loadRefreshTokenFromDisk(): string | false {
        if (!fs.existsSync(this.accessTokenRefreshFile)) {
            log(
                LOGLEVEL.DEBUG,
                "YouTubeHelper.loadRefreshToken",
                `No refresh token found in ${this.accessTokenRefreshFile}`
            );
            return false;
        }
        return fs.readFileSync(this.accessTokenRefreshFile, {
            encoding: "utf-8",
        });
    }

    static applyRefreshToken(refreshToken: string) {
        if (!this.oAuth2Client) {
            log(
                LOGLEVEL.ERROR,
                "YouTubeHelper.applyRefreshToken",
                "No oAuth2Client found"
            );
            return;
        }
        log(
            LOGLEVEL.INFO,
            "YouTubeHelper.applyRefreshToken",
            "Found refresh token, setting credentials..."
        );
        this.oAuth2Client.setCredentials({
            ...this.accessToken,
            refresh_token: refreshToken,
        });
        this.accessTokenRefresh = refreshToken;
    }

    static async fetchUsername(force = false): Promise<string> {
        if (this.username && !force) {
            return this.username;
        }

        if (!force) {
            if (fs.existsSync(this.username_file)) {
                this.username = fs.readFileSync(this.username_file, "utf8");
                return this.username;
            }
        }

        if (!this.oAuth2Client) {
            throw new Error("No oAuth2Client set up");
        }

        // if (!this.accessToken || !this.accessToken.access_token) {
        //     throw new Error("No access token found");
        // }

        let response;

        try {
            response = await this.oAuth2Client.request<{
                sub: string;
                name: string;
                given_name: string;
                family_name: string;
                picture: string;
                locale: string;
            }>({
                url: "https://www.googleapis.com/oauth2/v3/userinfo",
            });
        } catch (error) {
            log(
                LOGLEVEL.ERROR,
                "YouTubeHelper.fetchUsername",
                `Failed to fetch username: ${(error as Error).message}`
            );
            throw error; // not pretty
        }

        if (
            response &&
            response.data &&
            typeof response.data === "object" &&
            "name" in response.data
        ) {
            const data = response.data;
            this.username = data.name;
            fs.writeFileSync(this.username_file, this.username);
            return this.username;
        } else {
            log(
                LOGLEVEL.ERROR,
                "YouTubeHelper.fetchUsername",
                `Failed to fetch username: ${response.statusText}`
            );
            throw new Error(`Failed to fetch username: ${response.statusText}`);
        }
    }

    static async destroyCredentials(): Promise<void> {
        if (!this.oAuth2Client) throw new Error("No client");
        log(
            LOGLEVEL.INFO,
            "YouTubeHelper.destroyCredentials",
            "Revoking credentials and deleting files"
        );
        await this.oAuth2Client.revokeCredentials();
        if (fs.existsSync(this.accessTokenFile))
            fs.unlinkSync(this.accessTokenFile);
        if (fs.existsSync(this.accessTokenRefreshFile))
            fs.unlinkSync(this.accessTokenRefreshFile);
        if (fs.existsSync(this.username_file))
            fs.unlinkSync(this.username_file);
        this.username = "";
        this.accessToken = undefined;
        this.accessTokenExpiryDate = undefined;
        this.accessTokenRefresh = undefined;
        return;
    }

    // PT4M13S
    public static parseYouTubeDuration(duration: string) {
        const regex = /(\d+)([A-Z]+)/g;
        let match;
        let seconds = 0;
        while ((match = regex.exec(duration)) !== null) {
            const num = parseInt(match[1]);
            const unit = match[2];
            switch (unit) {
                case "H":
                    seconds += num * 3600;
                    break;
                case "M":
                    seconds += num * 60;
                    break;
                case "S":
                    seconds += num;
                    break;
            }
        }
        return seconds;
    }

    public static getPlaylists(): Promise<youtube_v3.Schema$Playlist[]> {
        return new Promise((resolve, reject) => {
            const service = new youtube_v3.Youtube({
                auth: YouTubeHelper.oAuth2Client,
            });

            service.playlists
                .list({
                    part: ["snippet", "contentDetails"],
                    mine: true,
                    maxResults: 50,
                })
                .then((response) => {
                    if (!response || !response.data || !response.data.items) {
                        log(
                            LOGLEVEL.ERROR,
                            "YouTubeHelper.getPlaylists",
                            "No response from API"
                        );
                        reject(new Error("No response from API"));
                        return;
                    }

                    resolve(response.data.items);
                })
                .catch((error) => {
                    log(
                        LOGLEVEL.ERROR,
                        "YouTubeHelper.getPlaylists",
                        `Failed to fetch playlists: ${(error as Error).message}`
                    );
                    reject(error);
                });
        });
    }

    public static createPlaylist(
        name: string,
        description: string
    ): Promise<youtube_v3.Schema$Playlist> {
        return new Promise((resolve, reject) => {
            const service = new youtube_v3.Youtube({
                auth: YouTubeHelper.oAuth2Client,
            });

            service.playlists
                .insert({
                    part: ["snippet", "contentDetails"],
                    requestBody: {
                        snippet: {
                            title: name,
                            description,
                        },
                    },
                })
                .then((response) => {
                    if (!response || !response.data) {
                        log(
                            LOGLEVEL.ERROR,
                            "YouTubeHelper.createPlaylist",
                            "No response from API"
                        );
                        reject(new Error("No response from API"));
                        return;
                    }

                    resolve(response.data);
                })
                .catch((error) => {
                    log(
                        LOGLEVEL.ERROR,
                        "YouTubeHelper.createPlaylist",
                        `Failed to create playlist: ${(error as Error).message}`
                    );
                    reject(error);
                });
        });
    }

    /*
    public static async getGameFromVideo(videoId: string): Promise<string> {

        const url = `https://www.youtube.com/watch?v=${videoId}`;
        
        const res = await axios.get(url);
        console.log(res.data);

        const root = parse(res.data);
        console.log(root);

        console.log(root.querySelector("ytd-rich-metadata-renderer"));

        const game = root.querySelector("ytd-rich-metadata-renderer[component-style='RICH_METADATA_RENDERER_STYLE_BOX_ART']");

        console.log(game);

        return game?.innerHTML ?? "";

    }
    */

    /**
     * Check if the quota has been exceeded.
     * @returns true if the quota has been exceeded, false if not.
     */
    public static async getQuotaStatus(): Promise<boolean> {
        const override = Config.getInstance().cfg<boolean>(
            "youtube.quota_override"
        );
        if (override) return false;

        let value;

        try {
            value = await KeyValue.getInstance().getAsync(
                "exporter.youtube.quota_exceeded_date"
            );
        } catch (error) {
            // if there's no value, it's not exceeded
            return false;
        }

        if (!value) return false; // just in case

        const exceededDate = new Date(value);
        const currentDate = new Date();

        // quota resets at midnight pacific time, make a date that's midnight pacific time after the exceeded date using date-fns
        const resetDate = set(addDays(exceededDate, 1), {
            hours: 7,
            minutes: 0,
            seconds: 0,
            milliseconds: 0,
        });

        if (isBefore(currentDate, resetDate)) {
            return true;
        } else {
            return false;
        }
    }
}

// Generated by https://quicktype.io

export interface YouTubeAPIErrorResponse {
    data: Data;
}

export interface Data {
    error: DataError;
}

export interface DataError {
    code: number;
    message: string;
    errors: ErrorElement[];
}

export interface ErrorElement {
    message: string;
    domain: string;
    reason: string;
}
