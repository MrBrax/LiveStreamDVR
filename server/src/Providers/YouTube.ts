import { BaseConfigDataFolder } from "../Core/BaseConfig";
// import { OAuth2Client } from "google-auth-library";
import { OAuth2Client } from "googleapis-common";
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
    private static accessToken: any;

    static setupClient() {
        const client_id = Config.getInstance().cfg<string>("youtube_client_id");
        const client_secret = Config.getInstance().cfg<string>("youtube_client_secret");
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
            this.fetchUsername();
        }
    }

    static storeToken(token: any) {
        const json = JSON.stringify(token);
        Log.logAdvanced(LOGLEVEL.DEBUG, "YouTubeHelper", `Storing token in ${this.accessTokenFile}`);
        fs.writeFileSync(this.accessTokenFile, json);
    }

    static loadToken() {
        if (!fs.existsSync(this.accessTokenFile)) {
            Log.logAdvanced(LOGLEVEL.DEBUG, "YouTubeHelper", `No token found in ${this.accessTokenFile}`);
            return null;
        }
        const json = fs.readFileSync(this.accessTokenFile, "utf8");
        const token = JSON.parse(json);
        if (token.expiry_date < new Date().getTime()) {
            Log.logAdvanced(LOGLEVEL.WARNING, "YouTubeHelper", `Token expired at ${token.expiry_date}`);
            fs.unlinkSync(this.accessTokenFile);
            this.accessToken = undefined;
            return null;
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
            return;
        }

        const info = await this.oAuth2Client.getTokenInfo(this.accessToken);

        console.log("access token", info);

        /*
        const oauth2 = oauth2({
            version: "v2",
            auth: this.oAuth2Client,
        });

        const res = await oauth2.userinfo.v2.me.get();
        this.username = res.data.name || "";
        fs.writeFileSync(this.username_file, this.username);

        Log.logAdvanced(LOGLEVEL.DEBUG, "YouTubeHelper", `Username is ${this.username}`);
        */

    }

}