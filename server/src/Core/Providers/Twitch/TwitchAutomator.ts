import type { TwitchVODChapterJSON } from "@/Storage/JSON";
import type { EventSubResponse } from "@common/TwitchAPI/EventSub";
import type { ChannelUpdateEvent } from "@common/TwitchAPI/EventSub/ChannelUpdate";
import type { ChapterUpdateData } from "@common/Webhook";
import { t } from "i18next";
import fs from "node:fs";
import path from "node:path";
import { TwitchHelper } from "../../../Providers/Twitch";
import { BaseConfigCacheFolder, BaseConfigDataFolder } from "../../BaseConfig";
import { ClientBroker } from "../../ClientBroker";
import { Config } from "../../Config";
import { KeyValue } from "../../KeyValue";
import { LOGLEVEL, censoredLogWords, log } from "../../Log";
import { Webhook } from "../../Webhook";
import { BaseAutomator } from "../Base/BaseAutomator";
import { TwitchChannel } from "./TwitchChannel";
import { TwitchVOD } from "./TwitchVOD";
import { TwitchVODChapter } from "./TwitchVODChapter";

export interface AutomatorMetadata {
    message_id: string;
    message_retry: number;
    message_type: "notification"; // TODO: only one supported?
    message_signature: string;
    message_timestamp: string;
    subscription_type: string;
    subscription_version: string;
}

export class TwitchAutomator extends BaseAutomator {
    vod: TwitchVOD | undefined;
    channel: TwitchChannel | undefined;
    realm = "twitch";
    payload_eventsub: EventSubResponse | undefined;

