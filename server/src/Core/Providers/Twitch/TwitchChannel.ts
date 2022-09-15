import axios from "axios";
import chalk from "chalk";
import chokidar from "chokidar";
import { randomUUID } from "crypto";
import { format, parseJSON } from "date-fns";
import fs from "fs";
import readdirSyncRecursive from "fs-readdir-recursive";
import { encode as htmlentities } from "html-entities";
import path from "path";
import { TwitchVODChapterJSON } from "Storage/JSON";
import type { ApiTwitchChannel } from "../../../../../common/Api/Client";
import { TwitchChannelConfig, VideoQuality } from "../../../../../common/Config";
import { MuteStatus, Providers, SubStatus } from "../../../../../common/Defs";
import type { LocalClip } from "../../../../../common/LocalClip";
import type { LocalVideo } from "../../../../../common/LocalVideo";
import { AudioMetadata, VideoMetadata } from "../../../../../common/MediaInfo";
import type { Channel, ChannelsResponse } from "../../../../../common/TwitchAPI/Channels";
import type { ErrorResponse, EventSubTypes } from "../../../../../common/TwitchAPI/Shared";
import type { Stream, StreamsResponse } from "../../../../../common/TwitchAPI/Streams";
import type { SubscriptionRequest, SubscriptionResponse } from "../../../../../common/TwitchAPI/Subscriptions";
import type { BroadcasterType, UsersResponse } from "../../../../../common/TwitchAPI/Users";
import type { UserData } from "../../../../../common/User";
import { AppRoot, BaseConfigDataFolder, BaseConfigPath } from "../../BaseConfig";
import { ClientBroker } from "../../ClientBroker";
import { Config } from "../../Config";
import { Helper } from "../../Helper";
import { Job } from "../../Job";
import { KeyValue } from "../../KeyValue";
import { LiveStreamDVR } from "../../LiveStreamDVR";
import { Log, LOGLEVEL } from "../../Log";
import { TwitchGame } from "./TwitchGame";
import { TwitchVOD } from "./TwitchVOD";
import { BaseChannel } from "../Base/BaseChannel";
import { Webhook } from "../../Webhook";

export class TwitchChannel extends BaseChannel {

    public provider: Providers = "twitch";

    // static channels: TwitchChannel[] = [];
    // static channels_config: ChannelConfig[] = [];
    static channels_cache: Record<string, UserData> = {};

    /**
     * User ID
     * @deprecated
     */
    public userid: string | undefined;

    /**
     * Login name, used in URLs
     * @deprecated
     */
    public login: string | undefined;

    /**
     * Channel data directly from Twitch
     */
    public channel_data: UserData | undefined;

    public broadcaster_type: BroadcasterType = "";

    public description: string | undefined;
    public profile_image_url: string | undefined;
    public offline_image_url: string | undefined;
    /** @todo: Not implemented */
    public banner_image_url: string | undefined;

    public vods_list: TwitchVOD[] = [];

    public subbed_at: Date | undefined;
    public expires_at: Date | undefined;

    // public ?int current_duration = null;
    // public bool deactivated = false;

    public deactivated = false;

    get livestreamUrl() {
        return `https://twitch.tv/${this.internalName}`;
    }

    /**
     * Folder for the channel that stores VODs and all other data
     * 
     * @returns {string} Folder path
     */
    public getFolder(): string {
        return Helper.vodFolder(this.internalName);
    }

    public rescanVods(): string[] {
        const list = readdirSyncRecursive(this.getFolder())
            .filter(file =>
                file.endsWith(".json") &&
                fs.statSync(path.join(this.getFolder(), file)).size < 1024 * 1024
            );
        return list.map(
            p => path.relative(
                BaseConfigDataFolder.vod,
                path.join(this.getFolder(), p)
            ));
    }

    public async parseVODs(rescan = false): Promise<void> {

        /*
        this.vods_raw = fs.readdirSync(this.getFolder())
            .filter(file =>
                (
                    file.startsWith(`${this.login}_`) ||
                    file.startsWith(`${this.display_name}_`) // for backwards compatibility
                ) &&
                file.endsWith(".json") &&
                !file.endsWith("_chat.json") // bad workaround
            );
        */

        if (fs.existsSync(path.join(BaseConfigDataFolder.vods_db, `${this.internalName}.json`)) && !rescan) {
            let list: string[] = JSON.parse(fs.readFileSync(path.join(BaseConfigDataFolder.vods_db, `${this.internalName}.json`), { encoding: "utf-8" }));
            Log.logAdvanced(LOGLEVEL.DEBUG, "channel", `Found ${list.length} stored VODs in database for ${this.internalName}`);
            // console.log(list);
            list = list.filter(p => fs.existsSync(path.join(BaseConfigDataFolder.vod, p)));
            // console.log(list);
            this.vods_raw = list;
            Log.logAdvanced(LOGLEVEL.DEBUG, "channel", `Found ${this.vods_raw.length} existing VODs in database for ${this.internalName}`);
        } else {
            this.vods_raw = this.rescanVods();
            Log.logAdvanced(LOGLEVEL.INFO, "channel", `No VODs in database found for ${this.internalName}, migrate ${this.vods_raw.length} from recursive file search`);
            fs.writeFileSync(path.join(BaseConfigDataFolder.vods_db, `${this.internalName}.json`), JSON.stringify(this.vods_raw));
        }

        this.vods_list = [];

        for (const vod of this.vods_raw) {

            Log.logAdvanced(LOGLEVEL.DEBUG, "channel", `Try to parse VOD ${vod}`);

            const vod_full_path = path.join(BaseConfigDataFolder.vod, vod);

            let vodclass;

            try {
                vodclass = await TwitchVOD.load(vod_full_path);
            } catch (e) {
                Log.logAdvanced(LOGLEVEL.ERROR, "channel", `Could not load VOD ${vod}: ${(e as Error).message}`, e);
                continue;
            }

            if (!vodclass) {
                continue;
            }


            // if (vodclass.is_capturing) {
            //     $this->is_live = true;
            //     $this->current_vod = $vodclass;
            //     $this->current_game = $vodclass->getCurrentGame();
            //     $this->current_duration = $vodclass->getDurationLive() ?: null;
            // }
            // 
            // if ($vodclass->is_converting) {
            //     $this->is_converting = true;
            // }

            // if (vodclass.segments) {
            //     this.vods_size += vodclass.segments.reduce((acc, seg) => acc + (seg && seg.filesize ? seg.filesize : 0), 0);
            // }

            Log.logAdvanced(LOGLEVEL.DEBUG, "channel", `VOD ${vod} added to ${this.internalName}`);

            this.vods_list.push(vodclass);
        }
        this.sortVods();
    }

    public clearVODs(): void {
        LiveStreamDVR.getInstance().vods.forEach(v => {
            if (!(v instanceof TwitchVOD)) return;
            if (v.streamer_login !== this.login) return;
            v.stopWatching();
        });
        LiveStreamDVR.getInstance().vods = LiveStreamDVR.getInstance().vods.filter(v => v instanceof TwitchVOD && v.streamer_login !== this.login);
        this.vods_raw = [];
        this.vods_list = [];
    }

    public getSubscriptionStatus(): boolean {
        // for (const sub_type of TwitchHelper.CHANNEL_SUB_TYPES) {
        //     if (KeyValue.getInstance().get(`${this.userid}.substatus.${sub_type}`) != SubStatus.SUBSCRIBED) {
        //         return false;
        //     }
        // }
        // return true;
        return Helper.CHANNEL_SUB_TYPES.every(sub_type => KeyValue.getInstance().get(`${this.internalName}.substatus.${sub_type}`) === SubStatus.SUBSCRIBED);
    }

