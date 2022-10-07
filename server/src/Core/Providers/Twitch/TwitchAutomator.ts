import { BaseConfigDataFolder } from "../../../Core/BaseConfig";
import { ClientBroker } from "../../../Core/ClientBroker";
import { TwitchHelper } from "../../../Providers/Twitch";
import { KeyValue } from "../../../Core/KeyValue";
import { Log, LOGLEVEL } from "../../../Core/Log";
import path from "path";
import { EventSubResponse } from "../../../../../common/TwitchAPI/EventSub";
import { BaseAutomator } from "../Base/BaseAutomator";
import { TwitchChannel } from "./TwitchChannel";
import { TwitchVOD } from "./TwitchVOD";
import express from "express";
import fs from "fs";
import { Config } from "../../../Core/Config";
import { Webhook } from "../../../Core/Webhook";
import { TwitchVODChapterJSON } from "Storage/JSON";
import { ChannelUpdateEvent } from "../../../../../common/TwitchAPI/EventSub/ChannelUpdate";
import { ChapterUpdateData } from "../../../../../common/Webhook";
import { TwitchVODChapter } from "./TwitchVODChapter";

export class TwitchAutomator extends BaseAutomator {
    vod: TwitchVOD | undefined;
    channel: TwitchChannel | undefined;
    realm = "twitch";
    payload_eventsub: EventSubResponse | undefined;



