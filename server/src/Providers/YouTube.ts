import { BaseConfigCacheFolder } from "../Core/BaseConfig";
// import { OAuth2Client } from "google-auth-library";
import { OAuth2Client } from "googleapis-common";
import type { Credentials } from "google-auth-library";
import path from "path";
// import { oauth2_v2 } from "@googleapis/oauth2/v2";
// import { youtube_v3 } from "@googleapis/youtube";
import { Config } from "../Core/Config";
import { Log, LOGLEVEL } from "../Core/Log";
import fs from "fs";
import { youtube_v3 } from "@googleapis/youtube";

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

    static readonly accessTokenFile = path.join(BaseConfigCacheFolder.cache, "youtube_oauth.json");
    static readonly accessTokenRefreshFile = path.join(BaseConfigCacheFolder.cache, "youtube_oauth_refresh.bin");
    static readonly accessTokenExpire = 60 * 60 * 24 * 60 * 1000; // 60 days
    // static readonly accessTokenRefresh = 60 * 60 * 24 * 30 * 1000; // 30 days

    static oAuth2Client?: OAuth2Client;
    static authenticated = false;
    static username = "";
    static username_file = path.join(BaseConfigCacheFolder.cache, "youtube_username.txt");
    static accessTokenTime = 0;
    private static accessToken?: Credentials;
    private static accessTokenRefresh?: string;

    static async setupClient() {
        const client_id = Config.getInstance().cfg<string>("youtube.client_id");
        const client_secret = Config.getInstance().cfg<string>("youtube.client_secret");
        let app_url = Config.getInstance().cfg<string>("app_url");

        if (app_url == "debug") {
            app_url = "http://localhost:8081";
        }

        const full_app_url = `${app_url}/api/v0/youtube/callback`;

        this.authenticated = false;
        this.oAuth2Client = undefined;

        if (!client_id || !client_secret) {
            Log.logAdvanced(LOGLEVEL.WARNING, "YouTubeHelper", "No client_id or client_secret set up. YouTube uploads will not work.");
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

        Log.logAdvanced(LOGLEVEL.INFO, "YouTubeHelper", `Created OAuth2Client with redirect ${full_app_url}`);

        this.oAuth2Client.on("tokens", (tokens) => {
            if (tokens.refresh_token) {
                console.log("youtube refresh token", tokens.refresh_token);
                fs.writeFileSync(this.accessTokenRefreshFile, tokens.refresh_token);
                if (this.oAuth2Client && !this.accessTokenRefresh) {
                    this.accessTokenRefresh = tokens.refresh_token;
                    this.oAuth2Client.setCredentials({
                        refresh_token: this.accessTokenRefresh,
                    });
                }
            }
            console.log("youtube access token", tokens.access_token);
        });

        const token = this.loadToken();
        if (token) {
            Log.logAdvanced(LOGLEVEL.INFO, "YouTubeHelper", "Found stored token, setting credentials...");
            this.oAuth2Client.setCredentials(token);
            this.authenticated = true;
            try {
                await this.fetchUsername();
            } catch (error) {
                Log.logAdvanced(LOGLEVEL.ERROR, "YouTubeHelper", `Failed to fetch username: ${(error as Error).message}`);
            }
        }

        this.loadRefreshToken();
        if (this.accessTokenRefresh) {
            Log.logAdvanced(LOGLEVEL.INFO, "YouTubeHelper", "Found refresh token, setting credentials...");
            this.oAuth2Client.setCredentials({
                refresh_token: fs.readFileSync(this.accessTokenRefreshFile, { encoding: "utf-8" }),
            });
        } else {
            Log.logAdvanced(LOGLEVEL.ERROR, "YouTubeHelper", "No refresh token found");
        }

        Log.logAdvanced(LOGLEVEL.SUCCESS, "YouTubeHelper", `YouTubeHelper setup complete, authenticated: ${this.authenticated}`);

        /*
        this.oAuth2Client.setCredentials({
            refresh_token: fs.readFileSync(this.accessTokenRefreshFile, { encoding: "utf-8" }),
        });
        */

    }

    static storeToken(token: Credentials) {
        const json = JSON.stringify(token);
        Log.logAdvanced(LOGLEVEL.DEBUG, "YouTubeHelper", `Storing token in ${this.accessTokenFile}`);
        fs.writeFileSync(this.accessTokenFile, json);
    }

    static loadToken(): Credentials | undefined {

        if (!fs.existsSync(this.accessTokenFile)) {
            Log.logAdvanced(LOGLEVEL.DEBUG, "YouTubeHelper", `No token found in ${this.accessTokenFile}`);
            return undefined;
        }

        const json = fs.readFileSync(this.accessTokenFile, "utf8");

        const creds: Credentials = JSON.parse(json);

        if (creds.expiry_date && new Date().getTime() > creds.expiry_date) {
            Log.logAdvanced(LOGLEVEL.WARNING, "YouTubeHelper", `Token expired at ${creds.expiry_date}`);
            fs.unlinkSync(this.accessTokenFile);
            this.accessToken = undefined;
            return undefined;
        }

        this.accessTokenTime = creds.expiry_date || 0;
        this.accessToken = creds;

        Log.logAdvanced(LOGLEVEL.DEBUG, "YouTubeHelper", `Loaded token from ${this.accessTokenFile}`);
        return creds;
    }

    static loadRefreshToken(): boolean {
        if (!fs.existsSync(this.accessTokenRefreshFile)) {
            Log.logAdvanced(LOGLEVEL.DEBUG, "YouTubeHelper", `No refresh token found in ${this.accessTokenRefreshFile}`);
            return false;
        }
        this.accessTokenRefresh = fs.readFileSync(this.accessTokenRefreshFile, { encoding: "utf-8" });
        return true;
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
            response = await this.oAuth2Client.request({
                url: "https://www.googleapis.com/oauth2/v3/userinfo",
            });
        } catch (error) {
            Log.logAdvanced(LOGLEVEL.ERROR, "YouTubeHelper", `Failed to fetch username: ${(error as Error).message}`);
            throw error; // not pretty
        }

        if (response && response.data && typeof response.data === "object" && "name" in response.data) {
            const data: { sub: string; name: string; given_name: string; family_name: string; picture: string; locale: string; } = response.data as never;
            this.username = data.name;
            fs.writeFileSync(this.username_file, this.username);
            return this.username;
        } else {
            Log.logAdvanced(LOGLEVEL.ERROR, "YouTubeHelper", `Failed to fetch username: ${response.statusText}`);
            throw new Error(`Failed to fetch username: ${response.statusText}`);
        }

    }

    static async destroyCredentials(): Promise<void> {
        if (!this.oAuth2Client) throw new Error("No client");
        await this.oAuth2Client.revokeCredentials();
        if (fs.existsSync(this.accessTokenFile)) fs.unlinkSync(this.accessTokenFile);
        if (fs.existsSync(this.accessTokenRefreshFile)) fs.unlinkSync(this.accessTokenRefreshFile);
        if (fs.existsSync(this.username_file)) fs.unlinkSync(this.username_file);
        this.username = "";
        this.accessToken = undefined;
        this.accessTokenTime = 0;
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

            const service = new youtube_v3.Youtube({ auth: YouTubeHelper.oAuth2Client });

            service.playlists.list({
                part: ["snippet", "contentDetails"],
                mine: true,
                maxResults: 50,
            }).then((response) => {

                if (!response || !response.data || !response.data.items) {
                    Log.logAdvanced(LOGLEVEL.ERROR, "YouTubeHelper", "No response from API");
                    reject(new Error("No response from API"));
                    return;
                }

                resolve(response.data.items);

            }).catch((error) => {
                Log.logAdvanced(LOGLEVEL.ERROR, "YouTubeHelper", `Failed to fetch playlists: ${(error as Error).message}`);
                reject(error);
            });

        });

    }

    public static createPlaylist(name: string, description: string): Promise<youtube_v3.Schema$Playlist> {

        return new Promise((resolve, reject) => {

            const service = new youtube_v3.Youtube({ auth: YouTubeHelper.oAuth2Client });

            service.playlists.insert({
                part: ["snippet", "contentDetails"],
                requestBody: {
                    snippet: {
                        title: name,
                        description,
                    },
                },
            }).then((response) => {

                if (!response || !response.data) {
                    Log.logAdvanced(LOGLEVEL.ERROR, "YouTubeHelper", "No response from API");
                    reject(new Error("No response from API"));
                    return;
                }

                resolve(response.data);

            }).catch((error) => {
                Log.logAdvanced(LOGLEVEL.ERROR, "YouTubeHelper", `Failed to create playlist: ${(error as Error).message}`);
                reject(error);
            });

        });

    }

}