    public async toAPI(): Promise<ApiTwitchChannel> {

        if (!this.userid || !this.login || !this.display_name)
            console.error(chalk.red(`Channel ${this.login} is missing userid, login or display_name`));

        const vods_list = await Promise.all(this.vods_list?.map(async (vod) => await vod.toAPI()));

        return {
            uuid: this.uuid || "-1",
            provider: "twitch",
            userid: this.userid || "",
            login: this.login || "",
            display_name: this.display_name || "",
            description: this.description || "",
            profile_image_url: this.profile_image_url || "",
            offline_image_url: this.offline_image_url || "",
            banner_image_url: this.banner_image_url || "",
            broadcaster_type: this.broadcaster_type || "",
            is_live: this.is_live,
            is_capturing: this.is_capturing,
            is_converting: this.is_converting,
            current_vod: await this.current_vod?.toAPI(),
            current_game: this.current_game?.toAPI(),
            current_chapter: this.current_chapter?.toAPI(),
            // current_duration: this.current_duration,
            quality: this.quality,
            match: this.match,
            download_chat: this.download_chat,
            no_capture: this.no_capture,
            burn_chat: this.burn_chat,
            live_chat: this.live_chat,
            no_cleanup: this.no_cleanup,
            max_storage: this.max_storage,
            max_vods: this.max_vods,
            download_vod_at_end: this.download_vod_at_end,
            download_vod_at_end_quality: this.download_vod_at_end_quality,
            // subbed_at: this.subbed_at,
            // expires_at: this.expires_at,
            // last_online: this.last_online,
            vods_list: vods_list || [],
            vods_raw: this.vods_raw,
            vods_size: this.vods_size || 0,
            channel_data: this.channel_data,
            // config: this.config,
            // deactivated: this.deactivated,
            api_getSubscriptionStatus: this.getSubscriptionStatus(),

            subbed_at: this.subbed_at ? this.subbed_at.toISOString() : undefined,
            expires_at: this.expires_at ? this.expires_at.toISOString() : undefined,
            last_online: this.last_online ? this.last_online.toISOString() : undefined,
            clips_list: this.clips_list,
            video_list: this.video_list,

            current_stream_number: this.current_stream_number,
            current_season: this.current_season,

            chapter_data: this.getChapterData(),

            saves_vods: this.saves_vods,

            displayName: this.displayName,
            internalName: this.internalName,
            internalId: this.internalId,
            url: this.url,
        };
    }

    /**
     * Update and save channel config
     * 
     * @param config 
     */
    public update(config: TwitchChannelConfig): boolean {
        const i = LiveStreamDVR.getInstance().channels_config.findIndex(ch => ch.uuid === this.uuid);
        if (i !== -1) {
            this.config = config;
            this.applyConfig(config);
            Log.logAdvanced(LOGLEVEL.INFO, "channel", `Replacing channel config for ${this.internalName}`);
            LiveStreamDVR.getInstance().channels_config[i] = config;
            LiveStreamDVR.getInstance().saveChannelsConfig();
            return true;
        } else {
            Log.logAdvanced(LOGLEVEL.ERROR, "channel", `Could not update channel ${this.internalName}`);
        }
        return false;
    }

    get current_game(): TwitchGame | undefined {
        if (!this.current_vod) return undefined;
        return (this.current_vod as TwitchVOD).current_game;
    }

    get current_duration(): number | undefined {
        return this.current_vod?.duration;
    }

    /**
     * Returns true if the channel is currently live, not necessarily if it is capturing.
     * It is set when the hook is called with the channel.online event.
     * @returns {boolean}
     */
    get is_live(): boolean {
        // return this.current_vod != undefined && this.current_vod.is_capturing;
        return KeyValue.getInstance().getBool(`${this.login}.online`);
    }

    /**
     * Create an empty VOD object. This is the only method to use to create a new VOD. Do NOT use the constructor of the VOD class.
     *
     * @param filename The filename of the vod including json extension.
     * @returns Empty VOD
     */
    public async createVOD(filename: string): Promise<TwitchVOD> {

        if (!this.userid) throw new Error("Channel userid is not set");
        if (!this.login) throw new Error("Channel login is not set");
        if (!this.display_name) throw new Error("Channel display_name is not set");

        Log.logAdvanced(LOGLEVEL.INFO, "channel", `Create VOD JSON for ${this.login}: ${path.basename(filename)} @ ${path.dirname(filename)}`);

        const vod = new TwitchVOD();

        vod.created = true;
        vod.not_started = true;

        vod.filename = filename;
        vod.basename = path.basename(filename, ".json");
        vod.directory = path.dirname(filename);

        vod.streamer_name = this.display_name;
        vod.streamer_login = this.login;
        vod.streamer_id = this.userid;

        vod.created_at = new Date();

        vod.uuid = randomUUID();

        await vod.saveJSON("create json");

        // reload
        const load_vod = await TwitchVOD.load(vod.filename, true);

        // TwitchVOD.addVod(vod);
        this.vods_list.push(load_vod);
        this.sortVods();

        // add to database
        this.vods_raw.push(path.relative(BaseConfigDataFolder.vod, filename));
        fs.writeFileSync(path.join(BaseConfigDataFolder.vods_db, `${this.internalName}.json`), JSON.stringify(this.vods_raw));

        this.checkStaleVodsInMemory();

        return load_vod;

    }

    public checkStaleVodsInMemory(): void {
        if (!this.login) return;

        // const vods_on_disk = fs.readdirSync(Helper.vodFolder(this.login)).filter(f => this.login && f.startsWith(this.login) && f.endsWith(".json") && !f.endsWith("_chat.json"));
        const vods_on_disk = this.rescanVods();
        const vods_in_channel_memory = this.vods_list;
        const vods_in_main_memory = LiveStreamDVR.getInstance().vods.filter(v => v instanceof TwitchVOD && v.streamer_login === this.login);

        if (vods_on_disk.length !== vods_in_channel_memory.length) {
            Log.logAdvanced(LOGLEVEL.ERROR, "channel", `Vod on disk and vod in memory are not the same for ${this.login}`);
            const removedVods = vods_in_channel_memory.filter(v => !vods_on_disk.includes(v.basename));
            ClientBroker.notify(
                "VOD changed externally",
                `Please do not delete or rename VOD files manually.\nRemoved VODs: ${removedVods.map(v => v.basename).join(", ")}`,
                undefined,
                "system"
            );
        }

        if (vods_on_disk.length !== vods_in_main_memory.length) {
            Log.logAdvanced(LOGLEVEL.ERROR, "channel", `Vod on disk and vod in main memory are not the same for ${this.login}`);
            const removedVods = vods_in_main_memory.filter(v => !vods_on_disk.includes(v.basename));
            ClientBroker.notify(
                "VOD changed externally",
                `Please do not delete or rename VOD files manually.\nRemoved VODs: ${removedVods.map(v => v.basename).join(", ")}`,
                undefined,
                "system"
            );
        }

        if (vods_in_channel_memory.length !== vods_in_main_memory.length) {
            Log.logAdvanced(LOGLEVEL.ERROR, "channel", `Vod in memory and vod in main memory are not the same for ${this.login}`);
            const removedVods = vods_in_main_memory.filter(v => v instanceof TwitchVOD && !vods_in_channel_memory.includes(v));
            ClientBroker.notify(
                "VOD changed externally",
                `Please do not delete or rename VOD files manually.\nRemoved VODs: ${removedVods.map(v => v.basename).join(", ")}`,
                undefined,
                "system"
            );
        }

    }

    public hasVod(video_id: string): boolean {
        return this.vods_list.find(v => v.twitch_vod_id && v.twitch_vod_id === video_id) != undefined;
    }

    /**
     * Get the latest chapter data stored in cache
     * 
     * @returns {TwitchVODChapterJSON|undefined} Chapter data
     */
    public getChapterData(): TwitchVODChapterJSON | undefined {
        const cd = KeyValue.getInstance().get(`${this.login}.chapterdata`);
        return cd ? JSON.parse(cd) as TwitchVODChapterJSON : undefined;
    }

    public async updateChapterData(force = false): Promise<void> {
        if (!this.internalId) return;
        if (KeyValue.getInstance().has(`${this.internalName}.chapterdata`) && !force) return;
        const data = await TwitchChannel.getChannelDataById(this.internalId);
        if (!data) return;
        const chapter = TwitchChannel.channelDataToChapterData(data);
        KeyValue.getInstance().set(`${this.internalName}.chapterdata`, JSON.stringify(chapter));
        Log.logAdvanced(LOGLEVEL.INFO, "channel", `Updated chapter data for ${this.internalName}`);
    }