    /**
     * Entrypoint for stream capture, this is where all Twitch EventSub (webhooks) end up.
     */
    public async handle(
        data: EventSubResponse,
        metadata: AutomatorMetadata
    ): Promise<boolean> {
        log(
            LOGLEVEL.DEBUG,
            "automator.handle",
            "Handle called, proceed to parsing."
        );

        if (!metadata.message_id) {
            log(
                LOGLEVEL.ERROR,
                "automator.handle",
                "No twitch message id supplied to handle"
            );
            return false;
        }

        const messageId = metadata.message_id;
        const messageRetry = metadata.message_retry;
        const messageType = metadata.message_type;
        const messageSignature = metadata.message_signature;
        const messageTimestamp = metadata.message_timestamp;
        const subscriptionType = metadata.subscription_type;
        const subscriptionVersion = metadata.subscription_version;

        if (messageRetry !== undefined && messageRetry > 0) {
            log(
                LOGLEVEL.WARNING,
                "automator.handle",
                `Message ${messageId} is a retry (${messageRetry})`
            );
            if (Config.getInstance().cfg("capture.retry_on_error", true)) {
                log(
                    LOGLEVEL.INFO,
                    "automator.handle",
                    `Retrying message ${messageId}`
                );
            } else {
                log(
                    LOGLEVEL.WARNING,
                    "automator.handle",
                    `Not retrying message ${messageId}`
                );
                return false;
            }
        }

        try {
            await KeyValue.getInstance().setBoolAsync(
                `tw.eventsub.${messageId}.ack`,
                true
            );
            KeyValue.getInstance().setDate(
                `tw.eventsub.${messageId}.time`,
                new Date()
            );
            KeyValue.getInstance().setExpiry(
                `tw.eventsub.${messageId}.ack`,
                60 * 60
            ); // 1 hour
            KeyValue.getInstance().setExpiry(
                `tw.eventsub.${messageId}.time`,
                60 * 60
            ); // 1 hour
            // KeyValue.getInstance().cleanWildcard("tw.eventsub.*.ack");
            // KeyValue.getInstance().cleanWildcard("tw.eventsub.*.time");
        } catch (error) {
            log(
                LOGLEVEL.WARNING,
                "automator.handle",
                `Failed to set eventsub message ${messageId} KeyValues: ${
                    (error as Error).message
                }`
            );
        }

        // const message_retry = request.header("Twitch-Eventsub-Message-Retry") || null;

        this.payload_eventsub = data;
        // this.payload_headers = request.headers;

        const subscription = data.subscription;
        const subscription_type = subscription.type;
        const subscription_id = subscription.id;

        // this.data_cache = data;

        const event = data.event;
        this.broadcaster_user_id = event.broadcaster_user_id;
        this.broadcaster_user_login = event.broadcaster_user_login;
        this.broadcaster_user_name = event.broadcaster_user_name;

        this.channel = TwitchChannel.getChannelByLogin(
            this.broadcaster_user_login
        );

        if (subscription_type === "channel.update") {
            // check if channel is in config, copypaste
            if (!TwitchChannel.getChannelByLogin(this.broadcaster_user_login)) {
                log(
                    LOGLEVEL.ERROR,
                    "automator.handle",
                    `Handle (update) triggered with sub id ${subscription_id}, but username '${this.broadcaster_user_login}' is not in config.`
                );

                // 5head solution
                // TwitchHelper.channelUnsubscribe($this->broadcaster_user_id);
                TwitchHelper.eventSubUnsubscribe(subscription_id);
                return false;
            }

            // KeyValue.getInstance().set("${this.broadcaster_user_login}.last.update", (new DateTime())->format(DateTime::ATOM));
            await KeyValue.getInstance().setAsync(
                `${this.broadcaster_user_login}.last.update`,
                new Date().toISOString()
            );

            log(
                LOGLEVEL.INFO,
                "automator.handle",
                `Automator channel.update event for ${this.broadcaster_user_login}`
            );

            return await this.updateGame();
        } else if (subscription_type == "stream.online") {
            if (!("id" in event)) {
                log(
                    LOGLEVEL.ERROR,
                    "automator.handle",
                    `No stream id supplied in event for channel '${this.broadcaster_user_login}', aborting.`,
                    event
                );
                return false;
            }

            await KeyValue.getInstance().deleteAsync(
                `${this.broadcaster_user_login}.offline`
            );

            await KeyValue.getInstance().setAsync(
                `${this.broadcaster_user_login}.last.online`,
                new Date().toISOString()
            );

            log(
                LOGLEVEL.INFO,
                "automator.handle",
                `Automator stream.online event for ${this.broadcaster_user_login} (retry ${messageRetry})`
            );

            // const channel_obj = TwitchChannel.getChannelByLogin(this.broadcaster_user_login);

            // check if channel is in config, hmm
            if (!this.channel) {
                log(
                    LOGLEVEL.ERROR,
                    "automator.handle",
                    `Handle (online) triggered with sub id ${subscription_id}, but username '${this.broadcaster_user_login}' is not in config.`
                );

                // 5head solution
                // TwitchHelper.channelUnsubscribe($this->broadcaster_user_id);
                TwitchHelper.eventSubUnsubscribe(subscription_id);
                return false;
            }

            if (this.channel.is_live) {
                log(
                    LOGLEVEL.INFO,
                    "automator.handle",
                    `${this.broadcaster_user_login} is already live, yet another stream online event received.`
                );
            }

            await KeyValue.getInstance().setBoolAsync(
                `${this.broadcaster_user_login}.online`,
                true
            );
            await KeyValue.getInstance().setAsync(
                `${this.broadcaster_user_login}.vod.id`,
                event.id
            );
            await KeyValue.getInstance().setAsync(
                `${this.broadcaster_user_login}.vod.started_at`,
                event.started_at
            );
            log(
                LOGLEVEL.INFO,
                "automator.handle",
                `${this.broadcaster_user_login} stream has ID ${event.id}, started ${event.started_at}`
            );

            fs.writeFileSync(
                path.join(
                    BaseConfigCacheFolder.history,
                    `${this.broadcaster_user_login}.jsonline`
                ),
                JSON.stringify({ time: new Date(), action: "online" }) + "\n",
                { flag: "a" }
            );

            // $this->payload = $data['data'][0];

            const basename = this.vodBasenameTemplate();

            // const folder_base = TwitchHelper.vodFolder(this.broadcaster_user_login);

            if (TwitchVOD.hasVod(basename)) {
                log(
                    LOGLEVEL.INFO,
                    "automator.handle",
                    `Channel ${this.broadcaster_user_login} online, but vod ${basename} already exists, skipping`
                );
                this.fallbackCapture()
                    .then(() => {
                        log(
                            LOGLEVEL.INFO,
                            "automator.download",
                            `Fallback capture finished for ${this.getLogin()}`
                        );
                    })
                    .catch((error) => {
                        log(
                            LOGLEVEL.ERROR,
                            "automator.download",
                            `Fallback capture failed for ${this.getLogin()}: ${
                                (error as Error).message
                            }`
                        );
                        console.error(error);
                    });
                return false;
            }

            const capture_vod = TwitchVOD.getVodByCaptureId(event.id);
            if (capture_vod) {
                log(
                    LOGLEVEL.INFO,
                    "automator.handle",
                    `Channel ${this.broadcaster_user_login} online, but vod ${event.id} already exists (${capture_vod.basename}), skipping`
                );
                this.fallbackCapture()
                    .then(() => {
                        log(
                            LOGLEVEL.INFO,
                            "automator.download",
                            `Fallback capture finished for ${this.getLogin()}`
                        );
                    })
                    .catch((error) => {
                        log(
                            LOGLEVEL.ERROR,
                            "automator.download",
                            `Fallback capture failed for ${this.getLogin()}: ${
                                (error as Error).message
                            }`
                        );
                        console.error(error);
                    });
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
                    t("notify.broadcaster-is-live", [
                        this.broadcaster_user_login,
                    ]),
                    body,
                    this.channel.profilePictureUrl,
                    "streamOnline",
                    this.channel.url
                );
            }

            if (this.channel.no_capture) {
                log(
                    LOGLEVEL.INFO,
                    "automator.handle",
                    `Skip capture for ${this.broadcaster_user_login} because no-capture is set`
                );
                if (this.channel) this.channel.broadcastUpdate();
                return false;
            }

            try {
                await this.download();
            } catch (error) {
                log(
                    LOGLEVEL.ERROR,
                    "automator.handle",
                    `Download of stream '${
                        this.broadcaster_user_login
                    }' failed: ${(error as Error).message}`
                );
            }

            return true;
        } else if (subscription_type == "stream.offline") {
            await KeyValue.getInstance().setBoolAsync(
                `${this.broadcaster_user_login}.offline`,
                true
            );

            return await this.end();
        } else {
            log(
                LOGLEVEL.ERROR,
                "automator.handle",
                `No supported subscription type (${subscription_type}).`
            );
            return false;
        }

