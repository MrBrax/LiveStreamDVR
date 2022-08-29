import { BaseConfigDataFolder } from "../Core/BaseConfig";
// import { OAuth2Client } from "google-auth-library";
import { OAuth2Client } from "googleapis-common";
import type { Credentials } from "google-auth-library";
import path from "path";
// import { oauth2_v2 } from "@googleapis/oauth2/v2";
// import { youtube_v3 } from "@googleapis/youtube";
import { Config } from "../Core/Config";
import { Log, LOGLEVEL } from "../Core/Log";
import fs from "fs";

export class YouTubeHelper {

    public static readonly SCOPES = [
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/youtube.readonly",
    ];

    static readonly accessTokenFile = path.join(BaseConfigDataFolder.cache, "youtube_oauth.json");
    static readonly accessTokenExpire = 60 * 60 * 24 * 60 * 1000; // 60 days
    static readonly accessTokenRefresh = 60 * 60 * 24 * 30 * 1000; // 30 days

    static oAuth2Client?: OAuth2Client;
    static authenticated = false;
    static username = "";
    static username_file = path.join(BaseConfigDataFolder.cache, "youtube_username.txt");
    static accessTokenTime = 0;
    private static accessToken?: Credentials;

    static async setupClient() {
        const client_id = Config.getInstance().cfg<string>("youtube.client_id");
        const client_secret = Config.getInstance().cfg<string>("youtube.client_secret");
        let app_url = Config.getInstance().cfg<string>("app_url");

        if (app_url == "debug") {
            app_url = "http://localhost:8081";
        }

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
            `${app_url}/api/v0/youtube/callback`
        );

        const token = this.loadToken();
        if (token) {
            this.oAuth2Client.setCredentials(token);
            this.authenticated = true;
            try {
                await this.fetchUsername();
            } catch (error) {
                Log.logAdvanced(LOGLEVEL.ERROR, "YouTubeHelper", `Failed to fetch username: ${(error as Error).message}`);
            }
        }
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
        const token = JSON.parse(json);
        if (token.expiry_date < new Date().getTime()) {
            Log.logAdvanced(LOGLEVEL.WARNING, "YouTubeHelper", `Token expired at ${token.expiry_date}`);
            fs.unlinkSync(this.accessTokenFile);
            this.accessToken = undefined;
            return undefined;
        }
        this.accessTokenTime = token.expiry_date;
        this.accessToken = token;
        Log.logAdvanced(LOGLEVEL.DEBUG, "YouTubeHelper", `Loaded token from ${this.accessTokenFile}`);
        return token;
    }

    static async fetchUsername(force = false): Promise<void> {

        if (this.username && !force) {
            return;
        }

        if (!force) {
            if (fs.existsSync(this.username_file)) {
                this.username = fs.readFileSync(this.username_file, "utf8");
                return;
            }
        }

        if (!this.oAuth2Client) {
            throw new Error("No oAuth2Client set up");
        }

        if (!this.accessToken || !this.accessToken.access_token) {
            throw new Error("No access token found");
        }

        await this.oAuth2Client.request({
            url: "https://www.googleapis.com/oauth2/v3/userinfo",
        }).then((response) => {
            if (response && response.data && typeof response.data === "object" && "name" in response.data) {
                const data: { sub: string; name: string; given_name: string; family_name: string; picture: string; locale: string; } = response.data as never;
                this.username = data.name;
                fs.writeFileSync(this.username_file, this.username);
            } else {
                Log.logAdvanced(LOGLEVEL.ERROR, "YouTubeHelper", `Failed to fetch username: ${response.statusText}`);
            }
        }).catch((error) => {
            Log.logAdvanced(LOGLEVEL.ERROR, "YouTubeHelper", `Failed to fetch username: ${(error as Error).message}`);
            throw error; // not pretty
        });

    }

}