    public roundupCleanupVodCandidates(ignore_uuid = ""): TwitchVOD[] {

        let total_size = 0;
        let total_vods = 0;

        let vod_candidates: TwitchVOD[] = [];

        const max_storage = this.max_storage > 0 ? this.max_storage : Config.getInstance().cfg<number>("storage_per_streamer", 100);
        const max_vods = this.max_vods > 0 ? this.max_vods : Config.getInstance().cfg<number>("vods_to_keep", 5);

        const max_gigabytes = max_storage * 1024 * 1024 * 1024;
        // const vods_to_keep = max_vods;

        if (this.vods_list) {
            for (const vodclass of [...this.vods_list].reverse()) { // reverse so we can delete the oldest ones first

                if (!vodclass.is_finalized) {
                    Log.logAdvanced(LOGLEVEL.DEBUG, "channel", `Keeping ${vodclass.basename} due to not being finalized`);
                    continue;
                }

                if (!vodclass.uuid) {
                    Log.logAdvanced(LOGLEVEL.ERROR, "channel", `VOD ${vodclass.basename} does not have an UUID, will not remove.`);
                    continue;
                }

                if (vodclass.uuid === ignore_uuid) {
                    Log.logAdvanced(LOGLEVEL.DEBUG, "channel", `Keeping ${vodclass.basename} due to ignore_uuid '${ignore_uuid}'`);
                    continue;
                }

                if (Config.getInstance().cfg<boolean>("keep_deleted_vods") && vodclass.twitch_vod_exists === false) {
                    Log.logAdvanced(LOGLEVEL.DEBUG, "channel", `Keeping ${vodclass.basename} due to it being deleted on Twitch.`);
                    continue;
                }

                if (Config.getInstance().cfg<boolean>("keep_favourite_vods") && vodclass.hasFavouriteGame()) {
                    Log.logAdvanced(LOGLEVEL.DEBUG, "channel", `Keeping ${vodclass.basename} due to it having a favourite game.`);
                    continue;
                }

                if (Config.getInstance().cfg<boolean>("keep_muted_vods") && vodclass.twitch_vod_muted === MuteStatus.MUTED) {
                    Log.logAdvanced(LOGLEVEL.DEBUG, "channel", `Keeping ${vodclass.basename} due to it being muted on Twitch.`);
                    continue;
                }

                if (Config.getInstance().cfg<boolean>("keep_commented_vods") && (vodclass.comment !== "" && vodclass.comment !== undefined)) {
                    Log.logAdvanced(LOGLEVEL.DEBUG, "channel", `Keeping ${vodclass.basename} due to it having a comment set.`);
                    continue;
                }

                if (vodclass.prevent_deletion) {
                    Log.logAdvanced(LOGLEVEL.DEBUG, "channel", `Keeping ${vodclass.basename} due to prevent_deletion`);
                    continue;
                }

                total_size += vodclass.total_size;
                total_vods += 1;

                if (total_size > max_gigabytes) {
                    Log.logAdvanced(LOGLEVEL.DEBUG, "channel", `Adding ${vodclass.basename} to vod_candidates due to storage limit (${Helper.formatBytes(vodclass.total_size)} of current total ${Helper.formatBytes(total_size)}, limit ${Helper.formatBytes(max_gigabytes)})`);
                    vod_candidates.push(vodclass);
                }

                if (total_vods > max_vods) {
                    Log.logAdvanced(LOGLEVEL.DEBUG, "channel", `Adding ${vodclass.basename} to vod_candidates due to vod limit (${total_vods} of limit ${max_vods})`);
                    vod_candidates.push(vodclass);
                }

                if (!vod_candidates.includes(vodclass)) {
                    Log.logAdvanced(LOGLEVEL.DEBUG, "channel", `Keeping ${vodclass.basename} due to it not being over storage limit (${Helper.formatBytes(total_size)}/${Helper.formatBytes(max_gigabytes)}) and not being over vod limit (${total_vods}/${max_vods})`);
                }

            }
        }

        // remove duplicates
        vod_candidates = vod_candidates.filter((v, i, a) => a.findIndex(t => t.basename === v.basename) === i);

        Log.logAdvanced(LOGLEVEL.INFO, "channel", `Chose ${vod_candidates.length} vods to delete`, { vod_candidates: vod_candidates.map(v => v.basename) });

        return vod_candidates;

    }

    public async cleanupVods(ignore_uuid = ""): Promise<number | false> {

        if (this.no_cleanup) {
            Log.logAdvanced(LOGLEVEL.INFO, "channel", `Skipping cleanup for ${this.internalName} due to no_cleanup flag`);
            return false;
        }

        Log.logAdvanced(LOGLEVEL.INFO, "channel", `Cleanup VODs for ${this.internalName}, ignore ${ignore_uuid}`);

        const vod_candidates = this.roundupCleanupVodCandidates(ignore_uuid);

        if (vod_candidates.length === 0) {
            Log.logAdvanced(LOGLEVEL.INFO, "channel", `Not enough vods to delete for ${this.internalName}`);
            return false;
        }

        if (Config.getInstance().cfg("delete_only_one_vod")) {
            Log.logAdvanced(LOGLEVEL.INFO, "channel", `Deleting only one vod for ${this.internalName}: ${vod_candidates[0].basename}`);
            try {
                await vod_candidates[0].delete();
            } catch (error) {
                Log.logAdvanced(LOGLEVEL.ERROR, "channel", `Failed to delete ${vod_candidates[0].basename} for ${this.internalName}: ${(error as Error).message}`);
                return false;
            }
            return 1;
        } else {
            for (const vodclass of vod_candidates) {
                Log.logAdvanced(LOGLEVEL.INFO, "channel", `Cleanup delete: ${vodclass.basename}`);
                try {
                    await vodclass.delete();
                } catch (error) {
                    Log.logAdvanced(LOGLEVEL.ERROR, "channel", `Failed to delete ${vodclass.basename} for ${this.internalName}: ${(error as Error).message}`);
                }
            }
        }

        return vod_candidates.length;

    }

    /** @deprecated */
    public getUrl(): string {
        return `https://www.twitch.tv/${this.login}`;
    }

    public async findClips(): Promise<void> {
        if (!this.internalName) return;
        this.clips_list = [];

        const clips_downloader_folder = path.join(BaseConfigDataFolder.saved_clips, "downloader", this.internalName);
        const clips_downloader = fs.existsSync(clips_downloader_folder) ? fs.readdirSync(clips_downloader_folder).filter(f => f.endsWith(".mp4")).map(f => path.join(clips_downloader_folder, f)) : [];

        const clips_scheduler_folder = path.join(BaseConfigDataFolder.saved_clips, "scheduler", this.internalName);
        const clips_scheduler = fs.existsSync(clips_scheduler_folder) ? fs.readdirSync(clips_scheduler_folder).filter(f => f.endsWith(".mp4")).map(f => path.join(clips_scheduler_folder, f)) : [];

        const clips_editor_folder = path.join(BaseConfigDataFolder.saved_clips, "editor", this.internalName);
        const clips_editor = fs.existsSync(clips_editor_folder) ? fs.readdirSync(clips_editor_folder).filter(f => f.endsWith(".mp4")).map(f => path.join(clips_editor_folder, f)) : [];

        const all_clips = clips_downloader.concat(clips_scheduler).concat(clips_editor);

        for (const clip_path of all_clips) {

            let video_metadata: VideoMetadata | AudioMetadata;

            try {
                video_metadata = await Helper.videometadata(clip_path);
            } catch (error) {
                Log.logAdvanced(LOGLEVEL.ERROR, "channel", `Failed to get video metadata for clip ${clip_path}: ${(error as Error).message}`);
                continue;
            }

            if (!video_metadata || video_metadata.type !== "video") continue;

            let thumbnail;
            try {
                thumbnail = await Helper.thumbnail(clip_path, 240);
            } catch (error) {
                Log.logAdvanced(LOGLEVEL.ERROR, "channel", `Failed to generate thumbnail for ${clip_path}: ${error}`);
            }

            const clip: LocalClip = {
                folder: path.relative(BaseConfigDataFolder.saved_clips, path.dirname(clip_path)),
                basename: path.basename(clip_path),
                extension: path.extname(clip_path).substring(1),
                channel: this.internalName,
                duration: video_metadata.duration,
                size: video_metadata.size,
                video_metadata: video_metadata,
                thumbnail: thumbnail || "dummy",
            };

            this.clips_list.push(clip);

        }

        // this.clips_list = all_clips.map(f => path.relative(BaseConfigDataFolder.saved_clips, f));
        Log.logAdvanced(LOGLEVEL.DEBUG, "vodclass", `Found ${this.clips_list.length} clips for ${this.login}`);
        this.broadcastUpdate();
    }

    public async refreshData(): Promise<boolean> {
        if (!this.userid) throw new Error("Userid not set");
        Log.logAdvanced(LOGLEVEL.INFO, "vodclass", `Refreshing data for ${this.login}`);

        const channel_data = await TwitchChannel.getUserDataById(this.userid, true);

        if (channel_data) {
            this.channel_data = channel_data;
            this.userid = channel_data.id;
            this.login = channel_data.login;
            this.display_name = channel_data.display_name;
            this.profile_image_url = channel_data.profile_image_url;
            this.broadcaster_type = channel_data.broadcaster_type;
            this.description = channel_data.description;
            return true;
        }

        return false;

    }

