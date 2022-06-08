
import { youtube_v3 } from "@googleapis/youtube/v3";
import { BaseConfigDataFolder } from "../Core/BaseConfig";
import { auth } from "google-auth-library";
import path from "path";
import fs from "fs";
import { format } from "date-fns";
import { Log, LOGLEVEL } from "../Core/Log";

export class YouTubeHelper {

    public static readonly SCOPES = [
        "https://www.googleapis.com/auth/youtube.upload",
    ];

    static readonly accessTokenFile = path.join(BaseConfigDataFolder.cache, "youtube_oauth.json");
    static readonly accessTokenExpire = 60 * 60 * 24 * 60 * 1000; // 60 days
    static readonly accessTokenRefresh = 60 * 60 * 24 * 30 * 1000; // 30 days

    static async getAccessToken(force = false): Promise<string> {

        // token should last 60 days, delete it after 30 just to be sure
        if (fs.existsSync(this.accessTokenFile)) {

            if (Date.now() > fs.statSync(this.accessTokenFile).mtimeMs + this.accessTokenRefresh) {
                Log.logAdvanced(LOGLEVEL.INFO, "helper", `Deleting old access token, too old: ${format(fs.statSync(this.accessTokenFile).mtimeMs, this.PHP_DATE_FORMAT)}`);
                fs.unlinkSync(this.accessTokenFile);
            } else if (!force) {
                Log.logAdvanced(LOGLEVEL.DEBUG, "helper", "Fetched access token from cache");
                return fs.readFileSync(this.accessTokenFile, "utf8");
            }

        }

        const authUrl = oauth2Client.generateAuthUrl({

    }

    static async authorize(credentials: any) {
        const client_secret = credentials.installed.client_secret;
        const client_id = credentials.installed.client_id;
        const redirect_uris = credentials.installed.redirect_uris;
        const oauth2Client = new auth.OAuth2(client_id, client_secret, redirect_uris[0]);

        const token = await this.getAccessToken();
        if (token) {
            // oauth2Client.setCredentials({
            //     access_token: token,
            //     refresh_token: credentials.installed.refresh_token,
            //     expiry_date: Date.now() + this.accessTokenExpire,
            // });
            oauth2Client.credentials = credentials;
            return oauth2Client;
        } else {
            throw new Error("No access token");
        }
    }

}