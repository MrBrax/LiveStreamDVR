import { BaseConfigCacheFolder } from "@/Core/BaseConfig";
import path from "node:path";
import { Config } from "@/Core/Config";
import { log, LOGLEVEL } from "@/Core/Log";

export class TikTokHelper {
    static readonly accessTokenFile = path.join(
        BaseConfigCacheFolder.cache,
        "tiktok_oauth.json"
    );
    static authenticated: boolean;

    static async setupClient() {
        const client_id = Config.getInstance().cfg<string>("tiktok.client_id");
        const client_secret = Config.getInstance().cfg<string>(
            "tiktok.client_secret"
        );
        let app_url = Config.getInstance().cfg<string>("app_url");

        if (app_url == "debug") {
            app_url = `http://${Config.debugLocalUrl()}`;
        }

        this.authenticated = false;

        if (!client_id || !client_secret) {
            log(
                LOGLEVEL.WARNING,
                "TikTokHelper.setupClient",
                "No client_id or client_secret set up. TikTok uploads will not work."
            );
            return;
        }
    }
}