    /**
     * Entrypoint for stream capture, this is where all Twitch EventSub (webhooks) end up.
     */
    public async handle(data: EventSubResponse, request: express.Request): Promise<boolean> {
        Log.logAdvanced(LOGLEVEL.DEBUG, "automator.handle", "Handle called, proceed to parsing.");

        if (!request.header("Twitch-Eventsub-Message-Id")) {
            Log.logAdvanced(LOGLEVEL.ERROR, "automator.handle", "No twitch message id supplied to handle");
            return false;
        }

        const messageId             = request.header("Twitch-Eventsub-Message-Id");
        const messageRetry          = request.header("Twitch-Eventsub-Message-Retry");
        const messageType           = request.header("Twitch-Eventsub-Message-Type");
        const messageSignature      = request.header("Twitch-Eventsub-Message-Signature");
        const messageTimestamp      = request.header("Twitch-Eventsub-Message-Timestamp");
        const subscriptionType      = request.header("Twitch-Eventsub-Subscription-Type");
        const subscriptionVersion   = request.header("Twitch-Eventsub-Subscription-Version");

        if (messageRetry !== undefined && parseInt(messageRetry) > 0) {
            Log.logAdvanced(LOGLEVEL.WARNING, "hook", `Message ${messageId} is a retry (${messageRetry})`);
            if (Config.getInstance().cfg("capture.retry_on_error", true)) {
                Log.logAdvanced(LOGLEVEL.INFO, "hook", `Retrying message ${messageId}`);
            } else {
                Log.logAdvanced(LOGLEVEL.WARNING, "hook", `Not retrying message ${messageId}`);
                return false;
            }
        }

        try {
            KeyValue.getInstance().setBool(`tw.eventsub.${messageId}.ack`, true);
            KeyValue.getInstance().setDate(`tw.eventsub.${messageId}.time`, new Date());
            KeyValue.getInstance().cleanWildcard("tw.eventsub.", 60 * 60 * 24);
        } catch (error) {
            Log.logAdvanced(LOGLEVEL.WARNING, "hook", `Failed to set eventsub message ${messageId} KeyValues: ${(error as Error).message}`);
        }
        
        // const message_retry = request.header("Twitch-Eventsub-Message-Retry") || null;

        this.payload_eventsub = data;
        this.payload_headers = request.headers;

        const subscription = data.subscription;
        const subscription_type = subscription.type;
        const subscription_id = subscription.id;

        // this.data_cache = data;

        const event = data.event;
        this.broadcaster_user_id = event.broadcaster_user_id;
        this.broadcaster_user_login = event.broadcaster_user_login;
        this.broadcaster_user_name = event.broadcaster_user_name;

        this.channel = TwitchChannel.getChannelByLogin(this.broadcaster_user_login);

        if (subscription_type === "channel.update") {

            // check if channel is in config, copypaste
            if (!TwitchChannel.getChannelByLogin(this.broadcaster_user_login)) {
                Log.logAdvanced(LOGLEVEL.ERROR, "automator.handle", `Handle (update) triggered with sub id ${subscription_id}, but username '${this.broadcaster_user_login}' is not in config.`);

                // 5head solution
                // TwitchHelper.channelUnsubscribe($this->broadcaster_user_id);
                TwitchHelper.eventSubUnsubscribe(subscription_id);
                return false;
            }

            // KeyValue.getInstance().set("${this.broadcaster_user_login}.last.update", (new DateTime())->format(DateTime::ATOM));
            KeyValue.getInstance().set(`${this.broadcaster_user_login}.last.update`, new Date().toISOString());
            Log.logAdvanced(LOGLEVEL.INFO, "automator.handle", `Automator channel.update event for ${this.broadcaster_user_login}`);

            return await this.updateGame();
        } else if (subscription_type == "stream.online") {

            if (!("id" in event)) {
                Log.logAdvanced(LOGLEVEL.ERROR, "automator.handle", `No stream id supplied in event for channel '${this.broadcaster_user_login}', aborting.`, event);
                return false;
            }

            KeyValue.getInstance().set(`${this.broadcaster_user_login}.last.online`, new Date().toISOString());
            Log.logAdvanced(LOGLEVEL.INFO, "automator.handle", `Automator stream.online event for ${this.broadcaster_user_login} (retry ${messageRetry})`);

            // const channel_obj = TwitchChannel.getChannelByLogin(this.broadcaster_user_login);

            // check if channel is in config, hmm
            if (!this.channel) {
                Log.logAdvanced(LOGLEVEL.ERROR, "automator.handle", `Handle (online) triggered with sub id ${subscription_id}, but username '${this.broadcaster_user_login}' is not in config.`);

                // 5head solution
                // TwitchHelper.channelUnsubscribe($this->broadcaster_user_id);
                TwitchHelper.eventSubUnsubscribe(subscription_id);
                return false;
            }

            if (this.channel.is_live) {
                Log.logAdvanced(LOGLEVEL.INFO, "automator.handle", `${this.broadcaster_user_login} is already live, yet another stream online event received.`);
            }

            KeyValue.getInstance().setBool(`${this.broadcaster_user_login}.online`, true);
            KeyValue.getInstance().set(`${this.broadcaster_user_login}.vod.id`, event.id);
            KeyValue.getInstance().set(`${this.broadcaster_user_login}.vod.started_at`, event.started_at);
            Log.logAdvanced(LOGLEVEL.INFO, "automator.handle", `${this.broadcaster_user_login} stream has ID ${event.id}, started ${event.started_at}`);

            fs.writeFileSync(path.join(BaseConfigDataFolder.history, `${this.broadcaster_user_login}.jsonline`), JSON.stringify({ time: new Date(), action: "online" }) + "\n", { flag: "a" });

            // $this->payload = $data['data'][0];

            const basename = this.vodBasenameTemplate();

            // const folder_base = TwitchHelper.vodFolder(this.broadcaster_user_login);

            if (TwitchVOD.hasVod(basename)) {
                Log.logAdvanced(LOGLEVEL.INFO, "automator.handle", `Channel ${this.broadcaster_user_login} online, but vod ${basename} already exists, skipping`);
                return false;
            }

            // notification
            if (this.channel) {
                let body = "";
                const chapter = this.channel.getChapterData();
                if (chapter) {
                    body = `${chapter.game_name}\n${chapter.title}`;
                }
                ClientBroker.notify(
                    `${this.broadcaster_user_login} is live!`,
                    body,
                    this.channel.profilePictureUrl,
                    "streamOnline",
                    this.channel.url
                );
            }

            if (this.channel.no_capture) {
                Log.logAdvanced(LOGLEVEL.INFO, "automator.handle", `Skip capture for ${this.broadcaster_user_login} because no-capture is set`);
                if (this.channel) this.channel.broadcastUpdate();
                return false;
            }

            try {
                await this.download();
            } catch (error) {
                Log.logAdvanced(LOGLEVEL.ERROR, "automator.handle", `Download of stream '${this.broadcaster_user_login}' failed: ${(error as Error).message}`);
            }

        } else if (subscription_type == "stream.offline") {

            return await this.end();

        } else {

            Log.logAdvanced(LOGLEVEL.ERROR, "automator.handle", `No supported subscription type (${subscription_type}).`);
            return false;

        }

        Log.logAdvanced(LOGLEVEL.ERROR, "automator.handle", "how did you get here");
        return false;

    }