    public saveKodiNfo(): boolean {

        if (!this.channel_data) return false;
        if (!Config.getInstance().cfg("create_kodi_nfo")) return false;
        if (!Config.getInstance().cfg("channel_folders")) return false; // only create nfo if we have channel folders

        const nfo_file = path.join(Helper.vodFolder(this.channel_data.login), "tvshow.nfo");

        let avatar;
        if (this.channel_data.cache_avatar && fs.existsSync(path.join(BaseConfigDataFolder.public_cache_avatars, this.channel_data.cache_avatar))) {
            fs.copyFileSync(
                path.join(BaseConfigDataFolder.public_cache_avatars, this.channel_data.cache_avatar),
                path.join(Helper.vodFolder(this.channel_data.login), `poster${path.extname(this.channel_data.cache_avatar)}`)
            );
            avatar = `poster${path.extname(this.channel_data.cache_avatar)}`;
        }

        let nfo_content = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n";
        nfo_content += "<tvshow>\n";
        nfo_content += `<title>${this.channel_data.display_name}</title>\n`;
        nfo_content += `<uniqueid type="twitch>${this.userid}</uniqueid>\n`;
        if (avatar) nfo_content += `<thumb aspect="poster">${avatar}</thumb>\n`;
        // nfo_content += `<thumb aspect="fanart">${this.channel_data.profile_banner_url}</thumb>\n`;
        nfo_content += `<episode>${this.vods_list.length}</episode>\n`;
        nfo_content += `<plot>${htmlentities(this.channel_data.description)}</plot>\n`;
        nfo_content += "<actor>\n";
        nfo_content += `\t<name>${this.channel_data.display_name}</name>\n`;
        nfo_content += "\t<role>Themselves</role>\n";
        nfo_content += "</actor>\n";
        nfo_content += "</tvshow>";

        fs.writeFileSync(nfo_file, nfo_content);

        return fs.existsSync(nfo_file);

    }

    public setupStreamNumber(): void {

        // set season
        if (!KeyValue.getInstance().has(`${this.internalName}.season_identifier`)) {
            KeyValue.getInstance().set(`${this.internalName}.season_identifier`, format(new Date(), Config.SeasonFormat));
            this.current_season = format(new Date(), Config.SeasonFormat);
            Log.logAdvanced(LOGLEVEL.INFO, "vodclass", `Setting season for ${this.internalName} to ${this.current_season} as it is not set`);
        } else {
            this.current_season = KeyValue.getInstance().get(`${this.internalName}.season_identifier`) as string;
        }

        // absolute season numbering, one each month that goes on forever
        if (!KeyValue.getInstance().has(`${this.internalName}.absolute_season_identifier`)) {
            KeyValue.getInstance().setInt(`${this.internalName}.absolute_season_identifier`, 1);
            KeyValue.getInstance().setInt(`${this.internalName}.absolute_season_month`, parseInt(format(new Date(), "M")));
            this.current_absolute_season = 1;
            Log.logAdvanced(LOGLEVEL.INFO, "vodclass", `Setting season for ${this.internalName} to ${this.current_season} as it is not set`);
        } else {
            this.current_absolute_season = KeyValue.getInstance().getInt(`${this.internalName}.absolute_season_identifier`);
        }

        if (KeyValue.getInstance().has(`${this.internalName}.stream_number`)) {
            this.current_stream_number = KeyValue.getInstance().getInt(`${this.internalName}.stream_number`);
        } else {
            this.current_stream_number = 1;
            Log.logAdvanced(LOGLEVEL.INFO, "vodclass", `Channel ${this.internalName} has no stream number, setting to 1`);
            KeyValue.getInstance().setInt(`${this.internalName}.stream_number`, 1);
        }
    }

    public incrementStreamNumber(): number {

        // relative season
        const seasonIdentifier = KeyValue.getInstance().get(`${this.internalName}.season_identifier`);
        if (seasonIdentifier && seasonIdentifier !== format(new Date(), Config.SeasonFormat)) {
            this.current_stream_number = 1;
            KeyValue.getInstance().setInt(`${this.internalName}.stream_number`, 1);
            KeyValue.getInstance().set(`${this.internalName}.season_identifier`, format(new Date(), Config.SeasonFormat));
            this.current_season = format(new Date(), Config.SeasonFormat);
            Log.logAdvanced(LOGLEVEL.INFO, "vodclass", `Season changed for ${this.internalName} to ${this.current_season}`);
        } else {
            this.current_stream_number += 1;
            KeyValue.getInstance().setInt(`${this.internalName}.stream_number`, this.current_stream_number);
        }

        // absolute season
        if (parseInt(format(new Date(), "M")) !== KeyValue.getInstance().getInt(`${this.internalName}.absolute_season_month`)) {
            KeyValue.getInstance().setInt(`${this.internalName}.absolute_season_month`, parseInt(format(new Date(), "M")));
            this.current_absolute_season = this.current_absolute_season ? this.current_absolute_season + 1 : 1;
            KeyValue.getInstance().setInt(`${this.internalName}.absolute_season_identifier`, this.current_absolute_season);
        }

        return this.current_stream_number;
    }

    public postLoad(): void {
        this.setupStreamNumber();
        if (!KeyValue.getInstance().has(`${this.internalName}.saves_vods`)) {
            this.checkIfChannelSavesVods();
        }
        this.addAllLocalVideos();
        this.startWatching();
    }

    /**
     * Rename a channel.
     * Resets all channels and vods.
     * 
     * @resets
     * @param new_login 
     * @returns 
     */
    public async rename(new_login: string): Promise<boolean> {

        Log.logAdvanced(LOGLEVEL.INFO, "vodclass", `Renaming channel ${this.login} to ${new_login}`);

        if (this.login === new_login) {
            throw new Error("Cannot rename channel to same name");
        }
        const old_login = this.login;
        if (!old_login) {
            throw new Error("Cannot rename channel without login");
        }

        // update config
        const channelConfigIndex = LiveStreamDVR.getInstance().channels_config.findIndex((c) => c.provider == "twitch" && c.login === old_login);
        if (channelConfigIndex !== -1) {
            (LiveStreamDVR.getInstance().channels_config[channelConfigIndex] as TwitchChannelConfig).login = new_login;
            LiveStreamDVR.getInstance().saveChannelsConfig();
        } else {
            throw new Error(`Could not find channel config for ${old_login}`);
        }

        // rename vods
        for (const vod of this.vods_list) {
            vod.changeBaseName(vod.basename.replace(old_login, new_login));
        }

        // rename channel folder
        const old_channel_folder = Helper.vodFolder(old_login);
        const new_channel_folder = Helper.vodFolder(new_login);
        if (fs.existsSync(old_channel_folder)) {
            fs.renameSync(old_channel_folder, new_channel_folder);
        }

        await Config.resetChannels();

        const newChannel = TwitchChannel.getChannelByLogin(new_login);
        if (!newChannel) {
            throw new Error("Failed to get new channel.");
        }

        newChannel.refreshData(); // refresh data for new login

        return true;

    }

    public async isLiveApi(): Promise<boolean> {
        if (!this.internalId) return false;
        const streams = await TwitchChannel.getStreams(this.internalId);
        return streams && streams.length > 0;
    }

    public async checkIfChannelSavesVods(): Promise<boolean> {
        if (!this.internalId) return false;
        Log.logAdvanced(LOGLEVEL.DEBUG, "channel", `Checking if channel ${this.internalName} saves vods`);
        const videos = await TwitchVOD.getVideos(this.internalId);
        const state = videos && videos.length > 0;
        KeyValue.getInstance().setBool(`${this.internalName}.saves_vods`, state);
        if (state) {
            Log.logAdvanced(LOGLEVEL.SUCCESS, "channel", `Channel ${this.internalName} saves vods`);
        } else {
            Log.logAdvanced(LOGLEVEL.WARNING, "channel", `Channel ${this.internalName} does not save vods`);
        }
        return state;
    }

    get saves_vods(): boolean {
        return KeyValue.getInstance().getBool(`${this.internalName}.saves_vods`);
    }

    public async downloadLatestVod(quality: VideoQuality): Promise<string> {

        if (!this.internalId) {
            throw new Error("Cannot download latest vod without userid");
        }

        const vods = await TwitchVOD.getVideos(this.internalId);

        if (!vods || vods.length === 0) {
            throw new Error("No vods found");
        }

        const latestVodData = vods[0];
        const now = new Date();
        const latestVodDate = new Date(latestVodData.created_at);
        const latestVodDuration = Helper.parseTwitchDuration(latestVodData.duration);
        const latestVodDateTotal = new Date(latestVodDate.getTime() + (latestVodDuration * 1000));
        const latestVodDateDiff = Math.abs(now.getTime() - latestVodDateTotal.getTime());

        const localVod = this.vods_list.find((v) => v.twitch_vod_id === latestVodData.id || (v.created_at?.getTime() && now.getTime() - v.created_at?.getTime() < latestVodDateDiff));
        if (localVod) {
            await localVod.downloadVod(quality);
            return localVod.path_downloaded_vod;
        }

        if (latestVodDateDiff > (1000 * 60 * 15)) {
            throw new Error(`Latest vod is older than 15 minutes (${Math.floor(latestVodDateDiff / 1000 / 60)} minutes, ${latestVodDateTotal.toISOString()})`);
        }

        const basename = `${this.login}_${latestVodData.created_at.replaceAll(":", "-")}_${latestVodData.stream_id}`;
        const file_path = path.join(Helper.vodFolder(this.login), `${basename}.${Config.getInstance().cfg("vod_container", "mp4")}`);

        let success;

        try {
            success = await TwitchVOD.downloadVideo(latestVodData.id, quality, file_path);
        } catch (e) {
            throw new Error(`Failed to download vod: ${(e as Error).message}`);
        }

        if (!success) {
            throw new Error("Failed to download vod");
        }

        const vod = await this.createVOD(path.join(Helper.vodFolder(this.login), `${basename}.json`));
        vod.started_at = parseJSON(latestVodData.created_at);

        const duration = Helper.parseTwitchDuration(latestVodData.duration);
        vod.ended_at = new Date(vod.started_at.getTime() + (duration * 1000));
        await vod.saveJSON("manual creation");

        vod.addSegment(path.basename(file_path));
        await vod.finalize();
        await vod.saveJSON("manual finalize");

        Webhook.dispatch("end_download", {
            vod: await vod.toAPI(),
        });

        return file_path;

    }

