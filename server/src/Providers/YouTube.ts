import { BaseConfigDataFolder } from "../Core/BaseConfig";
import { OAuth2Client } from "google-auth-library";
import path from "path";
import { google } from "googleapis";
import { Config } from "../Core/Config";
import { Log, LOGLEVEL } from "../Core/Log";
import fs from "fs";


export class YouTubeHelper {

    public static readonly SCOPES = [
        "https://www.googleapis.com/auth/youtube.upload",
    ];

    static readonly accessTokenFile = path.join(BaseConfigDataFolder.cache, "youtube_oauth.json");
    static readonly accessTokenExpire = 60 * 60 * 24 * 60 * 1000; // 60 days
    static readonly accessTokenRefresh = 60 * 60 * 24 * 30 * 1000; // 30 days

    static oAuth2Client?: OAuth2Client;
    static authenticated = false;
    
    static setupClient() {
        const client_id = Config.getInstance().cfg<string>("youtube_client_id");
        const client_secret = Config.getInstance().cfg<string>("youtube_client_secret");

        this.authenticated = false;
        this.oAuth2Client = undefined;

        if (!client_id || !client_secret) {
            Log.logAdvanced(LOGLEVEL.WARNING, "YouTubeHelper", "No client_id or client_secret set up. YouTube uploads will not work.");
            return;
        }
        
        this.oAuth2Client = new google.auth.OAuth2(
            client_id,
            client_secret,
            "http://localhost:8081/api/v0/youtube/callback"
        );

        const token = this.loadToken();
        if (token) {
            this.oAuth2Client.setCredentials(token);
            this.authenticated = true;
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
            Log.logAdvanced(LOGLEVEL.DEBUG, "YouTubeHelper", `Token expired at ${token.expiry_date}`);
            return null;
        }
        Log.logAdvanced(LOGLEVEL.DEBUG, "YouTubeHelper", `Loaded token from ${this.accessTokenFile}`);
        return token;
    }

}