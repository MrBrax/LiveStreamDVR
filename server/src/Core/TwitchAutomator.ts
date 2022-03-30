import { spawn } from "child_process";
import { format, formatDistanceToNow, parse } from "date-fns";
import express from "express";
import fs from "fs";
import { IncomingHttpHeaders } from "http";
import path from "path";
import { TwitchVODChapterJSON } from "Storage/JSON";
import { VideoQuality } from "../../../common/Config";
import { EventSubResponse } from "../../../common/TwitchAPI/EventSub";
import { ChannelUpdateEvent } from "../../../common/TwitchAPI/EventSub/ChannelUpdate";
import { AppRoot, BaseConfigFolder } from "./BaseConfig";
import { KeyValue } from "./KeyValue";
import { TwitchAutomatorJob } from "./TwitchAutomatorJob";
import { TwitchChannel } from "./TwitchChannel";
import { TwitchConfig } from "./TwitchConfig";
import { TwitchHelper } from "./TwitchHelper";
import { LOGLEVEL, TwitchLog } from "./TwitchLog";
import { TwitchVOD } from "./TwitchVOD";
import { TwitchVODChapter } from "./TwitchVODChapter";
import { TwitchWebhook } from "./TwitchWebhook";
import { MuteStatus, nonGameCategories } from "../../../common/Defs";
import chalk from "chalk";
import { Sleep } from "../Helpers/Sleep";
import { ClientBroker } from "./ClientBroker";
import { replaceAll } from "Helpers/ReplaceAll";

// import { ChatDumper } from "../../../twitch-chat-dumper/ChatDumper";

export class TwitchAutomator {

    vod: TwitchVOD | undefined;
    channel: TwitchChannel | undefined;

    realm = "twitch";

    private broadcaster_user_id = "";
    private broadcaster_user_login = "";
    private broadcaster_user_name = "";

    payload_eventsub: EventSubResponse | undefined;
    payload_headers: IncomingHttpHeaders | undefined;

    /** @deprecated */
    data_cache: EventSubResponse | undefined;

    force_record = false;
    stream_resolution: VideoQuality | undefined;

    capture_filename = "";
    converted_filename = "";
    chat_filename = "";

    captureJob: TwitchAutomatorJob | undefined;
    chatJob: TwitchAutomatorJob | undefined;

    public basename() {
        return `${this.getLogin()}_${replaceAll(this.getStartDate(), ":", "_")}_${this.getVodID()}`; // @todo: replaceAll
    }

    public getVodID() {
        return KeyValue.get(`${this.getLogin()}.vod.id`);
        // return $this->payload['id'];
    }

    public getUserID() {
        return this.broadcaster_user_id;
    }

    public getUsername() {
        return this.broadcaster_user_name;
    }

    public getLogin() {
        return this.broadcaster_user_login;
    }

    public getStartDate() {
        return KeyValue.get(`${this.getLogin()}.vod.started_at`) || "";
    }

    public getDateTime() {
        // return date(TwitchHelper::DATE_FORMAT);
        return format(new Date(), TwitchHelper.TWITCH_DATE_FORMAT);
    }

    public streamURL() {
        return `twitch.tv/${this.broadcaster_user_login}`;
    }

    /**
     * Entrypoint for stream capture, this is where all Twitch EventSub (webhooks) end up.
     */
    public async handle(data: EventSubResponse, request: express.Request) {
        TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "automator", "Handle called, proceed to parsing.");

        if (!request.header("Twitch-Eventsub-Message-Id")) {
            TwitchLog.logAdvanced(LOGLEVEL.ERROR, "automator", "No twitch message id supplied to handle");
            return false;
        }

        const message_retry = request.header("Twitch-Eventsub-Message-Retry") || null;

        this.payload_eventsub = data;
        this.payload_headers = request.headers;

        const subscription = data.subscription;
        const subscription_type = subscription.type;
        const subscription_id = subscription.id;

        this.data_cache = data;

        const event = data.event;
        this.broadcaster_user_id = event.broadcaster_user_id;
        this.broadcaster_user_login = event.broadcaster_user_login;
        this.broadcaster_user_name = event.broadcaster_user_name;

        this.channel = TwitchChannel.getChannelByLogin(this.broadcaster_user_login);