    /**
     * Get videos (shortcut for TwitchVOD.getVideos)
     */
    public async getVideos() {
        if (!this.userid) return false;
        return await TwitchVOD.getVideos(this.userid);
    }


    /**
     * Get clips (shortcut for TwitchVOD.getClips)
     */
    public async getClips(max_age?: number) {
        if (!this.userid) return false;
        return await TwitchVOD.getClips({ broadcaster_id: this.userid }, max_age);
    }

    fileWatcher?: chokidar.FSWatcher;
    public async startWatching() {
        if (this.fileWatcher) await this.stopWatching();

        // no blocks in testing
        if (process.env.NODE_ENV === "test") return;

        if (!Config.getInstance().cfg("channel_folders")) {
            Log.logAdvanced(LOGLEVEL.WARNING, "channel", `Channel folders are disabled, not watching channel ${this.login}`);
            return; // don't watch if no channel folders are enabled
        }

        const folders = [Helper.vodFolder(this.login)];

        // if (this.login && fs.existsSync(path.join(BaseConfigDataFolder.saved_clips, "scheduler", this.login)))
        //     folders.push(path.join(BaseConfigDataFolder.saved_clips, "scheduler", this.login));

        // if (this.login && fs.existsSync(path.join(BaseConfigDataFolder.saved_clips, "downloader", this.login)))
        //     folders.push(path.join(BaseConfigDataFolder.saved_clips, "downloader", this.login));

        console.log(`Watching channel ${this.login} folders...`);

        this.fileWatcher = chokidar.watch(folders, {
            ignoreInitial: true,
        }).on("all", (eventType, filename) => {

            if (eventType === "add") {

                if (Config.getInstance().cfg("localvideos.enabled")) {

                    const allVodFiles = this.vods_list.map((v) => v.associatedFiles.map((f) => path.basename(f))).flat();

                    if (allVodFiles.includes(filename)) {
                        return; // skip actual vods
                    }

                    if (!filename.endsWith(".mp4")) return;

                    if (eventType === "add") {
                        this.addLocalVideo(path.basename(filename));
                    }

                }

            } else if (eventType === "unlink") {
                this.video_list = this.video_list.filter((v) => v.basename !== path.basename(filename));
                this.sortLocalVideos();
                this.broadcastUpdate();
            }

        });
    }

    private async addLocalVideo(basename: string): Promise<boolean> {

        const filename = path.join(Helper.vodFolder(this.login), basename);

        let video_metadata: VideoMetadata | AudioMetadata;

        try {
            video_metadata = await Helper.videometadata(filename);
        } catch (th) {
            Log.logAdvanced(LOGLEVEL.ERROR, "channel", `Trying to get mediainfo of ${filename} returned: ${(th as Error).message}`);
            return false;
        }

        if (!video_metadata || video_metadata.type !== "video") {
            Log.logAdvanced(LOGLEVEL.WARNING, "channel", `${filename} is not a local video, not adding`);
            return false;
        }

        let thumbnail;
        try {
            thumbnail = await Helper.thumbnail(filename, 240);
        } catch (error) {
            Log.logAdvanced(LOGLEVEL.ERROR, "channel", `Failed to generate thumbnail for ${filename}: ${error}`);
        }

        const video_entry: LocalVideo = {
            basename: basename,
            extension: path.extname(filename).substring(1),
            channel: this.login,
            duration: video_metadata.duration,
            size: video_metadata.size,
            video_metadata: video_metadata,
            thumbnail: thumbnail ? path.basename(thumbnail) : undefined,
        };

        this.video_list.push(video_entry);

        this.sortLocalVideos();

        this.broadcastUpdate();

        return true;

    }

    private sortLocalVideos() {
        this.video_list.sort((a, b) => {
            return a.basename.localeCompare(b.basename);
        });
    }

    private addAllLocalVideos() {
        if (!Config.getInstance().cfg("channel_folders")) return; // don't watch if no channel folders are enabled
        if (!Config.getInstance().cfg("localvideos.enabled")) return;
        const folder = Helper.vodFolder(this.login);
        const files = fs.readdirSync(folder);
        const allVodFiles = this.vods_list.map((v) => v.associatedFiles.map((f) => path.basename(f))).flat();
        for (const file of files) {
            if (!file.endsWith(".mp4")) continue;
            if (allVodFiles.includes(path.basename(file))) continue;
            console.debug(`Adding local video ${file} for channel ${this.login}`);
            this.addLocalVideo(path.basename(file));
        }
        console.log(`Added ${this.video_list.length} local videos to ${this.login}`);
    }

    /**
     * 
     * STATIC
     * 
     */

    public static async loadAbstract(channel_id: string): Promise<TwitchChannel> {

        Log.logAdvanced(LOGLEVEL.DEBUG, "channel", `Load channel ${channel_id}`);

        const channel_memory = LiveStreamDVR.getInstance().channels.find<TwitchChannel>((channel): channel is TwitchChannel => channel instanceof TwitchChannel && channel.userid === channel_id);
        if (channel_memory) {
            Log.logAdvanced(LOGLEVEL.WARNING, "channel", `Channel ${channel_id} already loaded`);
            return channel_memory;
        }

        const channel = new this();
        channel.userid = channel_id;

        const channel_data = await this.getUserDataById(channel_id);
        if (!channel_data) throw new Error(`Could not get channel data for channel id: ${channel_id}`);

        const channel_login = channel_data.login;

        const channel_config = LiveStreamDVR.getInstance().channels_config.find(c => c.provider == "twitch" && c.login === channel_login);
        if (!channel_config) throw new Error(`Could not find channel config in memory for channel login: ${channel_login}`);

        channel.uuid = channel_config.uuid;
        channel.channel_data = channel_data;
        channel.config = channel_config;

        channel.login = channel_data.login;
        channel.display_name = channel_data.display_name;
        channel.description = channel_data.description;
        channel.profile_image_url = channel_data.profile_image_url;
        channel.broadcaster_type = channel_data.broadcaster_type;
        channel.applyConfig(channel_config);

        if (KeyValue.getInstance().getBool(`${channel.login}.online`)) {
            Log.logAdvanced(LOGLEVEL.WARNING, "channel", `Channel ${channel.login} is online, stale?`);
        }

        if (KeyValue.getInstance().get(`${channel.login}.channeldata`)) {
            Log.logAdvanced(LOGLEVEL.WARNING, "channel", `Channel ${channel.login} has stale chapter data.`);
        }

        /*
            $subfile = TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . "subs.json";
            if (file_exists($subfile)) {
                $sub_data = json_decode(file_get_contents($subfile), true);
                if (isset($sub_data[$channel->display_name])) {
                    if (isset($sub_data[$channel->display_name]['subbed_at']))
                        $channel->subbed_at = \DateTime::createFromFormat(TwitchHelper::DATE_FORMAT, $sub_data[$channel->display_name]['subbed_at']);

                    if (isset($sub_data[$channel->display_name]['expires_at']))
                        $channel->expires_at = \DateTime::createFromFormat(TwitchHelper::DATE_FORMAT, $sub_data[$channel->display_name]['expires_at']);
                }
            }
        */

        // $channel->api_getSubscriptionStatus = $channel->getSubscriptionStatus();

        if (Config.getInstance().cfg("channel_folders") && !fs.existsSync(channel.getFolder())) {
            fs.mkdirSync(channel.getFolder());
        }

        // only needed if i implement watching
        // if (!fs.existsSync(path.join(BaseConfigDataFolder.saved_clips, "scheduler", channel.login)))
        //     fs.mkdirSync(path.join(BaseConfigDataFolder.saved_clips, "scheduler", channel.login), { recursive: true });
        // 
        // if (!fs.existsSync(path.join(BaseConfigDataFolder.saved_clips, "downloader", channel.login)))
        //     fs.mkdirSync(path.join(BaseConfigDataFolder.saved_clips, "downloader", channel.login), { recursive: true });
        // 
        // if (!fs.existsSync(path.join(BaseConfigDataFolder.saved_clips, "editor", channel.login)))
        //     fs.mkdirSync(path.join(BaseConfigDataFolder.saved_clips, "editor", channel.login), { recursive: true });

        await channel.parseVODs();

        await channel.findClips();

        channel.saveKodiNfo();

        try {
            await channel.updateChapterData();
        } catch (error) {
            Log.logAdvanced(LOGLEVEL.ERROR, "channel", `Failed to update chapter data for channel ${channel.login}: ${(error as Error).message}`);
        }

        return channel;

    }

