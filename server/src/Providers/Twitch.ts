import axios, { Axios } from "axios";
import { format } from "date-fns";
import fs from "fs";
import path from "path";
import { EventSubTypes, Subscription } from "../../../common/TwitchAPI/Shared";
import { Subscriptions } from "../../../common/TwitchAPI/Subscriptions";
import { BaseConfigDataFolder } from "../Core/BaseConfig";
import { Config } from "../Core/Config";
import { LOGLEVEL, Log } from "../Core/Log";
import { TwitchCommentDump } from "../../../common/Comments";
import { TwitchChannel } from "../Core/Providers/Twitch/TwitchChannel";
import { KeyValue } from "../Core/KeyValue";
import { SubStatus } from "../../../common/Defs";
import { ChapterTypes, LiveStreamDVR } from "../Core/LiveStreamDVR";
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

    static readonly accessTokenFile = path.join(BaseConfigDataFolder.cache, "oauth.bin");

    static readonly accessTokenExpire = 60 * 60 * 24 * 60 * 1000; // 60 days
    static readonly accessTokenRefresh = 60 * 60 * 24 * 30 * 1000; // 30 days

    static readonly PHP_DATE_FORMAT = "yyyy-MM-dd HH:mm:ss.SSSSSS";
    static readonly TWITCH_DATE_FORMAT = "yyyy-MM-dd'T'HH:mm:ss'Z'";
    static readonly TWITCH_DATE_FORMAT_MS = "yyyy-MM-dd'T'HH:mm:ss'.'SSS'Z'";

    /*
    static readonly SUBSTATUS = {
        NONE: "0",
        WAITING: "1",
        SUBSCRIBED: "2",
        FAILED: "3",
    };
    */

    static readonly CHANNEL_SUB_TYPES: EventSubTypes[] = ["stream.online", "stream.offline", "channel.update"];

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

        if (!Config.getInstance().cfg("api_secret") || !Config.getInstance().cfg("api_client_id")) {
            Log.logAdvanced(LOGLEVEL.ERROR, "helper", "Missing either api secret or client id, aborting fetching of access token!");
            throw new Error("Missing either api secret or client id, aborting fetching of access token!");
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
            TwitchLog.logAdvanced(LOGLEVEL.FATAL, "helper", "Tried to get oauth token but server returned: " . $th->getMessage());
            sleep(5);
            return false;
        }
        */

        const response = await axios.post(oauth_url, {
            "client_id": Config.getInstance().cfg("api_client_id"),
            "client_secret": Config.getInstance().cfg("api_secret"),
            "grant_type": "client_credentials",
        }, {
            headers: {
                "Client-ID": Config.getInstance().cfg("api_client_id"),
            },
        });

        if (response.status != 200) {
            Log.logAdvanced(LOGLEVEL.FATAL, "helper", "Tried to get oauth token but server returned: " + response.statusText);
            throw new Error("Tried to get oauth token but server returned: " + response.statusText);
        }

        const json = response.data;

        if (!json || !json.access_token) {
            Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Failed to fetch access token: ${json}`);
            throw new Error(`Failed to fetch access token: ${json}`);
        }

        const access_token = json.access_token;

        this.accessToken = access_token;

        fs.writeFileSync(this.accessTokenFile, access_token);

        Log.logAdvanced(LOGLEVEL.INFO, "helper", "Fetched new access token");

        return access_token;
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

        Log.logAdvanced(LOGLEVEL.INFO, "helper", `Unsubscribing from eventsub id ${subscription_id}`);

        if (!this.axios) {
            throw new Error("Axios is not initialized");
        }

        let response;

        try {
            // $response = $this->$guzzler->request("DELETE", "/helix/eventsub/subscriptions?id={$subscription_id}");
            response = await this.axios.delete(`/helix/eventsub/subscriptions?id=${subscription_id}`);
        } catch (th) {
            Log.logAdvanced(LOGLEVEL.FATAL, "helper", `Unsubscribe from eventsub ${subscription_id} error: ${th}`);
            return false;
        }

        if (response.status > 299) {
            Log.logAdvanced(LOGLEVEL.FATAL, "helper", `Unsubscribe from eventsub ${subscription_id} error: ${response.statusText}`);
            return false;
        }

        Log.logAdvanced(LOGLEVEL.SUCCESS, "helper", `Unsubscribed from eventsub ${subscription_id} successfully`);

        return true;

    }

    // not sure if this is even working correctly, chat is horrible to work with, not even worth it
    static cutChat(input: string, output: string, start_second: number, end_second: number, overwrite = false): boolean {

        // return new Promise((resolve, reject) => {

        if (!fs.existsSync(input)) {
            throw new Error(`Input file ${input} does not exist`);
        }

        if (!overwrite && fs.existsSync(output)) {
            throw new Error(`Output file ${output} already exists`);
        }

        const json: TwitchCommentDump = JSON.parse(fs.readFileSync(input, "utf8"));

        // delete comments outside of the time range
        json.comments = json.comments.filter((comment) => {
            return comment.content_offset_seconds >= start_second && comment.content_offset_seconds <= end_second;
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

        Log.logAdvanced(LOGLEVEL.INFO, "helper.getSubs", "Requesting subscriptions list");

        if (!this.axios) {
            throw new Error("Axios is not initialized");
        }

        let response;

        try {
            response = await this.axios.get("/helix/eventsub/subscriptions");
        } catch (err) {
            Log.logAdvanced(LOGLEVEL.FATAL, "helper.getSubs", `Subs return: ${err}`);
            return false;
        }

        const json: Subscriptions = response.data;

        Log.logAdvanced(LOGLEVEL.INFO, "helper.getSubs", `${json.total} subscriptions`);

        return json;

    }

    public static async getSubsList(): Promise<Subscription[] | false> {

        Log.logAdvanced(LOGLEVEL.INFO, "helper.getSubsList", "Requesting subscriptions list");

        if (!this.axios) {
            throw new Error("Axios is not initialized");
        }

        let subscriptions: Subscription[] = [];
        let cursor = "";
        const maxpages = 5;
        let page = 0;

        do {

            Log.logAdvanced(LOGLEVEL.INFO, "helper.getSubsList", `Fetch subs page ${page}`);

            let response;

            try {
                response = await this.axios.get("/helix/eventsub/subscriptions", {
                    params: {
                        after: cursor,
                    },
                });
            } catch (err) {
                Log.logAdvanced(LOGLEVEL.FATAL, "helper.getSubsList", `Subs return: ${err}`);
                return false;
            }

            const json: Subscriptions = response.data;

            subscriptions = subscriptions.concat(json.data);

            cursor = json.pagination.cursor || "";

        } while (cursor && page++ < maxpages);

        Log.logAdvanced(LOGLEVEL.INFO, "helper.getSubsList", `${subscriptions.length} subscriptions`);

        if (subscriptions) {
            subscriptions.forEach(sub => {
                KeyValue.getInstance().set(`${sub.condition.broadcaster_user_id}.sub.${sub.type}`, sub.id);
                KeyValue.getInstance().set(`${sub.condition.broadcaster_user_id}.substatus.${sub.type}`, sub.status == "enabled" ? SubStatus.SUBSCRIBED : SubStatus.NONE);
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
    public static async getSubscription(id: string): Promise<Subscription | false> {

        Log.logAdvanced(LOGLEVEL.INFO, "helper", `Requesting subscription ${id}`);

        if (!this.axios) {
            throw new Error("Axios is not initialized");
        }

        const subs = await this.getSubsList();

        if (!subs) {
            return false;
        }

        const sub = subs.find((s) => s.id == id);

        if (!sub) {
            Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Subscription ${id} not found`);
            return false;
        }

        return sub;

    }

    public static getErrors(): string[] {
        const errors = [];
        if (!this.axios) errors.push("Axios is not initialized. Make sure the client id and secret are set in the config.");
        if (!Config.getInstance().cfg("app_url") && Config.getInstance().cfg("app_url") !== "debug") errors.push("No app url set in the config.");
        if (!Config.getInstance().cfg("api_client_id")) errors.push("No client id set in the config.");
        if (!Config.getInstance().cfg("api_secret")) errors.push("No client secret set in the config.");
        if (LiveStreamDVR.getInstance().channels.length == 0) errors.push("No channels set in the config.");

        if (!Helper.path_ffmpeg()) errors.push("Failed to find ffmpeg");
        if (!Helper.path_streamlink()) errors.push("Failed to find streamlink");
        if (!Helper.path_mediainfo()) errors.push("Failed to find mediainfo");

        for (const field of Config.settingsFields) {
            if (field.deprecated && Config.getInstance().cfg(field.key) !== field.default) {
                if (typeof field.deprecated === "string") {
                    errors.push(`${field.key} is deprecated: ${field.deprecated}`);
                } else {
                    errors.push(`'${field.key}' is deprecated and will be removed in the future.`);
                }
            }
        }

        for (const channel of TwitchChannel.getChannels()) {
            for (const sub_type of TwitchHelper.CHANNEL_SUB_TYPES) {
                if (KeyValue.getInstance().get(`${channel.internalId}.substatus.${sub_type}`) === SubStatus.WAITING) {
                    errors.push(`${channel.internalName} is waiting for subscription ${sub_type}. Please check the config.`);
                } else if (KeyValue.getInstance().get(`${channel.internalId}.substatus.${sub_type}`) === SubStatus.FAILED) {
                    errors.push(`${channel.internalName} failed to subscribe ${sub_type}. Please check the config.`);
                } else if (KeyValue.getInstance().get(`${channel.internalId}.substatus.${sub_type}`) === SubStatus.NONE || !KeyValue.getInstance().has(`${channel.internalId}.substatus.${sub_type}`)) {
                    errors.push(`${channel.internalName} is not subscribed to ${sub_type}. Please check the config and subscribe.`);
                }
            }
        }

        if (Config.debug) {

            for (const vod of LiveStreamDVR.getInstance().vods) {

                if (!vod.is_finalized) continue;

                if (!vod.duration) continue;

                if (!vod.chapters || vod.chapters.length == 0) continue;

                const firstChapter = vod.chapters[0];
                const lastChapter = vod.chapters[vod.chapters.length - 1];

                if (firstChapter.offset && firstChapter.offset > 0) {
                    errors.push(`${vod.basename} first chapter starts at ${firstChapter.offset} seconds. Missing pre-stream chapter update?`);
                }

                // This check does not work since the start/end time of the livestream is not the same as the duration of the VOD
                // if (lastChapter.offset && lastChapter.duration && Math.round(lastChapter.offset + lastChapter.duration) != vod.duration) {
                //     errors.push(`${vod.basename} last chapter ends at ${Math.round(lastChapter.offset + lastChapter.duration)} seconds but the VOD duration is ${vod.duration} seconds.`);
                // }

                const chaptersDuration = (vod.chapters as ChapterTypes[]).reduce((prev, cur) => prev + (cur.duration || 0), 0);
                if (vod.duration - chaptersDuration > 0) {
                    errors.push(`${vod.basename} has a duration of ${vod.duration} but the chapters are not aligned (${chaptersDuration}).`);
                }

                for (const chapter of vod.chapters) {
                    if (!chapter.duration || chapter.duration == 0) {
                        errors.push(`${vod.basename} chapter ${chapter.title} has no duration.`);
                    }
                }

            }

        }

        return errors;
    }

}