        if (subscription_type === "channel.update") {

            // check if channel is in config, copypaste
            if (!TwitchChannel.getChannelByLogin(this.broadcaster_user_login)) {
                TwitchLog.logAdvanced(LOGLEVEL.ERROR, "automator", `Handle (update) triggered with sub id ${subscription_id}, but username '${this.broadcaster_user_login}' is not in config.`);

                // 5head solution
                // TwitchHelper.channelUnsubscribe($this->broadcaster_user_id);
                TwitchHelper.eventSubUnsubscribe(subscription_id);
                return false;
            }

            // KeyValue.set("${this.broadcaster_user_login}.last.update", (new DateTime())->format(DateTime::ATOM));
            KeyValue.set(`${this.broadcaster_user_login}.last.update`, new Date().toISOString());
            TwitchLog.logAdvanced(LOGLEVEL.INFO, "automator", `Channel update for ${this.broadcaster_user_login}`);

            await this.updateGame();
        } else if (subscription_type == "stream.online" && "id" in event) {

            KeyValue.set(`${this.broadcaster_user_login}.last.online`, new Date().toISOString());
            TwitchLog.logAdvanced(LOGLEVEL.INFO, "automator", `Stream online for ${this.broadcaster_user_login} (retry ${message_retry})`);

            // const channel_obj = TwitchChannel.getChannelByLogin(this.broadcaster_user_login);

            // check if channel is in config, hmm
            if (!this.channel) {
                TwitchLog.logAdvanced(LOGLEVEL.ERROR, "automator", `Handle (online) triggered with sub id ${subscription_id}, but username '${this.broadcaster_user_login}' is not in config.`);

                // 5head solution
                // TwitchHelper.channelUnsubscribe($this->broadcaster_user_id);
                TwitchHelper.eventSubUnsubscribe(subscription_id);
                return false;
            }

            if (this.channel.no_capture) {
                TwitchLog.logAdvanced(LOGLEVEL.INFO, "automator", `Skip capture for ${this.broadcaster_user_login} because no-capture is set`);
                return false;
            }

            KeyValue.set(`${this.broadcaster_user_login}.online`, "1");
            KeyValue.set(`${this.broadcaster_user_login}.vod.id`, event.id);
            KeyValue.set(`${this.broadcaster_user_login}.vod.started_at`, event.started_at);

            // $this->payload = $data['data'][0];

            const basename = this.basename();

            // const folder_base = TwitchHelper.vodFolder(this.broadcaster_user_login);

            if (TwitchVOD.hasVod(basename)) {
                TwitchLog.logAdvanced(LOGLEVEL.INFO, "automator", `Channel ${this.broadcaster_user_login} online, but vod ${basename} already exists, skipping`);
                return false;
            }

            if (TwitchConfig.notificationCategories.streamOnline && this.channel) {
                ClientBroker.notify(
                    `${this.broadcaster_user_login} is live!`,
                    "",
                    this.channel.profile_image_url,
                    TwitchConfig.notificationCategories.streamOnline
                );
            }

            await this.download();

        } else if (subscription_type == "stream.offline") {

            KeyValue.set(`${this.broadcaster_user_login}.last.offline`, new Date().toISOString());
            TwitchLog.logAdvanced(LOGLEVEL.INFO, "automator", `Stream offline for ${this.broadcaster_user_login}`);

            // const channel = TwitchChannel.getChannelByLogin(this.broadcaster_user_login);

            if (TwitchConfig.notificationCategories.streamOffline && this.channel) {
                ClientBroker.notify(
                    `${this.broadcaster_user_login} has gone offline!`,
                    this.channel && this.channel.latest_vod && this.channel.latest_vod.started_at ? `Was streaming for ${formatDistanceToNow(this.channel.latest_vod.started_at)}.` : "",
                    this.channel.profile_image_url,
                    TwitchConfig.notificationCategories.streamOffline
                );
            }

            // KeyValue.set("${this.broadcaster_user_login}.online", "0");
            KeyValue.set(`${this.broadcaster_user_login}.online`, null);
            // KeyValue.set("${this.broadcaster_user_login}.vod.id", null);
            // KeyValue.set("${this.broadcaster_user_login}.vod.started_at", null);

            await this.end();
        } else {

            TwitchLog.logAdvanced(LOGLEVEL.ERROR, "automator", `No supported subscription type (${subscription_type}).`);
        }

    }

    public async updateGame(from_cache = false) {

        const basename = this.basename();

        // if online
        if (KeyValue.get(`${this.getLogin()}.online`) === "1") {

            // const folder_base = TwitchHelper.vodFolder(this.getLogin());

            const vod = TwitchVOD.getVod(basename);

            if (!vod) {
                TwitchLog.logAdvanced(LOGLEVEL.FATAL, "automator", `Tried to load VOD ${basename} for chapter update but errored.`);
                TwitchLog.logAdvanced(LOGLEVEL.INFO, "automator", `Resetting online status on ${this.getLogin()}.`);
                KeyValue.delete(`${this.broadcaster_user_login}.online`);
                return false;
            }

            if (!vod.getCapturingStatus()) {
                TwitchLog.logAdvanced(LOGLEVEL.ERROR, "automator", `VOD ${basename} is not capturing, skipping chapter update.`);
                KeyValue.delete(`${this.broadcaster_user_login}.online`);
                return false;
            }

            let event: ChannelUpdateEvent;

            // fetch from cache
            if (from_cache) {
                const cd = KeyValue.get(`${this.getLogin()}.channeldata`);
                if (!cd) {
                    TwitchLog.logAdvanced(LOGLEVEL.ERROR, "automator", `Tried to get channel cache for ${this.broadcaster_user_login} but it was not available.`);
                    return false;
                }
                const cdj = JSON.parse(cd);
                if (!cdj) {
                    TwitchLog.logAdvanced(LOGLEVEL.ERROR, "automator", `Tried to parse channel cache json for ${this.broadcaster_user_login} but it errored.`);
                    return false;
                }
                event = cdj;
            } else if (this.payload_eventsub && "title" in this.payload_eventsub.event) {
                if (!this.payload_eventsub || !this.payload_eventsub.event) {
                    TwitchLog.logAdvanced(LOGLEVEL.ERROR, "automator", `Tried to get event for ${this.broadcaster_user_login} but it was not available.`);
                    return false;
                }
                event = this.payload_eventsub.event as ChannelUpdateEvent;
            } else {
                TwitchLog.logAdvanced(LOGLEVEL.ERROR, "automator", `No last resort event for ${this.broadcaster_user_login} not available.`);
                return false;
            }

            TwitchLog.logAdvanced(LOGLEVEL.SUCCESS, "automator", `Channel data for ${this.broadcaster_user_login} fetched from ${from_cache ? "cache" : "notification"}.`);


            const chapter_data = await this.getChapterData(event);

            const chapter = await TwitchVODChapter.fromJSON(chapter_data);

            vod.addChapter(chapter);
            vod.saveJSON("game update");

            TwitchWebhook.dispatch("chapter_update", {
                "chapter": chapter,
                "vod": vod,
            });

            // append chapter to history
            fs.writeFileSync(path.join(BaseConfigFolder.history, `${this.broadcaster_user_login}.jsonline`), JSON.stringify(chapter) + "\n", { flag: "a" });

            TwitchLog.logAdvanced(
                LOGLEVEL.SUCCESS,
                "automator",
                `Stream updated on '${this.broadcaster_user_login}' to '${event.category_name}' (${event.title}) using ${from_cache ? "cache" : "eventsub"}.`
            );

            // const channel = TwitchChannel.getChannelByLogin(this.broadcaster_user_login);
            if (TwitchConfig.notificationCategories.streamStatusChange && this.channel) {
                // ClientBroker.notify(); // @todo: compose message from previous and current game, favorite, etc.
                this.notifyChapterChange(this.channel);
            }

            return true;

        } else {

            if (!this.payload_eventsub || !this.payload_eventsub.event) {
                TwitchLog.logAdvanced(LOGLEVEL.ERROR, "automator", `Tried to get event for ${this.broadcaster_user_login} but it was not available.`);
                return false;
            }

            if (!("title" in this.payload_eventsub.event)) {
                TwitchLog.logAdvanced(LOGLEVEL.ERROR, "automator", `Event type was wrong for ${this.broadcaster_user_login}`);
                return false;
            }

            const event = this.payload_eventsub.event;
            KeyValue.set(`${this.broadcaster_user_login}.channeldata`, JSON.stringify(this.payload_eventsub.event));
            TwitchLog.logAdvanced(LOGLEVEL.INFO, "automator", `Channel ${this.broadcaster_user_login} not online, saving channel data to cache: ${event.category_name} (${event.title})`);

            if (TwitchConfig.notificationCategories.offlineStatusChange) {
                // const channel = TwitchChannel.getChannelByLogin(this.broadcaster_user_login);
                if (this.channel) {
                    ClientBroker.notify(
                        `Offline channel ${this.broadcaster_user_login} changed status`,
                        `${event.category_name} (${event.title})`,
                        this.channel.profile_image_url,
                        TwitchConfig.notificationCategories.offlineStatusChange
                    );
                }
            }

            const chapter_data = await this.getChapterData(event);
            chapter_data.online = false;

            if (chapter_data.viewer_count) {
                TwitchLog.logAdvanced(LOGLEVEL.INFO, "automator", `Channel ${this.broadcaster_user_login} not online, but managed to get viewer count, so it's online? 🤔`);
            }

            // $fp = fopen(TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . "history" . DIRECTORY_SEPARATOR . this.broadcaster_user_login . ".jsonline", 'a');
            // fwrite($fp, json_encode($chapter) . "\n");
            // fclose($fp);

            return true;
        }

    }
    notifyChapterChange(channel: TwitchChannel) {

        const vod = channel.latest_vod;
        if (!vod) return;

        const current_chapter = vod.chapters[vod.chapters.length - 1];
        const previous_chapter = vod.chapters.length > 2 ? vod.chapters[vod.chapters.length - 2] : null;

        let title = "";
        const body = current_chapter.title;
        const icon = channel.profile_image_url;
        
        if (
            (!previous_chapter?.game_id && current_chapter.game_id) || // game changed from null to something
            (previous_chapter?.game_id && current_chapter.game_id && previous_chapter.game_id !== current_chapter.game_id) // game changed
        ) {
            let category = TwitchConfig.notificationCategories.streamStatusChange;
            if (nonGameCategories.includes(current_chapter.game_name)) {
                if (current_chapter.game?.isFavourite()){
                    title = `${channel.display_name} is online with one of your favourite categories: ${current_chapter.game_name}!`;
                    category = TwitchConfig.notificationCategories.streamStatusChangeFavourite;
                } else if (current_chapter.game_name) {
                    title = `${channel.display_name} is streaming ${current_chapter.game_name}!`;
                } else {
                    title = `${channel.display_name} is streaming without a category!`;
                }
            } else {
                if (current_chapter.game?.isFavourite()) {
                    title = `${channel.display_name} is now playing one of your favourite games: ${current_chapter.game_name}!`;
                    category = TwitchConfig.notificationCategories.streamStatusChangeFavourite;
                } else if (current_chapter.game_name) {
                    title = `${channel.display_name} is now playing ${current_chapter.game_name}!`;
                } else {
                    title = `${channel.display_name} is streaming without a game!`;
                }

            }

            ClientBroker.notify(title, body, icon, category);

        }

    }

    private async getChapterData(event: ChannelUpdateEvent): Promise<TwitchVODChapterJSON> {

        const chapter_data = {
            started_at: new Date().toISOString(),
            game_id: event.category_id,
            game_name: event.category_name,
            // 'viewer_count' 	: $data_viewer_count,
            title: event.title,
            is_mature: event.is_mature,
            online: true,
        } as TwitchVODChapterJSON;

        // extra metadata with a separate api request
        if (TwitchConfig.cfg("api_metadata")) {

            const streams = await TwitchChannel.getStreams(this.getUserID());

            if (streams && streams.length > 0) {

                const stream = streams[0];

                if (stream.viewer_count !== undefined) {

                    chapter_data.viewer_count = stream.viewer_count;

                } else {

                    TwitchLog.logAdvanced(LOGLEVEL.ERROR, "automator", "No viewer count in metadata request.");

                }

            } else {

                TwitchLog.logAdvanced(LOGLEVEL.ERROR, "automator", "No streams in metadata request.");

            }
        }

        return chapter_data;

    }

    private cleanup() {
        // const vods = fs.readdirSync(TwitchHelper.vodFolder(this.getLogin())).filter(f => f.startsWith(`${this.getLogin()}_`) && f.endsWith(".json"));

        if (!this.channel) {
            TwitchLog.logAdvanced(LOGLEVEL.ERROR, "automator", `Tried to cleanup ${this.broadcaster_user_login} but channel was not available.`);
            return;
        }

        let total_size = 0;
        const vods = this.channel.vods_list;

        const vod_candidates = [];
        if (vods) {
            for (const vodclass of vods) {
                if (vodclass.is_finalized && vodclass.basename !== this.basename()) {

                    if (TwitchConfig.cfg("keep_deleted_vods") && vodclass.twitch_vod_exists === false) {
                        TwitchLog.logAdvanced(LOGLEVEL.INFO, "automator", `Keeping ${vodclass.basename} due to it being deleted on Twitch.`);
                        continue;
                    }

                    if (TwitchConfig.cfg("keep_favourite_vods") && vodclass.hasFavouriteGame()) {
                        TwitchLog.logAdvanced(LOGLEVEL.INFO, "automator", `Keeping ${vodclass.basename} due to it having a favourite game.`);
                        continue;
                    }

                    if (TwitchConfig.cfg("keep_muted_vods") && vodclass.twitch_vod_muted === MuteStatus.MUTED) {
                        TwitchLog.logAdvanced(LOGLEVEL.INFO, "automator", `Keeping ${vodclass.basename} due to it being muted on Twitch.`);
                        continue;
                    }

                    total_size += vodclass.total_size;
                    vod_candidates.push(vodclass);
                }
            }
        }

        const gigabytes = total_size / (1024 * 1024 * 1024);

        TwitchLog.logAdvanced(LOGLEVEL.INFO, "automator", `Total filesize for ${this.getLogin()}: ${TwitchHelper.formatBytes(total_size)}`);
        TwitchLog.logAdvanced(
            LOGLEVEL.INFO,
            "automator",
            `Amount for ${this.getLogin()}: ${vod_candidates.length}/${(TwitchConfig.cfg<number>("vods_to_keep", 5) + 1)}`
        );

        if (
            vod_candidates.length > TwitchConfig.cfg<number>("vods_to_keep", 5) + 1 ||
            gigabytes > TwitchConfig.cfg<number>("storage_per_streamer", 100)) {
            const candidate = vod_candidates[0];

            TwitchLog.logAdvanced(LOGLEVEL.INFO, "automator", `Total filesize for ${this.getLogin()} exceeds either vod amount or storage per streamer`);

            // don't delete the newest vod, hopefully. this shouldn't happen, but just in case.
            if (candidate.basename == this.basename()) {
                TwitchLog.logAdvanced(LOGLEVEL.ERROR, "automator", `Trying to cleanup latest VOD ${candidate.basename}`);
                return false;
            }

            // only delete first vod, too scared of having it do all
            TwitchLog.logAdvanced(LOGLEVEL.INFO, "automator", `Cleanup ${candidate.basename}`);

            candidate.delete();

        }

    }

    public end() {
        TwitchLog.logAdvanced(LOGLEVEL.INFO, "automator", "Stream end");
    }

    public async download(tries = 0) {

        // const data_title = this.getTitle();
        const data_started = this.getStartDate();
        const data_id = this.getVodID();
        const data_username = this.getUsername();

        // const channel = TwitchChannel.getChannelByLogin(this.getLogin());

        if (!this.channel) {
            throw new Error(`Channel ${this.getLogin()} not found, weird.`);
        }

        if (!data_id) {
            TwitchLog.logAdvanced(LOGLEVEL.ERROR, "automator", "No data supplied for download, try #{$tries}");
            throw new Error("No data supplied");
        }

        const basename = this.basename();
        const folder_base = TwitchHelper.vodFolder(this.getLogin());

        // make a folder for the streamer if it for some reason doesn't exist, but it should get created in the config
        if (!fs.existsSync(folder_base)) {
            TwitchLog.logAdvanced(LOGLEVEL.WARNING, "automator", `Making folder for ${data_username}, unusual.`);
            fs.mkdirSync(folder_base);
        }

        // if running
        const job = TwitchAutomatorJob.findJob(`capture_${basename}`);
        if (job && job.getStatus()) {
            const meta = job.metadata as {
                login: string;
                basename: string;
                capture_filename: string;
                stream_id: string;
            };
            TwitchLog.logAdvanced(
                LOGLEVEL.FATAL,
                "automator",
                `Stream already capturing to ${meta.basename} from ${data_username}, but reached download function regardless!`
            );
            return false;
        }

        // create the vod and put it inside this class
        this.vod = await this.channel.createVOD(path.join(folder_base, `${basename}.json`));
        this.vod.meta = this.payload_eventsub;
        // this.vod.json.meta = $this.payload_eventsub; // what
        this.vod.capture_id = this.getVodID() || "1";
        this.vod.started_at = parse(data_started, TwitchHelper.TWITCH_DATE_FORMAT, new Date());

        if (this.force_record) this.vod.force_record = true;

        this.vod.not_started = false;

        this.vod.saveJSON("stream download");
        // const r = await this.vod.refreshJSON();
        // if (!r) {
        //     throw new Error("Failed to refresh JSON");
        // }
        // this.vod = r;

        TwitchWebhook.dispatch("start_download", {
            "vod": this.vod,
        });

        // const streamer = TwitchChannel.getChannelByLogin(this.broadcaster_user_login);

        // check matched title, broken?
        /*
        if (streamer && streamer.match && streamer.match.length > 0) {

            let match = false;

            // $this->notify($basename, 'Check keyword matches for user ' . json_encode($streamer), self::NOTIFY_GENERIC);
            TwitchLog.logAdvanced(LOGLEVEL.INFO, "automator", "Check keyword matches for {$basename}", ['download' => $data_username]);

            foreach ($streamer->match as $m) {
                if (mb_strpos(strtolower($data_title), $m) !== false) {
                    $match = true;
                    break;
                }
            }

            if (!$match) {
                // $this->notify($basename, 'Cancel download because stream title does not contain keywords', self::NOTIFY_GENERIC);
                TwitchLog.logAdvanced(LOGLEVEL.WARNING, "automator", "Cancel download of {$basename} due to missing keywords", ['download' => $data_username]);
                $this->vod->delete();
                return;
            }
        }
        */

        this.vod.is_capturing = true;
        this.vod.saveJSON("is_capturing set");

        // update the game + title if it wasn't updated already
        TwitchLog.logAdvanced(LOGLEVEL.INFO, "automator", `Update game for ${basename}`);
        if (KeyValue.get(`${this.getLogin()}.channeldata`)) {
            this.updateGame(true);
            KeyValue.delete(`${this.getLogin()}.channeldata`);
        }

        const container_ext = TwitchConfig.cfg("vod_container", "mp4");
        this.capture_filename = path.join(folder_base, `${basename}.ts`);
        this.converted_filename = path.join(folder_base, `${basename}.${container_ext}`);
        this.chat_filename = path.join(folder_base, `${basename}.chatdump`);


        // capture with streamlink, this is the crucial point in this entire program
        this.startCaptureChat();

        try {
            await this.captureVideo();
        } catch (error) {
            TwitchLog.logAdvanced(LOGLEVEL.FATAL, "automator", `Failed to capture video: ${error}`);
            this.endCaptureChat();
            // this.vod.delete();
            return false;
        }

        this.endCaptureChat();

        const capture_success = fs.existsSync(this.capture_filename) && fs.statSync(this.capture_filename).size > 0;

        // send internal webhook for capture start
        TwitchWebhook.dispatch("end_capture", {
            "vod": this.vod,
            "success": capture_success,
        });

        // error handling if nothing got downloaded
        if (!capture_success) {

            TwitchLog.logAdvanced(LOGLEVEL.WARNING, "automator", `Panic handler for ${basename}, no captured file!`);

            if (tries >= TwitchConfig.cfg<number>("download_retries")) {
                TwitchLog.logAdvanced(LOGLEVEL.ERROR, "automator", `Giving up on downloading, too many tries for ${basename}`);
                fs.renameSync(path.join(folder_base, `${basename}.json`), path.join(folder_base, `${basename}.json.broken`));
                throw new Error("Too many tries");
                // @TODO: fatal error
            }

            TwitchLog.logAdvanced(LOGLEVEL.ERROR, "automator", `Error when downloading, retrying ${basename}`);

            // sleep(15);
            await Sleep(15 * 1000);

            this.download(tries + 1);

            return;
        }

        // end timestamp
        TwitchLog.logAdvanced(LOGLEVEL.INFO, "automator", `Add end timestamp for ${basename}`);

        this.vod.ended_at = new Date();
        this.vod.is_capturing = false;
        if (this.stream_resolution) this.vod.stream_resolution = this.stream_resolution;
        this.vod.saveJSON("stream capture end");

        const duration = this.vod.getDurationLive();
        if (duration && duration > (86400 - (60 * 10))) {
            TwitchLog.logAdvanced(LOGLEVEL.WARNING, "automator", `The stream ${basename} is 24 hours, this might cause issues.`);
        }

        // wait for one minute in case something didn't finish
        // sleep(60);
        await Sleep(60 * 1000);

        // $this->vod = $this->vod->refreshJSON();
        this.vod.is_converting = true;
        this.vod.saveJSON("is_converting set");

        // convert with ffmpeg
        await this.convertVideo();

        // sleep(10);
        await Sleep(10 * 1000);

        const convert_success = fs.existsSync(this.capture_filename) && fs.existsSync(this.converted_filename) && fs.statSync(this.converted_filename).size > 0;

        // send internal webhook for convert start
        TwitchWebhook.dispatch("end_convert", {
            "vod": this.vod,
            "success": convert_success,
        });

        // remove ts if both files exist
        if (convert_success) {
            TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "automator", `Remove ts file for ${basename}`);
            fs.unlinkSync(this.capture_filename);
        } else {
            TwitchLog.logAdvanced(LOGLEVEL.FATAL, "automator", `Missing conversion files for ${basename}`);
            // this.vod.automator_fail = true;
            this.vod.is_converting = false;
            this.vod.saveJSON("automator fail");
            return false;
        }

        // add the captured segment to the vod info
        TwitchLog.logAdvanced(LOGLEVEL.INFO, "automator", `Conversion done, add segments to ${basename}`);

        // @todo: no hack
        // tmp_vod = await this.vod.refreshJSON();
        // if (!tmp_vod) throw new Error('Failed to refresh JSON');
        // this.vod = tmp_vod;

        this.vod.is_converting = false;
        this.vod.addSegment(path.basename(this.converted_filename));
        this.vod.saveJSON("add segment");

        // remove old vods for the streamer
        TwitchLog.logAdvanced(LOGLEVEL.INFO, "automator", `Cleanup old VODs for ${data_username}`);
        this.cleanup();

        // finalize
        TwitchLog.logAdvanced(LOGLEVEL.INFO, "automator", `Sleep 2 minutes for ${basename}`);
        // sleep(60 * 2);
        await Sleep(60 * 1000 * 2);

        TwitchLog.logAdvanced(LOGLEVEL.INFO, "automator", `Do metadata on ${basename}`);

        // const vodclass = await TwitchVOD.load(path.join(folder_base, `${basename}.json`));
        // if (!vodclass) throw new Error("Failed to load VOD");

        await this.vod.finalize();
        this.vod.saveJSON("finalized");

        
        // download chat and optionally burn it
        if (this.channel.download_chat && this.vod.twitch_vod_id) {
            TwitchLog.logAdvanced(LOGLEVEL.INFO, "automator", `Auto download chat on ${basename}`);
            this.vod.downloadChat();

            if (this.channel.burn_chat) {
                TwitchLog.logAdvanced(LOGLEVEL.ERROR, "automator", "Automatic chat burning has been disabled until settings have been implemented.");
                // if ($vodclass->renderChat()) {
                // 	$vodclass->burnChat();
                // }
            }
        }
        

        // vodclass.setPermissions();

        // add to history, testing
        /*
        $history = file_exists(TwitchConfig::$historyPath) ? json_decode(file_get_contents(TwitchConfig::$historyPath), true) : [];
        $history[] = [
            'streamer_name' => $this->vod->streamer_name,
            'started_at' => $this->vod->dt_started_at,
            'ended_at' => $this->vod->dt_ended_at,
            'title' => $data_title
        ];
        file_put_contents(TwitchConfig::$historyPath, json_encode($history));
        */

        TwitchLog.logAdvanced(LOGLEVEL.SUCCESS, "automator", `All done for ${basename}`);

        // finally send internal webhook for capture finish
        TwitchWebhook.dispatch("end_download", {
            "vod": this.vod,
        });

        return true;

    }

    /**
     * Create process and capture video
     * @throws
     * @returns 
     */
    public captureVideo(): Promise<boolean> {

        return new Promise((resolve, reject) => {

            if (!this.vod) {
                TwitchLog.logAdvanced(LOGLEVEL.ERROR, "automator", `No VOD for ${this.basename()}, this should not happen`);
                reject(false);
                return;
            }

            const basename = this.basename();

            const stream_url = this.streamURL();
            // const folder_base = TwitchHelper.vodFolder(this.getLogin());
            // const streamer_config = TwitchChannel.getChannelByLogin(this.getLogin());

            const bin = TwitchHelper.path_streamlink();

            if (!bin) {
                TwitchLog.logAdvanced(LOGLEVEL.ERROR, "automator", "Streamlink not found");
                reject(false);
                return;
            }

            const cmd: string[] = [];

            // start recording from start of stream, though twitch doesn't support this
            cmd.push("--hls-live-restart");

            // How many segments from the end to start live HLS streams on.
            cmd.push("--hls-live-edge", "99999");

            // timeout due to ads
            cmd.push("--hls-timeout", TwitchConfig.cfg("hls_timeout", 120).toString());

            // timeout due to ads
            cmd.push("--hls-segment-timeout", TwitchConfig.cfg("hls_timeout", 120).toString());

            // The size of the thread pool used to download HLS segments.
            cmd.push("--hls-segment-threads", "5");

            // disable channel hosting
            cmd.push("--twitch-disable-hosting");

            // enable low latency mode, probably not a good idea without testing
            if (TwitchConfig.cfg("low_latency", false)) {
                cmd.push("--twitch-low-latency");
            }

            // Skip embedded advertisement segments at the beginning or during a stream
            if (TwitchConfig.cfg("disable_ads", false)) {
                cmd.push("--twitch-disable-ads");
            }

            // Retry fetching the list of available streams until streams are found 
            cmd.push("--retry-streams", "10");

            // stop retrying the fetch after COUNT retry attempt(s).
            cmd.push("--retry-max", "5");

            // disable reruns
            cmd.push("--twitch-disable-reruns");

            // logging level
            if (TwitchConfig.cfg("debug", false)) {
                cmd.push("--loglevel", "debug");
            } else if (TwitchConfig.cfg("app_verbose", false)) {
                cmd.push("--loglevel", "info");
            }

            // output file
            cmd.push("-o", this.capture_filename);

            // twitch url
            cmd.push("--url", stream_url);

            // twitch quality
            cmd.push("--default-stream");
            if (this.channel && this.channel.quality) {
                cmd.push(this.channel.quality.join(","));
            } else {
                cmd.push("best");
            }

            this.vod.capture_started = new Date();
            this.vod.saveJSON("dt_capture_started set");

            TwitchLog.logAdvanced(LOGLEVEL.INFO, "automator", `Starting capture with filename ${path.basename(this.capture_filename)}`);

            // @todo: use TwitchHelper.startJob instead

            // spawn process
            const capture_process = spawn(bin, cmd, {
                cwd: path.dirname(this.capture_filename),
                windowsHide: true,
            });

            // make job for capture
            let capture_job: TwitchAutomatorJob;
            const jobName = `capture_${basename}`;

            if (capture_process.pid) {
                TwitchLog.logAdvanced(LOGLEVEL.SUCCESS, "automator", `Spawned process ${capture_process.pid} for ${jobName}`);
                capture_job = TwitchAutomatorJob.create(jobName);
                capture_job.setPid(capture_process.pid);
                capture_job.setProcess(capture_process);
                capture_job.startLog(jobName, `$ ${bin} ${cmd.join(" ")}\n`);
                capture_job.setMetadata({
                    "login": this.getLogin(), // @todo: username?
                    "basename": this.basename(),
                    "capture_filename": this.capture_filename,
                    "stream_id": this.getVodID(),
                });
                if (!capture_job.save()) {
                    TwitchLog.logAdvanced(LOGLEVEL.ERROR, "automator", `Failed to save job ${jobName}`);
                }
            } else {
                TwitchLog.logAdvanced(LOGLEVEL.FATAL, "automator", `Failed to spawn process for ${jobName}`);
                reject(false);
                return;
            }

            // const capture_job = TwitchHelper.startJob(bin, cmd, jobName);
            // const capture_process = capture_job.process;

            let lastSize = 0;
            const keepaliveAlert = () => {
                if (fs.existsSync(this.capture_filename)) {
                    const size = fs.statSync(this.capture_filename).size;
                    const bitRate = (size - lastSize) / 120;
                    lastSize = size;
                    console.log(
                        chalk.bgGreen.whiteBright(
                            `🎥 ${new Date().toISOString()} ${basename} ${this.stream_resolution} ` +
                            `${TwitchHelper.formatBytes(size)} ${TwitchHelper.formatBits(bitRate)}`
                        )
                    );                    
                } else {
                    console.log(chalk.bgRed.whiteBright(`🎥 ${new Date().toISOString()} ${basename} missing`));
                }

            };

            const keepalive = setInterval(keepaliveAlert, 120 * 1000);

            // critical end
            capture_process.on("close", (code, signal) => {
                TwitchLog.logAdvanced(LOGLEVEL.SUCCESS, "automator", `Job ${jobName} exited with code ${code}, signal ${signal}`);

                clearInterval(keepalive);

                if (capture_job) {
                    capture_job.clear();
                }

                if (fs.existsSync(this.capture_filename) && fs.statSync(this.capture_filename).size > 0) {

                    const stream_resolution = capture_job.stdout.join("\n").match(/stream:\s([0-9_a-z]+)\s/);
                    if (stream_resolution && this.vod) {
                        this.vod.stream_resolution = stream_resolution[1] as VideoQuality;
                    }

                    resolve(true);
                } else {
                    TwitchLog.logAdvanced(LOGLEVEL.ERROR, "automator", `Capture ${basename} failed`);
                    reject(false);
                }

            });

            let chunks_missing = 0;
            // let current_ad_start = null;

            const ticker = (source: "stdout" | "stderr", raw_data: Buffer) => {

                const data = raw_data.toString();

                if (data.includes("bad interpreter: No such file or directory")) {
                    TwitchLog.logAdvanced(LOGLEVEL.ERROR, "automator", "Fatal error with streamlink, please check logs");
                }

                // get stream resolution
                const res_match = data.match(/stream:\s([0-9_a-z]+)\s/);
                if (res_match) {
                    this.stream_resolution = res_match[1] as VideoQuality;
                    if (this.vod) this.vod.stream_resolution = this.stream_resolution;
                    TwitchLog.logAdvanced(LOGLEVEL.INFO, "automator", `Stream resolution for ${basename}: ${this.stream_resolution}`);
                }

                // stream stop
                if (data.includes("404 Client Error")) {
                    TwitchLog.logAdvanced(LOGLEVEL.WARNING, "automator", `Chunk 404'd for ${basename} (${chunks_missing}/100)!`);
                    chunks_missing++;
                    if (chunks_missing >= 100) {
                        TwitchLog.logAdvanced(LOGLEVEL.WARNING, "automator", `Too many 404'd chunks for ${basename}, stopping!`);
                        this.captureJob?.kill();
                    }
                }

                if (data.includes("Waiting for streams")) {
                    TwitchLog.logAdvanced(LOGLEVEL.WARNING, "automator", `No streams found for ${basename}, retrying...`);
                }

                // stream error
                if (data.includes("403 Client Error")) {
                    TwitchLog.logAdvanced(LOGLEVEL.ERROR, "automator", `Chunk 403'd for ${basename}!`);
                }

                // ad removal
                if (data.includes("Will skip ad segments")) {
                    TwitchLog.logAdvanced(LOGLEVEL.INFO, "automator", `Capturing of ${basename}, will try to remove ads!`);
                    // current_ad_start = new Date();
                }

            };

            // attach output to parsing
            capture_process.stdout.on("data", (data) => { ticker("stdout", data); });
            capture_process.stderr.on("data", (data) => { ticker("stderr", data); });

            // check for errors
            capture_process.on("error", (err) => {
                clearInterval(keepalive);
                TwitchLog.logAdvanced(LOGLEVEL.ERROR, "automator", `Error with streamlink for ${basename}: ${err}`);
                reject(false);
            });

            // process.on("exit", (code, signal) => {
            //     clearInterval(keepalive);
            //     TwitchLog.logAdvanced(LOGLEVEL.ERROR, "automator", `Streamlink exited with code ${code} for ${basename}`);
            // });

            // this.vod.generatePlaylistFile();

            // send internal webhook for capture start
            TwitchWebhook.dispatch("start_capture", {
                "vod": this.vod,
            });

        });

    }

    /*
    handleVideoCaptureEnd(code: number | null, capture_job: TwitchAutomatorJob) {

        const stream_resolution = capture_job.stdout.join("\n").match(/stream:\s([0-9_a-z]+)\s/);
        if (stream_resolution) {
            this.vod.stream_resolution = stream_resolution[1];
        }
        
        capture_job.clear();
    }
    */

    /**
     * Capture chat in a "detached" process
     */
    startCaptureChat() {

        // const channel = TwitchChannel.getChannelByLogin(this.broadcaster_user_login);

        // chat capture
        if ((TwitchConfig.cfg<boolean>("chat_dump") || (this.channel && this.channel.live_chat)) && this.realm == "twitch") {

            const data_started = this.getStartDate();
            // const data_id = this.getVodID();
            const data_login = this.getLogin();
            // const data_username = this.getUsername();
            const data_userid = this.getUserID();

            const chat_bin = "node";
            const chat_cmd: string[] = [];

            // test
            // $chat_cmd[] = 'screen';
            // $chat_cmd[] = '-S';
            // $chat_cmd[] = $basename;

            // $chat_cmd[] = 'python';
            // $chat_cmd[] = __DIR__ . '/Utilities/twitch-chat.py';

            // $chat_cmd[] = 'node';
            // $chat_cmd[] = __DIR__. '/../twitch-chat-dumper/index.js';

            // todo: execute directly in node?
            chat_cmd.push(path.join(AppRoot, "twitch-chat-dumper", "index.js"));
            chat_cmd.push("--channel", data_login);
            chat_cmd.push("--userid", data_userid);
            chat_cmd.push("--date", data_started);
            chat_cmd.push("--output", this.chat_filename);

            TwitchLog.logAdvanced(LOGLEVEL.INFO, "automator", `Starting chat dump with filename ${path.basename(this.chat_filename)}`);

            /*
            // start process
            const chat_process = spawn(chat_bin, chat_cmd, {
                windowsHide: true,
            });

            // $chat_process->start();

            if (chat_process.pid) {
                this.chatJob = TwitchAutomatorJob.create(`chatdump_${this.basename()}`);
                this.chatJob.setPid(chat_process.pid);
                this.chatJob.setProcess(chat_process);
                this.chatJob.setMetadata([
                    'username' => $data_username,
                    'basename' => $basename,
                    'chat_filename' => $chat_filename
                ]);
                $chatJob->save();
            }
            */

            const chat_job = TwitchHelper.startJob(chat_bin, chat_cmd, `chatdump_${this.basename()}`);

            if (chat_job && chat_job.pid) {
                this.chatJob = chat_job;
            } else {
                TwitchLog.logAdvanced(LOGLEVEL.ERROR, "automator", `Failed to start chat dump job with filename ${path.basename(this.chat_filename)}`);
                return false;
            }

            // TwitchHelper:: clearLog("chatdump_{$basename}_stdout.{$tries}");
            // TwitchHelper:: clearLog("chatdump_{$basename}_stderr.{$tries}");
            // TwitchHelper:: appendLog("chatdump_{$basename}_stdout.{$tries}", implode(" ", $chat_cmd));
            // TwitchHelper:: appendLog("chatdump_{$basename}_stderr.{$tries}", implode(" ", $chat_cmd));

            return true;
        }

        return false;

    }

    /**
     * Kill the process, stopping chat capture
     */
    async endCaptureChat() {

        if (this.chatJob) {
            TwitchLog.logAdvanced(LOGLEVEL.INFO, "automator", `Ending chat dump with filename ${path.basename(this.chat_filename)}`);
            await this.chatJob.kill();
        }

    }

    // maybe use this?
    async compressChat() {
        if (fs.existsSync(this.chat_filename)) {
            await TwitchHelper.execSimple("gzip", [this.chat_filename], "compress chat");
            return fs.existsSync(`${this.chat_filename}.gz`);
        }
        return false;
    }

    async convertVideo() {

        const result = await TwitchHelper.remuxFile(this.capture_filename, this.converted_filename);

        if (result && result.success) {
            TwitchLog.logAdvanced(LOGLEVEL.SUCCESS, "automator", `Converted video ${this.capture_filename} to ${this.converted_filename}`);
        } else {
            TwitchLog.logAdvanced(LOGLEVEL.ERROR, "automator", `Failed to convert video ${this.capture_filename} to ${this.converted_filename}`);
        }

        return result && result.success;

    }

}