    /**
     * Create and insert channel in memory. Subscribe too.
     * 
     * @param config
     * @returns 
     */
    public static async create(config: TwitchChannelConfig): Promise<TwitchChannel> {

        const exists_config = LiveStreamDVR.getInstance().channels_config.find(ch => ch.provider == "twitch" && ch.login === config.login);
        if (exists_config) throw new Error(`Channel ${config.login} already exists in config`);

        // const exists_channel = TwitchChannel.channels.find(ch => ch.login === config.login);
        const exists_channel = LiveStreamDVR.getInstance().channels.find<TwitchChannel>((channel): channel is TwitchChannel => channel instanceof TwitchChannel && channel.login === config.login);
        if (exists_channel) throw new Error(`Channel ${config.login} already exists in channels`);

        const data = await TwitchChannel.getUserDataByLogin(config.login);
        if (!data) throw new Error(`Could not get channel data for channel login: ${config.login}`);

        config.uuid = randomUUID();

        LiveStreamDVR.getInstance().channels_config.push(config);
        LiveStreamDVR.getInstance().saveChannelsConfig();

        const channel = await TwitchChannel.loadFromLogin(config.login);
        if (!channel || !channel.userid) throw new Error(`Channel ${config.login} could not be loaded`);

        if (
            Config.getInstance().cfg<string>("app_url", "") !== "" &&
            Config.getInstance().cfg<string>("app_url", "") !== "debug" &&
            !Config.getInstance().cfg<boolean>("isolated_mode")
        ) {
            try {
                await TwitchChannel.subscribe(channel.userid);
            } catch (error) {
                Log.logAdvanced(LOGLEVEL.ERROR, "channel", `Failed to subscribe to channel ${channel.login}: ${(error as Error).message}`);
                LiveStreamDVR.getInstance().channels_config = LiveStreamDVR.getInstance().channels_config.filter(ch => ch.provider == "twitch" && ch.login !== config.login); // remove channel from config
                LiveStreamDVR.getInstance().saveChannelsConfig();
                // throw new Error(`Failed to subscribe to channel ${channel.login}: ${(error as Error).message}`, { cause: error });
                throw error; // rethrow error
            }
        } else if (Config.getInstance().cfg("app_url") == "debug") {
            Log.logAdvanced(LOGLEVEL.WARNING, "channel", `Not subscribing to ${channel.internalName} due to debug app_url.`);
        } else if (Config.getInstance().cfg("isolated_mode")) {
            Log.logAdvanced(LOGLEVEL.WARNING, "channel", `Not subscribing to ${channel.internalName} due to isolated mode.`);
        } else {
            Log.logAdvanced(LOGLEVEL.ERROR, "channel", `Can't subscribe to ${channel.internalName} due to either no app_url or isolated mode disabled.`);
            LiveStreamDVR.getInstance().channels_config = LiveStreamDVR.getInstance().channels_config.filter(ch => ch.provider == "twitch" && ch.login !== config.login); // remove channel from config
            LiveStreamDVR.getInstance().saveChannelsConfig();
            throw new Error("Can't subscribe due to either no app_url or isolated mode disabled.");
        }

        LiveStreamDVR.getInstance().channels.push(channel);

        if (Helper.axios) { // bad hack?
            const streams = await TwitchChannel.getStreams(channel.internalId);
            if (streams && streams.length > 0) {
                KeyValue.getInstance().setBool(`${channel.internalName}.online`, true);
            }
        }

        return channel;
    }

    /**
     * Load channel config into memory, not the channels themselves.
     */
    /*
    public static loadChannelsConfig(): boolean {

        if (!fs.existsSync(BaseConfigPath.channel)) {
            return false;
        }

        Log.logAdvanced(LOGLEVEL.INFO, "channel", "Loading channel configs...");

        const data: ChannelConfig[] = JSON.parse(fs.readFileSync(BaseConfigPath.channel, "utf8"));

        let needsSave = false;
        for (const channel of data) {
            if (!("quality" in channel) || !channel.quality) {
                Log.logAdvanced(LOGLEVEL.WARNING, "channel", `Channel ${channel.login} has no quality set, setting to default`);
                channel.quality = ["best"];
                needsSave = true;
            }
        }

        this.channels_config = data;

        Log.logAdvanced(LOGLEVEL.SUCCESS, "channel", `Loaded ${this.channels_config.length} channel configs!`);

        if (needsSave) {
            this.saveChannelsConfig();
        }

        if (Config.getInstance().cfg("channel_folders")) {
            const folders = fs.readdirSync(BaseConfigDataFolder.vod);
            for (const folder of folders) {
                if (folder == ".gitkeep") continue;
                if (!this.channels_config.find(ch => ch.login === folder)) {
                    Log.logAdvanced(LOGLEVEL.WARNING, "channel", `Channel folder ${folder} is not in channel config, left over?`);
                }
            }
        }

        return true;

    }
    */

    // public static saveChannelsConfig(): boolean {
    //     Log.logAdvanced(LOGLEVEL.INFO, "channel", "Saving channel config");
    //     fs.writeFileSync(BaseConfigPath.channel, JSON.stringify(this.channels_config, null, 4));
    //     return fs.existsSync(BaseConfigPath.channel) && fs.readFileSync(BaseConfigPath.channel, "utf8") === JSON.stringify(this.channels_config, null, 4);
    // }

    /**
     * Load channel cache into memory, like usernames and id's.
     */
    public static loadChannelsCache(): boolean {
        if (!fs.existsSync(BaseConfigPath.streamerCache)) return false;

        const data = fs.readFileSync(BaseConfigPath.streamerCache, "utf8");
        this.channels_cache = JSON.parse(data);
        Log.logAdvanced(LOGLEVEL.SUCCESS, "channel", `Loaded ${Object.keys(this.channels_cache).length} channels from cache.`);
        return true;
    }

    /**
     * Load channels into memory
     * 
     * @returns Amount of loaded channels
     */
    /*
    public static async loadChannels(): Promise<number> {
        Log.logAdvanced(LOGLEVEL.INFO, "channel", "Loading channels...");
        if (this.channels_config.length > 0) {
            for (const channel of this.channels_config) {

                let ch: TwitchChannel;

                try {
                    ch = await TwitchChannel.loadFromLogin(channel.login);
                } catch (th) {
                    Log.logAdvanced(LOGLEVEL.FATAL, "config", `Channel ${channel.login} could not be loaded: ${th}`);
                    continue;
                    // break;
                }

                if (ch) {
                    this.channels.push(ch);
                    ch.postLoad();
                    ch.vods_list.forEach(vod => vod.postLoad());
                    Log.logAdvanced(LOGLEVEL.SUCCESS, "config", `Loaded channel ${channel.login} with ${ch.vods_list?.length} vods`);
                    if (ch.no_capture) {
                        Log.logAdvanced(LOGLEVEL.WARNING, "config", `Channel ${channel.login} is configured to not capture streams.`);
                    }
                } else {
                    Log.logAdvanced(LOGLEVEL.FATAL, "config", `Channel ${channel.login} could not be added, please check logs.`);
                    break;
                }
            }
        }
        Log.logAdvanced(LOGLEVEL.SUCCESS, "channel", `Loaded ${this.channels.length} channels!`);
        return this.channels.length;
    }
    */

    public static getChannels(): TwitchChannel[] {
        // return this.channels;
        return LiveStreamDVR.getInstance().channels.filter<TwitchChannel>((channel): channel is TwitchChannel => channel instanceof TwitchChannel) || [];
    }

    public static isType(channel: any): channel is TwitchChannel {
        return channel instanceof TwitchChannel;
    }

    /**
     * Fetch channel class object from memory by channel login.
     * This is the main function to get a channel object.
     * If it does not exist, undefined is returned.
     * It does not fetch the channel data from the API or create it.
     * 
     * @param {string} login 
     * @returns {TwitchChannel} Channel object
     */
    public static getChannelByLogin(login: string): TwitchChannel | undefined {
        return LiveStreamDVR.getInstance().channels.find<TwitchChannel>((ch): ch is TwitchChannel => ch instanceof TwitchChannel && ch.login === login);
    }