    public async updateGame(from_cache = false, no_run_check = false) {

        // const basename = this.vodBasenameTemplate();
        const is_live = KeyValue.getInstance().getBool(`${this.getLogin()}.online`);

        // if online
        if (this.channel?.is_capturing) {

            // const folder_base = TwitchHelper.vodFolder(this.getLogin());

            const capture_id = KeyValue.getInstance().get(`${this.getLogin()}.vod.id`);

            if (!capture_id) {
                Log.logAdvanced(LOGLEVEL.FATAL, "automator", `No capture ID for channel ${this.getLogin()} stream, can't update chapter on capture.`);
                return false;
            }

            const vod = TwitchVOD.getVodByCaptureId(capture_id);

            if (!vod) {
                Log.logAdvanced(LOGLEVEL.FATAL, "automator", `Tried to load VOD ${capture_id} for chapter update but errored.`);
                Log.logAdvanced(LOGLEVEL.INFO, "automator", `Resetting online status on ${this.getLogin()}.`);
                KeyValue.getInstance().delete(`${this.getLogin()}.online`);
                return false;
            }

            if (!no_run_check && !await vod.getCapturingStatus(true)) {
                Log.logAdvanced(LOGLEVEL.ERROR, "automator", `VOD ${vod.basename} is not capturing, skipping chapter update. Removing online status.`);
                KeyValue.getInstance().delete(`${this.getLogin()}.online`);
                return false;
            }

            let event: ChannelUpdateEvent;
            let chapter_data: TwitchVODChapterJSON | undefined;

            // fetch from cache
            if (from_cache) {
                if (this.channel) {
                    chapter_data = this.channel.getChapterData();
                } else if (KeyValue.getInstance().has(`${this.getLogin()}.chapterdata`)) {
                    chapter_data = KeyValue.getInstance().getObject<TwitchVODChapterJSON>(`${this.getLogin()}.chapterdata`) as TwitchVODChapterJSON; // type guard not working
                } else {
                    Log.logAdvanced(LOGLEVEL.ERROR, "automator", `No chapter data for ${this.getLogin()} found in cache.`);
                    return false;
                }
            } else if (this.payload_eventsub && "title" in this.payload_eventsub.event) {
                if (!this.payload_eventsub || !this.payload_eventsub.event) {
                    Log.logAdvanced(LOGLEVEL.ERROR, "automator", `Tried to get event for ${this.getLogin()} but it was not available.`);
                    return false;
                }
                event = this.payload_eventsub.event as ChannelUpdateEvent;
                chapter_data = await this.getChapterData(event);
            } else {
                Log.logAdvanced(LOGLEVEL.ERROR, "automator", `No last resort event for ${this.getLogin()} not available.`);
                return false;
            }

            if (!chapter_data) {
                Log.logAdvanced(LOGLEVEL.ERROR, "automator", `No chapter data for ${this.getLogin()} found.`);
                return false;
            }

            Log.logAdvanced(LOGLEVEL.SUCCESS, "automator", `Channel data for ${this.getLogin()} fetched from ${from_cache ? "cache" : "notification"}.`);

            const chapter = await TwitchVODChapter.fromJSON(chapter_data);

            KeyValue.getInstance().setObject(`${this.getLogin()}.chapterdata`, chapter_data);

            vod.addChapter(chapter);
            await vod.saveJSON("game update");

            Webhook.dispatch("chapter_update", {
                "chapter": chapter.toAPI(),
                "vod": await vod.toAPI(),
            } as ChapterUpdateData);

            // append chapter to history
            fs.writeFileSync(path.join(BaseConfigDataFolder.history, `${this.getLogin()}.jsonline`), JSON.stringify(chapter) + "\n", { flag: "a" });

            Log.logAdvanced(
                LOGLEVEL.SUCCESS,
                "automator",
                `Stream updated on '${this.getLogin()}' to '${chapter_data.game_name}' (${chapter_data.title}) using ${from_cache ? "cache" : "eventsub"}.`
            );

            if (this.channel) {
                this.notifyChapterChange(this.channel);
            }

            return true;

        } else {

            if (!this.payload_eventsub || !this.payload_eventsub.event) {
                Log.logAdvanced(LOGLEVEL.ERROR, "automator", `Tried to get event for ${this.getLogin()} but it was not available.`);
                return false;
            }

            if (!("title" in this.payload_eventsub.event)) {
                Log.logAdvanced(LOGLEVEL.ERROR, "automator", `Event type was wrong for ${this.getLogin()}`);
                return false;
            }

            const event = this.payload_eventsub.event;
            // KeyValue.setObject(`${this.getLogin()}.channeldata`, this.payload_eventsub.event);

            if (this.channel) {
                ClientBroker.notify(
                    `${is_live ? "Live non-capturing" : "Offline"} channel ${this.getLogin()} changed status`,
                    `${event.category_name} (${event.title})`,
                    this.channel.profilePictureUrl,
                    "offlineStatusChange",
                    this.channel.url
                );
            }

            const chapter_data = await this.getChapterData(event);
            chapter_data.online = false;

            Log.logAdvanced(LOGLEVEL.INFO, "automator", `Channel ${this.getLogin()} not capturing, saving channel data to cache: ${event.category_name} (${event.title})`);
            KeyValue.getInstance().setObject(`${this.getLogin()}.chapterdata`, chapter_data);
            if (this.channel) {
                this.channel.broadcastUpdate();
            }

            // if (chapter_data.viewer_count) {
            //     Log.logAdvanced(LOGLEVEL.INFO, "automator", `Channel ${this.getLogin()} not online, but managed to get viewer count, so it's online? 🤔`);
            // }

            // $fp = fopen(TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . "history" . DIRECTORY_SEPARATOR . this.getLogin() . ".jsonline", 'a');
            // fwrite($fp, json_encode($chapter) . "\n");
            // fclose($fp);

            if (Config.debug) {
                setTimeout(async () => {
                    const isLive = await this.channel?.isLiveApi();
                    if (isLive) {
                        Log.logAdvanced(LOGLEVEL.INFO, "automator", `Channel ${this.getLogin()} is now online, timeout check.`);
                    } else {
                        Log.logAdvanced(LOGLEVEL.INFO, "automator", `Channel ${this.getLogin()} is still offline, timeout check.`);
                    }
                }, 30 * 1000); // remove in future, just for testing
            }

            if (!this.channel?.no_capture && is_live && !this.channel?.is_capturing) {
                if (!this.getVodID()) {
                    Log.logAdvanced(LOGLEVEL.WARNING, "automator", `Channel ${this.getLogin()} does not have a stream id, cannot start downloading from chapter update.`);
                } else {
                    Log.logAdvanced(LOGLEVEL.INFO, "automator", `Channel ${this.getLogin()} status is online but not capturing, starting capture from chapter update.`);
                    this.download();
                }
            }

            return true;
        }

    }

    public providerArgs(): string[] {

        const cmd = [];

        // disable channel hosting
        cmd.push("--twitch-disable-hosting");

        if (fs.existsSync(path.join(BaseConfigDataFolder.config, "twitch_oauth.txt"))) {
            const token = fs.readFileSync(path.join(BaseConfigDataFolder.config, "twitch_oauth.txt"));
            cmd.push(`--twitch-api-header=Authentication=OAuth ${token}`);
        }

        // enable low latency mode, probably not a good idea without testing
        if (Config.getInstance().cfg("low_latency", false)) {
            cmd.push("--twitch-low-latency");
        }

        // Skip embedded advertisement segments at the beginning or during a stream
        if (Config.getInstance().cfg("disable_ads", false)) {
            cmd.push("--twitch-disable-ads");
        }

        // disable reruns
        cmd.push("--twitch-disable-reruns");

        return cmd;

    }

}