        log(LOGLEVEL.ERROR, "automator.handle", "how did you get here");
        return false;
    }

    public async updateGame(from_cache = false, no_run_check = false) {
        // const basename = this.vodBasenameTemplate();
        const is_live = await KeyValue.getInstance().getBoolAsync(
            `${this.getLogin()}.online`
        );

        // if online
        if (this.channel?.is_capturing) {
            // const folder_base = TwitchHelper.vodFolder(this.getLogin());

            const capture_id = await KeyValue.getInstance().getAsync(
                `${this.getLogin()}.vod.id`
            );

            if (!capture_id) {
                log(
                    LOGLEVEL.FATAL,
                    "automator.updateGame",
                    `No capture ID for channel ${this.getLogin()} stream, can't update chapter on capture.`
                );
                return false;
            }

            const vod = TwitchVOD.getVodByCaptureId(capture_id);

            if (!vod) {
                log(
                    LOGLEVEL.FATAL,
                    "automator.updateGame",
                    `Tried to load VOD ${capture_id} for chapter update but errored.`
                );
                log(
                    LOGLEVEL.INFO,
                    "automator.updateGame",
                    `Resetting online status on ${this.getLogin()}.`
                );
                await KeyValue.getInstance().deleteAsync(
                    `${this.getLogin()}.online`
                );
                return false;
            }

            if (!no_run_check && !(await vod.getCapturingStatus(true))) {
                log(
                    LOGLEVEL.ERROR,
                    "automator.updateGame",
                    `VOD ${vod.basename} is not capturing, skipping chapter update. Removing online status.`
                );
                await KeyValue.getInstance().deleteAsync(
                    `${this.getLogin()}.online`
                );
                return false;
            }

            let event: ChannelUpdateEvent;
            let chapter_data: TwitchVODChapterJSON | undefined;

            // fetch from cache
            if (from_cache) {
                if (this.channel) {
                    chapter_data = this.channel.getChapterData();
                } else if (
                    await KeyValue.getInstance().hasAsync(
                        `${this.getLogin()}.chapterdata`
                    )
                ) {
                    chapter_data =
                        (await KeyValue.getInstance().getObjectAsync<TwitchVODChapterJSON>(
                            `${this.getLogin()}.chapterdata`
                        )) as TwitchVODChapterJSON; // type guard not working
                } else {
                    log(
                        LOGLEVEL.ERROR,
                        "automator.updateGame",
                        `No chapter data for ${this.getLogin()} found in cache.`
                    );
                    return false;
                }
            } else if (
                this.payload_eventsub &&
                "title" in this.payload_eventsub.event
            ) {
                if (!this.payload_eventsub || !this.payload_eventsub.event) {
                    log(
                        LOGLEVEL.ERROR,
                        "automator.updateGame",
                        `Tried to get event for ${this.getLogin()} but it was not available.`
                    );
                    return false;
                }
                event = this.payload_eventsub.event as ChannelUpdateEvent;
                chapter_data = await this.getChapterData(event);
            } else {
                log(
                    LOGLEVEL.ERROR,
                    "automator.updateGame",
                    `No last resort event for ${this.getLogin()} not available.`
                );
                return false;
            }

            if (!chapter_data) {
                log(
                    LOGLEVEL.ERROR,
                    "automator.updateGame",
                    `No chapter data for ${this.getLogin()} found.`
                );
                return false;
            }

            log(
                LOGLEVEL.SUCCESS,
                "automator.updateGame",
                `Channel data for ${this.getLogin()} fetched from ${
                    from_cache ? "cache" : "notification"
                }.`
            );

            const chapter = await TwitchVODChapter.fromJSON(chapter_data);

            await KeyValue.getInstance().setObjectAsync(
                `${this.getLogin()}.chapterdata`,
                chapter_data
            );

            vod.addChapter(chapter);
            await vod.saveJSON("game update");

            Webhook.dispatchAll("chapter_update", {
                chapter: chapter.toAPI(),
                vod: await vod.toAPI(),
            } as ChapterUpdateData);

            // append chapter to history
            fs.writeFileSync(
                path.join(
                    BaseConfigCacheFolder.history,
                    `${this.getLogin()}.jsonline`
                ),
                JSON.stringify(chapter) + "\n",
                { flag: "a" }
            );

            log(
                LOGLEVEL.SUCCESS,
                "automator.updateGame",
                `Stream updated on '${this.getLogin()}' to '${
                    chapter_data.game_name
                }' (${chapter_data.title}) using ${
                    from_cache ? "cache" : "eventsub"
                }.`
            );

            if (this.channel) {
                this.notifyChapterChange(this.channel);
            }

            return true;
        } else {
            if (!this.payload_eventsub || !this.payload_eventsub.event) {
                log(
                    LOGLEVEL.ERROR,
                    "automator.updateGame",
                    `Tried to get event for ${this.getLogin()} but it was not available.`
                );
                return false;
            }

            if (!("title" in this.payload_eventsub.event)) {
                log(
                    LOGLEVEL.ERROR,
                    "automator.updateGame",
                    `Event type was wrong for ${this.getLogin()}`
                );
                return false;
            }

            const event = this.payload_eventsub.event;
            // KeyValue.setObject(`${this.getLogin()}.channeldata`, this.payload_eventsub.event);

            if (this.channel) {
                // const notifyTitle = `${is_live ? "Live non-capturing" : "Offline"} channel ${this.getLogin()} changed status`;
                let notifyTitle = "";
                if (is_live) {
                    notifyTitle = t(
                        "notify.live-non-capturing-channel-this-getlogin-changed-status",
                        [this.getLogin()]
                    );
                } else {
                    notifyTitle = t(
                        "notify.offline-channel-this-getlogin-changed-status",
                        [this.getLogin()]
                    );
                }

                ClientBroker.notify(
                    notifyTitle,
                    `${event.category_name} (${event.title})`,
                    this.channel.profilePictureUrl,
                    "offlineStatusChange",
                    this.channel.url
                );
            }

            const chapter_data = await this.getChapterData(event);
            chapter_data.online = false;

            log(
                LOGLEVEL.INFO,
                "automator.updateGame",
                `Channel ${this.getLogin()} not capturing, saving channel data to cache: ${
                    event.category_name
                } (${event.title})`
            );
            await KeyValue.getInstance().setObjectAsync(
                `${this.getLogin()}.chapterdata`,
                chapter_data
            );
            if (this.channel) {
                this.channel.broadcastUpdate();
            }

            // if (chapter_data.viewer_count) {
            //     logAdvanced(LOGLEVEL.INFO, "automator.updateGame", `Channel ${this.getLogin()} not online, but managed to get viewer count, so it's online? 🤔`);
            // }

            // $fp = fopen(TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . "history" . DIRECTORY_SEPARATOR . this.getLogin() . ".jsonline", 'a');
            // fwrite($fp, json_encode($chapter) . "\n");
            // fclose($fp);

            /*
            if (Config.debug) {
                setTimeout(async () => {
                    const isLive = await this.channel?.isLiveApi();
                    if (isLive) {
                        logAdvanced(LOGLEVEL.INFO, "automator.updateGame", `Channel ${this.getLogin()} is now online, timeout check.`);
                    } else {
                        logAdvanced(LOGLEVEL.INFO, "automator.updateGame", `Channel ${this.getLogin()} is still offline, timeout check.`);
                    }
                }, 30 * 1000); // remove in future, just for testing
            }
            */

            if (
                !this.channel?.no_capture &&
                is_live &&
                !this.channel?.is_capturing
            ) {
                if (!this.getVodID()) {
                    log(
                        LOGLEVEL.WARNING,
                        "automator.updateGame",
                        `Channel ${this.getLogin()} does not have a stream id, cannot start downloading from chapter update.`
                    );
                } else {
                    log(
                        LOGLEVEL.INFO,
                        "automator.updateGame",
                        `Channel ${this.getLogin()} status is online but not capturing, checking if we can start downloading.`
                    );

                    /**
                     * After a stream ends, the streamer can still change the stream title or game.
                     * This will trigger an updateGame event, but we don't want to start downloading again if the stream is not live.
                     * @TODO: check for false positives
                     */
                    if (!(await this.channel?.isLiveApi())) {
                        log(
                            LOGLEVEL.WARNING,
                            "automator.updateGame",
                            `Channel ${this.getLogin()} is not live, won't start downloading. ` +
                                `This might be caused by the streamer changing the stream title or game after ending the stream.`
                        );
                        return false;
                    }

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

        if (
            fs.existsSync(
                path.join(BaseConfigDataFolder.config, "twitch_oauth.txt")
            )
        ) {
            const token = fs
                .readFileSync(
                    path.join(BaseConfigDataFolder.config, "twitch_oauth.txt"),
                    "utf8"
                )
                .trim();
            censoredLogWords.add(token.toString());
            cmd.push(`--twitch-api-header=Authorization=OAuth ${token}`);
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

        // one custom api header
        if (Config.getInstance().hasValue("capture.twitch-api-header")) {
            cmd.push(
                "--twitch-api-header",
                Config.getInstance().cfg<string>("capture.twitch-api-header")
            );
        }

        // access token param
        if (
            Config.getInstance().hasValue("capture.twitch-access-token-param")
        ) {
            cmd.push(
                "--twitch-access-token-param",
                Config.getInstance().cfg<string>(
                    "capture.twitch-access-token-param"
                )
            );
        }

        // client id
        if (Config.getInstance().hasValue("capture.twitch-client-id")) {
            cmd.push(
                "--twitch-api-header",
                `Client-ID=${Config.getInstance().cfg<string>(
                    "capture.twitch-client-id"
                )}`
            );
        }

        // streamlink-ttvlol plugin
        if (Config.getInstance().cfg("capture.twitch-ttv-lol-plugin")) {
            cmd.push("--plugin-dirs", BaseConfigDataFolder.streamlink_plugins);

            if (
                Config.getInstance().hasValue("capture.twitch-proxy-playlist")
            ) {
                cmd.push(
                    "--twitch-proxy-playlist",
                    Config.getInstance().cfg<string>(
                        "capture.twitch-proxy-playlist"
                    )
                );
            } else {
                log(
                    LOGLEVEL.WARNING,
                    "automator.providerArgs",
                    "Twitch proxy playlist is enabled but no URL is set."
                );
            }

            if (
                Config.getInstance().hasValue(
                    "capture.twitch-proxy-playlist-exclude"
                )
            ) {
                cmd.push(
                    "--twitch-proxy-playlist-exclude",
                    Config.getInstance().cfg<string>(
                        "capture.twitch-proxy-playlist-exclude"
                    )
                );
            }
        }

        return cmd;
    }

    public captureTicker(source: "stdout" | "stderr", data: string): void {
        super.captureTicker(source, data); // call parent

        if (data == null || data == undefined || typeof data !== "string") {
            log(
                LOGLEVEL.ERROR,
                "automator.captureTicker",
                "Invalid data received from streamlink",
                {
                    source,
                    data,
                }
            );
            return;
        }

        if (data.includes("2bc4 fork")) {
            log(
                LOGLEVEL.INFO,
                "automator.captureVideo",
                "Twitch streamlink-ttvlol plugin detected."
            );
        }

        const proxy_match = data.match(/Using playlist proxy: '(.*)'/);
        if (proxy_match) {
            log(
                LOGLEVEL.INFO,
                "automator.captureVideo",
                `Using playlist proxy: ${proxy_match[1]}`
            );
        }
    }
}