    public static async getStreams(streamer_id: string): Promise<Stream[] | false> {
        let response;

        if (!Helper.axios) {
            throw new Error("Axios is not initialized");
        }

        try {
            response = await Helper.axios.get(`/helix/streams?user_id=${streamer_id}`);
        } catch (error) {
            Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Could not get streams for ${streamer_id}: ${error}`);
            return false;
        }

        const json: StreamsResponse = response.data;

        if (!json.data) {
            Log.logAdvanced(LOGLEVEL.ERROR, "helper", `No streams found for user id ${streamer_id}`);
            return false;
        }

        Log.logAdvanced(LOGLEVEL.INFO, "helper", `Querying streams for streamer id ${streamer_id}`);

        return json.data ?? false;
    }

    /**
     * Load channel class using login, don't call this. Used internally.
     * 
     * @internal
     * @param login 
     * @param api 
     * @returns 
     */
    public static async loadFromLogin(login: string): Promise<TwitchChannel> {
        if (!login) throw new Error("Streamer login is empty");
        if (typeof login !== "string") throw new TypeError("Streamer login is not a string");
        Log.logAdvanced(LOGLEVEL.DEBUG, "channel", `Load from login ${login}`);
        const channel_id = await this.channelIdFromLogin(login);
        if (!channel_id) throw new Error(`Could not get channel id from login: ${login}`);
        return this.loadAbstract(channel_id); // $channel;
    }

    public static async channelIdFromLogin(login: string): Promise<string | false> {
        const channelData = await this.getUserDataByLogin(login, false);
        return channelData ? channelData.id : false;
    }

    public static async channelLoginFromId(channel_id: string): Promise<string | false> {
        const channelData = await this.getUserDataById(channel_id, false);
        return channelData ? channelData.login : false;
    }

    public static async channelDisplayNameFromId(channel_id: string): Promise<string | false> {
        const channelData = await this.getUserDataById(channel_id, false);
        return channelData ? channelData.display_name : false;
    }

    /**
     * Get user data using the channel id (numeric in string form)
     * @param channel_id 
     * @param force 
     * @throws
     * @returns 
     */
    public static async getUserDataById(channel_id: string, force = false): Promise<UserData | false> {
        return await this.getUserDataProxy("id", channel_id, force);
    }

    /**
     * Get user data using the channel login, not the display name
     * @param login 
     * @param force 
     * @throws
     * @returns 
     */
    public static async getUserDataByLogin(login: string, force = false): Promise<UserData | false> {
        return await this.getUserDataProxy("login", login, force);
    }

    /**
     * Get user data from api using either id or login, a helper
     * function for getChannelDataById and getChannelDataByLogin.
     * 
     * @internal
     * @param method Either "id" or "login"
     * @param identifier Either channel id or channel login
     * @param force 
     * @throws
     * @returns 
     */
    static async getUserDataProxy(method: "id" | "login", identifier: string, force: boolean): Promise<UserData | false> {

        Log.logAdvanced(LOGLEVEL.DEBUG, "channel", `Fetching user data for ${method} ${identifier}, force: ${force}`);

        // check cache first
        if (!force) {
            const channelData = method == "id" ? this.channels_cache[identifier] : Object.values(this.channels_cache).find(channel => channel.login == identifier);
            if (channelData) {
                Log.logAdvanced(LOGLEVEL.DEBUG, "channel", `User data found in memory cache for ${method} ${identifier}`);
                if (Date.now() > channelData._updated + Config.streamerCacheTime) {
                    Log.logAdvanced(LOGLEVEL.INFO, "helper", `Memory cache for ${identifier} is outdated, fetching new data`);
                } else {
                    Log.logAdvanced(LOGLEVEL.DEBUG, "channel", `Returning memory cache for ${method} ${identifier}`);
                    return channelData;
                }
            } else {
                Log.logAdvanced(LOGLEVEL.DEBUG, "channel", `User data not found in memory cache for ${method} ${identifier}, continue fetching`);
            }

            if (KeyValue.getInstance().get(`${identifier}.deleted`)) {
                Log.logAdvanced(LOGLEVEL.WARNING, "helper", `Channel ${identifier} is deleted, ignore. Delete kv file to force update.`);
                return false;
            }
        }

        const access_token = await Helper.getAccessToken();

        if (!access_token) {
            Log.logAdvanced(LOGLEVEL.ERROR, "helper", "Could not get access token, aborting.");
            throw new Error("Could not get access token, aborting.");
        }

        if (!Helper.axios) {
            throw new Error("Axios is not initialized");
        }

        let response;

        try {
            response = await Helper.axios.get(`/helix/users?${method}=${identifier}`);
        } catch (err) {
            if (axios.isAxiosError(err)) {
                // Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Could not get channel data for ${method} ${identifier}: ${err.message} / ${err.response?.data.message}`, err);
                // return false;
                if (err.response && err.response.status === 404) {
                    // throw new Error(`Could not find channel data for ${method} ${identifier}, server responded with 404`);
                    Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Could not find user data for ${method} ${identifier}, server responded with 404`);
                    return false;
                }
                throw new Error(`Could not get user data for ${method} ${identifier} axios error: ${(err as Error).message}`);
            }

            Log.logAdvanced(LOGLEVEL.ERROR, "helper", `User data request for ${identifier} exceptioned: ${err}`, err);
            console.log(err);
            return false;
        }

        // TwitchLog.logAdvanced(LOGLEVEL.INFO, "helper", `URL: ${response.request.path} (default ${axios.defaults.baseURL})`);

        if (response.status !== 200) {
            Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Could not get user data for ${identifier}, code ${response.status}.`);
            throw new Error(`Could not get user data for ${identifier}, code ${response.status}.`);
        }

        const json: UsersResponse | ErrorResponse = response.data;

        if ("error" in json) {
            Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Could not get user data for ${identifier}: ${json.message}`);
            return false;
        }

        if (json.data.length === 0) {
            Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Could not get user data for ${identifier}, no data.`, { json });
            throw new Error(`Could not get user data for ${identifier}, no data.`);
        }

        const data = json.data[0];

        // use as ChannelData
        const userData = data as unknown as UserData;

        userData._updated = Date.now();

        // download channel logo
        if (userData.profile_image_url) {
            const logo_filename = `${userData.id}${path.extname(userData.profile_image_url)}`;
            const logo_path = path.join(BaseConfigDataFolder.public_cache_avatars, logo_filename);
            if (fs.existsSync(logo_path)) {
                fs.unlinkSync(logo_path);
            }
            let avatar_response;
            try {
                avatar_response = await axios({
                    url: userData.profile_image_url,
                    method: "GET",
                    responseType: "stream",
                });
            } catch (error) {
                Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Could not download user logo for ${userData.id}: ${(error as Error).message}`, error);
            }
            if (avatar_response) {
                avatar_response.data.pipe(fs.createWriteStream(logo_path));
                userData.cache_avatar = logo_filename;
            }
        }

        if (userData.offline_image_url) {
            const offline_filename = `${userData.id}${path.extname(userData.offline_image_url)}`;
            const offline_path = path.join(BaseConfigDataFolder.public_cache_banners, offline_filename);
            if (fs.existsSync(offline_path)) {
                fs.unlinkSync(offline_path);
            }
            let offline_response;
            try {
                offline_response = await axios({
                    url: userData.offline_image_url,
                    method: "GET",
                    responseType: "stream",
                });
            } catch (error) {
                Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Could not download user offline image for ${userData.id}: ${(error as Error).message}`, error);
            }
            if (offline_response) {
                offline_response.data.pipe(fs.createWriteStream(offline_path));
                userData.cache_offline_image = offline_filename;
            }
        }

        // insert into memory and save to file
        console.debug(`Inserting user data for ${method} ${identifier} into cache and file`);
        TwitchChannel.channels_cache[userData.id] = userData;
        fs.writeFileSync(BaseConfigPath.streamerCache, JSON.stringify(TwitchChannel.channels_cache));

        return userData;

    }

    /**
     * Get channel data from api using either id or login, a helper
     * function for getChannelDataById and getChannelDataByLogin.
     * 
     * @internal
     * @param method Either "id" or "login"
     * @param identifier Either channel id or channel login
     * @param force 
     * @throws
     * @returns 
     */
    static async getChannelDataById(broadcaster_id: string): Promise<Channel | false> {

        Log.logAdvanced(LOGLEVEL.DEBUG, "channel", `Fetching channel data for ${broadcaster_id}`);

        const access_token = await Helper.getAccessToken();

        if (!access_token) {
            Log.logAdvanced(LOGLEVEL.ERROR, "helper", "Could not get access token, aborting.");
            throw new Error("Could not get access token, aborting.");
        }

        if (!Helper.axios) {
            throw new Error("Axios is not initialized");
        }

        let response;

        try {
            response = await Helper.axios.get(`/helix/channels?broadcaster_id=${broadcaster_id}`);
        } catch (err) {
            if (axios.isAxiosError(err)) {
                // Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Could not get channel data for ${method} ${identifier}: ${err.message} / ${err.response?.data.message}`, err);
                // return false;
                if (err.response && err.response.status === 404) {
                    // throw new Error(`Could not find channel data for ${method} ${identifier}, server responded with 404`);
                    Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Could not find user data for ${broadcaster_id}, server responded with 404`);
                    return false;
                }
                throw new Error(`Could not get user data for ${broadcaster_id} axios error: ${(err as Error).message}`);
            }

            Log.logAdvanced(LOGLEVEL.ERROR, "helper", `User data request for ${broadcaster_id} exceptioned: ${err}`, err);
            console.log(err);
            return false;
        }

        // TwitchLog.logAdvanced(LOGLEVEL.INFO, "helper", `URL: ${response.request.path} (default ${axios.defaults.baseURL})`);

        if (response.status !== 200) {
            Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Could not get user data for ${broadcaster_id}, code ${response.status}.`);
            throw new Error(`Could not get user data for ${broadcaster_id}, code ${response.status}.`);
        }

        const json: ChannelsResponse | ErrorResponse = response.data;

        if ("error" in json) {
            Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Could not get user data for ${broadcaster_id}: ${json.message}`);
            return false;
        }

        if (json.data.length === 0) {
            Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Could not get user data for ${broadcaster_id}, no data.`, { json });
            throw new Error(`Could not get user data for ${broadcaster_id}, no data.`);
        }

        const data = json.data[0];

        // use as ChannelData
        // const channelData = data as unknown as ChannelData;

        return data;

    }

    public static channelDataToChapterData(channelData: Channel): TwitchVODChapterJSON {
        const game = channelData.game_id ? TwitchGame.getGameFromCache(channelData.game_id) : undefined;
        const chapterData: TwitchVODChapterJSON = {
            started_at: JSON.stringify(new Date()),
            title: channelData.title,

            game_id: channelData.game_id,
            game_name: channelData.game_name,
            box_art_url: game ? game.box_art_url : undefined,

            is_mature: false,
            online: false,
            // viewer_count: 
        };
        return chapterData;
    }

    public static async subscribe(channel_id: string, force = false): Promise<boolean> {

        if (!Config.getInstance().cfg("app_url")) {
            throw new Error("app_url is not set");
        }

        if (Config.getInstance().cfg("app_url") === "debug") {
            throw new Error("app_url is set to debug, no subscriptions possible");
        }

        let hook_callback = `${Config.getInstance().cfg("app_url")}/api/v0/hook/twitch`;

        if (Config.getInstance().cfg("instance_id")) {
            hook_callback += "?instance=" + Config.getInstance().cfg("instance_id");
        }

        if (!Config.getInstance().cfg("eventsub_secret")) {
            throw new Error("eventsub_secret is not set");
        }

        const streamer_login = await TwitchChannel.channelLoginFromId(channel_id);

        for (const sub_type of Helper.CHANNEL_SUB_TYPES) {

            if (KeyValue.getInstance().get(`${channel_id}.sub.${sub_type}`) && !force) {
                Log.logAdvanced(LOGLEVEL.INFO, "helper", `Skip subscription to ${channel_id}:${sub_type} (${streamer_login}), in cache.`);
                continue; // todo: alert
            }

            Log.logAdvanced(LOGLEVEL.INFO, "helper", `Subscribe to ${channel_id}:${sub_type} (${streamer_login})`);

            const payload: SubscriptionRequest = {
                type: sub_type,
                version: "1",
                condition: {
                    broadcaster_user_id: channel_id,
                },
                transport: {
                    method: "webhook",
                    callback: hook_callback,
                    secret: Config.getInstance().cfg("eventsub_secret"),
                },
            };

            if (!Helper.axios) {
                throw new Error("Axios is not initialized");
            }

            let response;

            try {
                response = await Helper.axios.post("/helix/eventsub/subscriptions", payload);
            } catch (err) {
                if (axios.isAxiosError(err)) {
                    Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Could not subscribe to ${channel_id}:${sub_type}: ${err.message} / ${err.response?.data.message}`);

                    if (err.response?.data.status == 409) { // duplicate
                        const sub_id = await TwitchChannel.getSubscriptionId(channel_id, sub_type);
                        if (sub_id) {
                            KeyValue.getInstance().set(`${channel_id}.sub.${sub_type}`, sub_id);
                            KeyValue.getInstance().set(`${channel_id}.substatus.${sub_type}`, SubStatus.SUBSCRIBED);
                        }
                        continue;
                    }

                    continue;
                }

                Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Subscription request for ${channel_id} exceptioned: ${err}`);
                console.log(err);
                continue;
            }

            const json: SubscriptionResponse = response.data;
            const http_code = response.status;

            if (http_code == 202) {

                if (json.data[0].status !== "webhook_callback_verification_pending") {
                    Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Got 202 return for subscription request for ${channel_id}:${sub_type} but did not get callback verification.`);
                    return false;
                    // continue;
                }

                KeyValue.getInstance().set(`${channel_id}.sub.${sub_type}`, json.data[0].id);
                KeyValue.getInstance().set(`${channel_id}.substatus.${sub_type}`, SubStatus.WAITING);

                Log.logAdvanced(LOGLEVEL.SUCCESS, "helper", `Subscribe for ${channel_id}:${sub_type} (${streamer_login}) sent. Check logs for a 'subscription active' message.`);
            } else if (http_code == 409) {
                Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Duplicate sub for ${channel_id}:${sub_type} detected.`);
            } else {
                Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Failed to send subscription request for ${channel_id}:${sub_type}: ${json}, HTTP ${http_code})`);
                return false;
                // continue;
            }

        }

        return true;

    }

    public static async unsubscribe(channel_id: string): Promise<boolean> {

        const subscriptions = await Helper.getSubsList();

        if (!subscriptions) {
            return false;
        }

        const streamer_login = await TwitchChannel.channelLoginFromId(channel_id);

        let unsubbed = 0;
        for (const sub of subscriptions) {

            if (sub.condition.broadcaster_user_id !== channel_id) {
                continue;
            }

            const unsub = await Helper.eventSubUnsubscribe(sub.id);

            if (unsub) {
                Log.logAdvanced(LOGLEVEL.SUCCESS, "helper", `Unsubscribed from ${channel_id}:${sub.type} (${streamer_login})`);
                unsubbed++;
                KeyValue.getInstance().delete(`${channel_id}.sub.${sub.type}`);
                KeyValue.getInstance().delete(`${channel_id}.substatus.${sub.type}`);
            } else {
                Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Failed to unsubscribe from ${channel_id}:${sub.type} (${streamer_login})`);
            }

        }

        return unsubbed === subscriptions.length;

    }

    public static async getSubscriptionId(channel_id: string, sub_type: EventSubTypes): Promise<string | false> {
        const all_subs = await Helper.getSubsList();
        if (all_subs) {
            const sub_id = all_subs.find(sub => sub.condition.broadcaster_user_id == channel_id && sub.type == sub_type);
            return sub_id ? sub_id.id : false;
        } else {
            return false;
        }
    }

    public static startChatDump(name: string, channel_login: string, channel_id: string, started: Date, output: string): Job | false {

        const chat_bin = Helper.path_node();
        const chat_cmd: string[] = [];
        const jsfile = path.join(AppRoot, "twitch-chat-dumper", "build", "index.js");

        if (!fs.existsSync(jsfile)) {
            throw new Error("Could not find chat dumper build");
        }

        if (!chat_bin) {
            throw new Error("Could not find Node binary");
        }

        // todo: execute directly in node?
        chat_cmd.push(jsfile);
        chat_cmd.push("--channel", channel_login);
        chat_cmd.push("--userid", channel_id);
        chat_cmd.push("--date", JSON.stringify(started));
        chat_cmd.push("--output", output);
        if (Config.getInstance().cfg("chatdump_notext")) {
            chat_cmd.push("--notext"); // don't output plain text chat
        }

        Log.logAdvanced(LOGLEVEL.INFO, "channel", `Starting chat dump with filename ${path.basename(output)}`);

        const chat_job = Helper.startJob(`chatdump_${name}`, chat_bin, chat_cmd);

        return chat_job;

    }

    get current_vod(): TwitchVOD | undefined {
        return this.vods_list?.find(vod => vod.is_capturing);
    }

    get latest_vod(): TwitchVOD | undefined {
        if (!this.vods_list || this.vods_list.length == 0) return undefined;
        return this.vods_list[this.vods_list.length - 1]; // is this reliable?
    }

    get displayName(): string {
        return this.channel_data?.display_name || "";
    }

    get internalName(): string {
        return this.channel_data?.login || "";
    }

    get internalId(): string {
        return this.channel_data?.id || "";
    }

    get url(): string {
        return `https://twitch.tv/${this.internalName}`;
    }
    
}