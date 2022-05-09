import axios from "axios";
import chalk from "chalk";
import { format } from "date-fns";
import fs from "fs";
import { encode as htmlentities } from "html-entities";
import path from "path";
import { TwitchVODChapterJSON } from "Storage/JSON";
import type { ApiChannel } from "../../../common/Api/Client";
import type { ChannelData } from "../../../common/Channel";
import { ChannelConfig, VideoQuality } from "../../../common/Config";
import { MuteStatus, SubStatus } from "../../../common/Defs";
import type { ErrorResponse, EventSubTypes } from "../../../common/TwitchAPI/Shared";
import type { Stream, StreamsResponse } from "../../../common/TwitchAPI/Streams";
import type { SubscriptionRequest, SubscriptionResponse } from "../../../common/TwitchAPI/Subscriptions";
import type { BroadcasterType, UsersResponse } from "../../../common/TwitchAPI/Users";
import { ChannelUpdated } from "../../../common/Webhook";
import { AppRoot, BaseConfigDataFolder, BaseConfigPath } from "./BaseConfig";
import { Config } from "./Config";
import { Helper } from "./Helper";
import { Job } from "./Job";
import { KeyValue } from "./KeyValue";
import { Log, LOGLEVEL } from "./Log";
import { TwitchGame } from "./TwitchGame";
import { TwitchVOD } from "./TwitchVOD";
import { TwitchVODChapter } from "./TwitchVODChapter";
import { Webhook } from "./Webhook";

export class TwitchChannel {

    static channels: TwitchChannel[] = [];
    static channels_config: ChannelConfig[] = [];
    static channels_cache: Record<string, ChannelData> = {};

    /**
     * User ID
     */
    public userid: string | undefined;

    /**
     * Login name, used in URLs
     */
    public login: string | undefined;

    /**
     * Channel data directly from Twitch
     */
    public channel_data: ChannelData | undefined;

    /**
     * Channel config from config file
     */
    public config: ChannelConfig | undefined;

    /**
     * Display name used in chats and profile pages.
     */
    public display_name: string | undefined;

    public broadcaster_type: BroadcasterType = "";

    public description: string | undefined;
    public profile_image_url: string | undefined;
    public quality: VideoQuality[] | undefined;
    public match: string[] | undefined;
    public download_chat = false;

    /** Capture chat live */
    public live_chat = false;

    /** Don't capture, just exist */
    public no_capture = false;

    /** 
     * Burn chat after capturing.
     * Currently not used.
     */
    public burn_chat = false;

    public vods_raw: string[] = [];
    public vods_list: TwitchVOD[] = [];

    public clips_list: string[] = [];

    public subbed_at: Date | undefined;
    public expires_at: Date | undefined;
    public last_online: Date | undefined;

    // public ?int current_duration = null;
    // public bool deactivated = false;

    public deactivated = false;

    public current_stream_number = 0;
    public current_season = "";

    private _updateTimer: NodeJS.Timeout | undefined;

    applyConfig(channel_config: ChannelConfig): void {
        this.quality = channel_config.quality !== undefined ? channel_config.quality : ["best"];
        this.match = channel_config.match !== undefined ? channel_config.match : [];
        this.download_chat = channel_config.download_chat !== undefined ? channel_config.download_chat : false;
        this.no_capture = channel_config.no_capture !== undefined ? channel_config.no_capture : false;
        this.burn_chat = channel_config.burn_chat !== undefined ? channel_config.burn_chat : false;
        this.live_chat = channel_config.live_chat !== undefined ? channel_config.live_chat : false;
    }

    /**
     * Folder for the channel that stores VODs and all other data
     * 
     * @returns {string} Folder path
     */
    public getFolder(): string {
        return Helper.vodFolder(this.login);
    }

    private async parseVODs(api = false): Promise<void> {

        // $this->vods_raw = glob($this->getFolder() . DIRECTORY_SEPARATOR . $this->login . "_*.json");
        this.vods_raw = fs.readdirSync(this.getFolder())
            .filter(file =>
                (
                    file.startsWith(`${this.login}_`) ||
                    file.startsWith(`${this.display_name}_`) // for backwards compatibility
                ) &&
                file.endsWith(".json") &&
                !file.endsWith("_chat.json") // bad workaround
            );

        this.vods_list = [];

        for (const vod of this.vods_raw) {

            Log.logAdvanced(LOGLEVEL.DEBUG, "channel", `Try to parse VOD ${vod}`);

            const vod_full_path = path.join(this.getFolder(), vod);

            let vodclass;

            try {
                vodclass = await TwitchVOD.load(vod_full_path, api);
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

            Log.logAdvanced(LOGLEVEL.DEBUG, "channel", `VOD ${vod} added to ${this.login}`);

            this.vods_list.push(vodclass);
        }
    }

    public getSubscriptionStatus(): boolean {
        // for (const sub_type of TwitchHelper.CHANNEL_SUB_TYPES) {
        //     if (KeyValue.getInstance().get(`${this.userid}.substatus.${sub_type}`) != SubStatus.SUBSCRIBED) {
        //         return false;
        //     }
        // }
        // return true;
        return Helper.CHANNEL_SUB_TYPES.every(sub_type => KeyValue.getInstance().get(`${this.userid}.substatus.${sub_type}`) === SubStatus.SUBSCRIBED);
    }

    public async toAPI(): Promise<ApiChannel> {

        if (!this.userid || !this.login || !this.display_name)
            console.error(chalk.red(`Channel ${this.login} is missing userid, login or display_name`));

        const vods_list = await Promise.all(this.vods_list?.map(async (vod) => await vod.toAPI()));

        return {
            userid: this.userid || "",
            login: this.login || "",
            display_name: this.display_name || "",
            description: this.description || "",
            profile_image_url: this.profile_image_url || "",
            broadcaster_type: this.broadcaster_type || "",
            is_live: this.is_live,
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

            current_stream_number: this.current_stream_number,
            current_season: this.current_season,
        };
    }

    /**
     * Update and save channel config
     * 
     * @param config 
     */
    public update(config: ChannelConfig): boolean {
        const i = TwitchChannel.channels_config.findIndex(ch => ch.login === this.login);
        if (i !== -1) {
            this.config = config;
            this.applyConfig(config);
            Log.logAdvanced(LOGLEVEL.INFO, "channel", `Replacing channel config for ${this.login}`);
            TwitchChannel.channels_config[i] = config;
            TwitchChannel.saveChannelsConfig();
            return true;
        } else {
            Log.logAdvanced(LOGLEVEL.ERROR, "channel", `Could not update channel ${this.login}`);
        }
        return false;
    }

    public delete(): boolean {

        const login = this.login;
        if (!login) throw new Error("Channel login is not set");

        const userid = this.userid;

        Log.logAdvanced(LOGLEVEL.INFO, "channel", `Deleting channel ${login}`);
        const index_config = TwitchChannel.channels_config.findIndex(ch => ch.login === login);
        if (index_config !== -1) {
            TwitchChannel.channels_config.splice(index_config, 1);
        }

        const index_channel = TwitchChannel.channels.findIndex(ch => ch.login === login);
        if (index_channel !== -1) {
            TwitchChannel.channels.splice(index_channel, 1);
        }

        if (userid) TwitchChannel.unsubscribe(userid);

        TwitchChannel.saveChannelsConfig();

        return TwitchChannel.getChannelByLogin(login) == undefined;
    }

    /**
     * Get the current capturing vod
     */
    get current_vod(): TwitchVOD | undefined {
        return this.vods_list?.find(vod => vod.is_capturing);
    }

    /**
     * Get the latest vod of the channel regardless of its status
     */
    get latest_vod(): TwitchVOD | undefined {
        if (!this.vods_list || this.vods_list.length == 0) return undefined;
        return this.vods_list[this.vods_list.length - 1]; // is this reliable?
    }

    get current_chapter(): TwitchVODChapter | undefined {
        if (!this.current_vod || !this.current_vod.chapters || this.current_vod.chapters.length == 0) return undefined;
        // return this.current_vod.chapters.at(-1);
        return this.current_vod.chapters[this.current_vod.chapters.length - 1];
    }

    get current_game(): TwitchGame | undefined {
        return this.current_vod?.current_game;
    }

    get current_duration(): number | undefined {
        return this.current_vod?.duration;
    }

    // a bit excessive since current_vod is already set with the capturing vod
    get is_live(): boolean {
        return this.current_vod != undefined && this.current_vod.is_capturing;
    }

    get is_converting(): boolean {
        return this.vods_list?.some(vod => vod.is_converting) ?? false;
    }

    get vods_size(): number {
        return this.vods_list?.reduce((acc, vod) => acc + (vod.segments?.reduce((acc, seg) => acc + (seg && seg.filesize ? seg.filesize : 0), 0) ?? 0), 0) ?? 0;
    }

    /**
     * Create an empty VOD object
     * @param filename 
     * @returns Empty VOD
     */
    public async createVOD(filename: string): Promise<TwitchVOD> {

        if (!this.userid) throw new Error("Channel userid is not set");
        if (!this.login) throw new Error("Channel login is not set");
        if (!this.display_name) throw new Error("Channel display_name is not set");

        Log.logAdvanced(LOGLEVEL.INFO, "vodclass", `Create VOD JSON for ${this.login}: ${path.basename(filename)} @ ${path.dirname(filename)}`);

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

        vod.saveJSON("create json");

        // reload
        const load_vod = await TwitchVOD.load(vod.filename);

        // TwitchVOD.addVod(vod);
        this.vods_list.push(load_vod);

        this.checkStaleVodsInMemory();

        return load_vod;

    }

    /**
     * Remove a vod from the channel and the main vods list
     * 
     * @param basename 
     * @returns 
     */
    public removeVod(basename: string): boolean {

        if (!this.userid) throw new Error("Channel userid is not set");
        if (!this.login) throw new Error("Channel login is not set");
        if (!this.display_name) throw new Error("Channel display_name is not set");

        const vod = this.vods_list.find(v => v.basename === basename);
        if (!vod) return false;

        Log.logAdvanced(LOGLEVEL.INFO, "vodclass", `Remove VOD JSON for ${this.login}: ${basename}`);

        this.vods_list = this.vods_list.filter(v => v.basename !== basename);

        TwitchVOD.removeVod(basename);

        this.checkStaleVodsInMemory();

        return true;

    }

    public checkStaleVodsInMemory(): void {
        if (!this.login) return;

        const vods_on_disk = fs.readdirSync(Helper.vodFolder(this.login)).filter(f => this.login && f.startsWith(this.login) && f.endsWith(".json") && !f.endsWith("_chat.json"));
        const vods_in_channel_memory = this.vods_list;
        const vods_in_main_memory = TwitchVOD.vods.filter(v => v.streamer_login === this.login);

        if (vods_on_disk.length !== vods_in_channel_memory.length) {
            Log.logAdvanced(LOGLEVEL.ERROR, "vodclass", `Vod on disk and vod in memory are not the same for ${this.login}`);
        }

        if (vods_on_disk.length !== vods_in_main_memory.length) {
            Log.logAdvanced(LOGLEVEL.ERROR, "vodclass", `Vod on disk and vod in main memory are not the same for ${this.login}`);
        }

        if (vods_in_channel_memory.length !== vods_in_main_memory.length) {
            Log.logAdvanced(LOGLEVEL.ERROR, "vodclass", `Vod in memory and vod in main memory are not the same for ${this.login}`);
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

    private roundupCleanupVodCandidates(ignore_basename = ""): TwitchVOD[] {

        let total_size = 0;
        let total_vods = 0;

        const vod_candidates: TwitchVOD[] = [];

        const sps_bytes = Config.getInstance().cfg<number>("storage_per_streamer", 100) * 1024 * 1024 * 1024;

        const vods_to_keep = Config.getInstance().cfg<number>("vods_to_keep", 5);

        if (this.vods_list) {
            for (const vodclass of [...this.vods_list].reverse()) { // reverse so we can delete the oldest ones first
                if (!vodclass.is_finalized) continue;
                if (vodclass.basename === ignore_basename) continue;

                if (Config.getInstance().cfg<boolean>("keep_deleted_vods") && vodclass.twitch_vod_exists === false) {
                    Log.logAdvanced(LOGLEVEL.INFO, "automator", `Keeping ${vodclass.basename} due to it being deleted on Twitch.`);
                    continue;
                }

                if (Config.getInstance().cfg<boolean>("keep_favourite_vods") && vodclass.hasFavouriteGame()) {
                    Log.logAdvanced(LOGLEVEL.INFO, "automator", `Keeping ${vodclass.basename} due to it having a favourite game.`);
                    continue;
                }

                if (Config.getInstance().cfg<boolean>("keep_muted_vods") && vodclass.twitch_vod_muted === MuteStatus.MUTED) {
                    Log.logAdvanced(LOGLEVEL.INFO, "automator", `Keeping ${vodclass.basename} due to it being muted on Twitch.`);
                    continue;
                }

                if (total_size > sps_bytes) {
                    Log.logAdvanced(LOGLEVEL.INFO, "automator", `Adding ${vodclass.basename} to vod_candidates due to storage limit (${Helper.formatBytes(vodclass.total_size)} of current total ${Helper.formatBytes(total_size)}, limit ${Helper.formatBytes(sps_bytes)})`);
                    vod_candidates.push(vodclass);
                } else if (total_vods >= vods_to_keep) {
                    Log.logAdvanced(LOGLEVEL.INFO, "automator", `Adding ${vodclass.basename} to vod_candidates due to vod limit (${total_vods} of limit ${vods_to_keep})`);
                    vod_candidates.push(vodclass);
                } else {
                    Log.logAdvanced(LOGLEVEL.INFO, "automator", `Keeping ${vodclass.basename} due to it not being over storage limit (${Helper.formatBytes(total_size)}/${Helper.formatBytes(sps_bytes)}) and not being over vod limit (${total_vods}/${vods_to_keep})`);
                }

                total_size += vodclass.total_size;
                total_vods += 1;

            }
        }

        return vod_candidates;

    }

    public cleanupVods(ignore_basename = ""): number | false {

        Log.logAdvanced(LOGLEVEL.INFO, "vodclass", `Cleanup VODs for ${this.login}, ignore ${ignore_basename}`);

        const vod_candidates = this.roundupCleanupVodCandidates(ignore_basename);

        if (vod_candidates.length === 0) {
            Log.logAdvanced(LOGLEVEL.INFO, "automator", `Not enough vods to delete for ${this.login}`);
            return false;
        }

        if (Config.getInstance().cfg("delete_only_one_vod")) {
            Log.logAdvanced(LOGLEVEL.INFO, "automator", `Deleting only one vod for ${this.login}`);
            vod_candidates[0].delete();
            return 1;
        } else {
            for (const vodclass of vod_candidates) {
                Log.logAdvanced(LOGLEVEL.INFO, "automator", `Cleanup ${vodclass.basename}`);
                vodclass.delete();
            }
        }

        return vod_candidates.length;

    }

    public getUrl(): string {
        return `https://www.twitch.tv/${this.login}`;
    }

    public findClips() {
        if (!this.login) return;
        this.clips_list = [];
        const clips_on_disk = fs.readdirSync(BaseConfigDataFolder.saved_clips).filter(f => this.login && f.startsWith(this.login) && f.endsWith(".mp4"));
        this.clips_list = clips_on_disk.map(f => path.basename(f));
        Log.logAdvanced(LOGLEVEL.DEBUG, "vodclass", `Found ${this.clips_list.length} clips for ${this.login}`);
    }

    public async refreshData() {
        if (!this.userid) throw new Error("Userid not set");
        Log.logAdvanced(LOGLEVEL.INFO, "vodclass", `Refreshing data for ${this.login}`);

        const channel_data = await TwitchChannel.getChannelDataById(this.userid, true);

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

    public setupStreamNumber() {

        // set season
        if (!KeyValue.getInstance().has(`${this.login}.season_identifier`)) {
            KeyValue.getInstance().set(`${this.login}.season_identifier`, format(new Date(), Config.SeasonFormat));
            this.current_season = format(new Date(), Config.SeasonFormat);
            Log.logAdvanced(LOGLEVEL.INFO, "vodclass", `Setting season for ${this.login} to ${this.current_season} as it is not set`);
        } else {
            this.current_season = KeyValue.getInstance().get(`${this.login}.season_identifier`) as string;
        }
        
        if (KeyValue.getInstance().has(`${this.login}.stream_number`)) {
            this.current_stream_number = KeyValue.getInstance().getInt(`${this.login}.stream_number`);
        } else {
            this.current_stream_number = 1;
            Log.logAdvanced(LOGLEVEL.INFO, "vodclass", `Channel ${this.login} has no stream number, setting to 1`);
            KeyValue.getInstance().setInt(`${this.login}.stream_number`, 1);
        }
    }

    public incrementStreamNumber() {
        const seasonIdentifier = KeyValue.getInstance().get(`${this.login}.season_identifier`);
        if (seasonIdentifier && seasonIdentifier !== format(new Date(), Config.SeasonFormat)) {
            this.current_stream_number = 1;
            KeyValue.getInstance().setInt(`${this.login}.stream_number`, 1);
            KeyValue.getInstance().set(`${this.login}.season_identifier`, format(new Date(), Config.SeasonFormat));
            this.current_season = format(new Date(), Config.SeasonFormat);
            Log.logAdvanced(LOGLEVEL.INFO, "vodclass", `Season changed for ${this.login} to ${this.current_season}`);
        } else {
            this.current_stream_number += 1;
            KeyValue.getInstance().setInt(`${this.login}.stream_number`, this.current_stream_number);
        }
        return this.current_stream_number;
    }

    public postLoad() {
        this.setupStreamNumber();
    }

    public broadcastUpdate() {
        if (process.env.NODE_ENV === "test") return;
        if (this._updateTimer) {
            clearTimeout(this._updateTimer);
            this._updateTimer = undefined;
        }
        this._updateTimer = setTimeout(async () => {
            const channel = await this.toAPI();
            Webhook.dispatch("channel_updated", {
                channel: channel,
            } as ChannelUpdated);
            this._updateTimer = undefined;
        }, 3000);
    }

    public deleteAllVods() {
        for (const vod of this.vods_list) {
            vod.delete();
        }
    }

    /**
     * 
     * STATIC
     * 
     */

    public static async loadAbstract(channel_id: string, api: boolean): Promise<TwitchChannel> {

        Log.logAdvanced(LOGLEVEL.DEBUG, "channel", `Load channel ${channel_id}`);

        const channel_memory = this.channels.find(channel => channel.userid === channel_id);
        if (channel_memory) {
            Log.logAdvanced(LOGLEVEL.WARNING, "channel", `Channel ${channel_id} already loaded`);
            return channel_memory;
        }

        const channel = new this();
        channel.userid = channel_id;

        const channel_data = await this.getChannelDataById(channel_id);
        if (!channel_data) throw new Error(`Could not get channel data for channel id: ${channel_id}`);

        const channel_login = channel_data.login;

        const channel_config = TwitchChannel.channels_config.find(c => c.login === channel_login);
        if (!channel_config) throw new Error(`Could not find channel config in memory for channel login: ${channel_login}`);

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

        await channel.parseVODs(api);

        channel.findClips();

        channel.saveKodiNfo();

        return channel;

    }

    /**
     * Create and insert channel in memory. Subscribe too.
     * 
     * @param config
     * @returns 
     */
    public static async create(config: ChannelConfig): Promise<TwitchChannel> {

        const exists_config = TwitchChannel.channels_config.find(ch => ch.login === config.login);
        if (exists_config) throw new Error(`Channel ${config.login} already exists in config`);

        const exists_channel = TwitchChannel.channels.find(ch => ch.login === config.login);
        if (exists_channel) throw new Error(`Channel ${config.login} already exists in channels`);

        const data = await TwitchChannel.getChannelDataByLogin(config.login, true);
        if (!data) throw new Error(`Could not get channel data for channel login: ${config.login}`);

        TwitchChannel.channels_config.push(config);
        TwitchChannel.saveChannelsConfig();

        const channel = await TwitchChannel.loadFromLogin(config.login, true);
        if (!channel || !channel.userid) throw new Error(`Channel ${config.login} could not be loaded`);

        try {
            await TwitchChannel.subscribe(channel.userid);
        } catch (error) {
            Log.logAdvanced(LOGLEVEL.ERROR, "channel", `Failed to subscribe to channel ${channel.login}: ${(error as Error).message}`);
            TwitchChannel.channels_config = TwitchChannel.channels_config.filter(ch => ch.login !== config.login); // remove channel from config
            TwitchChannel.saveChannelsConfig();
            throw error; // rethrow error
        }

        TwitchChannel.channels.push(channel);

        return channel;
    }

    /**
     * Load channel config into memory, not the channels themselves.
     */
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

    public static saveChannelsConfig(): boolean {
        Log.logAdvanced(LOGLEVEL.INFO, "channel", "Saving channel config");
        fs.writeFileSync(BaseConfigPath.channel, JSON.stringify(this.channels_config, null, 4));
        return fs.existsSync(BaseConfigPath.channel) && fs.readFileSync(BaseConfigPath.channel, "utf8") === JSON.stringify(this.channels_config, null, 4);
    }

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
    public static async loadChannels(): Promise<number> {
        Log.logAdvanced(LOGLEVEL.INFO, "channel", "Loading channels...");
        if (this.channels_config.length > 0) {
            for (const channel of this.channels_config) {

                let ch: TwitchChannel;

                try {
                    ch = await TwitchChannel.loadFromLogin(channel.login, true);
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
                } else {
                    Log.logAdvanced(LOGLEVEL.FATAL, "config", `Channel ${channel.login} could not be added, please check logs.`);
                    break;
                }
            }
        }
        Log.logAdvanced(LOGLEVEL.SUCCESS, "channel", `Loaded ${this.channels.length} channels!`);
        return this.channels.length;
    }

    public static getChannels(): TwitchChannel[] {
        return this.channels;
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
        return this.channels.find(ch => ch.login === login);
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
    public static async loadFromLogin(login: string, api: boolean): Promise<TwitchChannel> {
        if (!login) throw new Error("Streamer login is empty");
        if (typeof login !== "string") throw new TypeError("Streamer login is not a string");
        Log.logAdvanced(LOGLEVEL.DEBUG, "channel", `Load from login ${login}`);
        const channel_id = await this.channelIdFromLogin(login);
        if (!channel_id) throw new Error(`Could not get channel id from login: ${login}`);
        return this.loadAbstract(channel_id, api); // $channel;
    }

    public static async channelIdFromLogin(login: string): Promise<string | false> {
        const channelData = await this.getChannelDataByLogin(login, false);
        return channelData ? channelData.id : false;
    }

    public static async channelLoginFromId(channel_id: string): Promise<string | false> {
        const channelData = await this.getChannelDataById(channel_id, false);
        return channelData ? channelData.login : false;
    }

    public static async channelDisplayNameFromId(channel_id: string): Promise<string | false> {
        const channelData = await this.getChannelDataById(channel_id, false);
        return channelData ? channelData.display_name : false;
    }

    /**
     * Get channel data using the channel id (numeric in string form)
     * @param channel_id 
     * @param force 
     * @throws
     * @returns 
     */
    public static async getChannelDataById(channel_id: string, force = false): Promise<ChannelData | false> {
        return await this.getChannelDataProxy("id", channel_id, force);
    }

    /**
     * Get channel data using the channel login, not the display name
     * @param login 
     * @param force 
     * @throws
     * @returns 
     */
    public static async getChannelDataByLogin(login: string, force = false): Promise<ChannelData | false> {
        return await this.getChannelDataProxy("login", login, force);
    }

    /*
    async static getUserData({ id, login, skipCache = false }: { id?: string[], login?: string[], skipCache: boolean; }): Promise<ChannelData[]> {
        if (!id && !login) throw new Error("No id or login provided");
        const data: ChannelData[] = [];

        // check cache first
        if (!skipCache) {
            let proceed = false;
            if (id) {
                for (const channel_id of id) {
                    if (this.channels_cache[channel_id]) {
                        if (Date.now() > this.channels_cache[channel_id]._updated + TwitchConfig.streamerCacheTime) {
                            TwitchLog.logAdvanced(LOGLEVEL.INFO, "helper", `Memory cache for ${channel_id} is outdated, fetching new data`);
                            proceed = true;
                        } else {
                            TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "helper", `Memory cache for ${channel_id} is valid, using data`);
                            data.push(this.channels_cache[channel_id]);
                        }
                    }
                }
            }

            if (login) {
                for (const channel_login of login) {
                    const cd = Object.values(this.channels_cache).find(channel => channel.login == channel_login);
                    if (cd) {
                        if (Date.now() > cd._updated + TwitchConfig.streamerCacheTime) {
                            TwitchLog.logAdvanced(LOGLEVEL.INFO, "helper", `Memory cache for ${channel_login} is outdated, fetching new data`);
                            proceed = true;
                        } else {
                            TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "helper", `Memory cache for ${channel_login} is valid, using data`);
                            data.push(cd);
                        }
                    }
                }
            }

            if (!proceed) return data;
        }

        // fetch data
    */

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
    static async getChannelDataProxy(method: "id" | "login", identifier: string, force: boolean): Promise<ChannelData | false> {

        Log.logAdvanced(LOGLEVEL.DEBUG, "channel", `Fetching channel data for ${method} ${identifier}, force: ${force}`);

        // check cache first
        if (!force) {
            const channelData = method == "id" ? this.channels_cache[identifier] : Object.values(this.channels_cache).find(channel => channel.login == identifier);
            if (channelData) {
                Log.logAdvanced(LOGLEVEL.DEBUG, "channel", `Channel data found in memory cache for ${method} ${identifier}`);
                if (Date.now() > channelData._updated + Config.streamerCacheTime) {
                    Log.logAdvanced(LOGLEVEL.INFO, "helper", `Memory cache for ${identifier} is outdated, fetching new data`);
                } else {
                    Log.logAdvanced(LOGLEVEL.DEBUG, "channel", `Returning memory cache for ${method} ${identifier}`);
                    return channelData;
                }
            } else {
                Log.logAdvanced(LOGLEVEL.DEBUG, "channel", `Channel data not found in memory cache for ${method} ${identifier}, continue fetching`);
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
                Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Could not get channel data for ${method} ${identifier}: ${err.message} / ${err.response?.data.message}`, err);
                return false;
            }

            Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Channel data request for ${identifier} exceptioned: ${err}`, err);
            console.log(err);
            return false;
        }

        // TwitchLog.logAdvanced(LOGLEVEL.INFO, "helper", `URL: ${response.request.path} (default ${axios.defaults.baseURL})`);

        if (response.status !== 200) {
            Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Could not get channel data for ${identifier}, code ${response.status}.`);
            throw new Error(`Could not get channel data for ${identifier}, code ${response.status}.`);
        }

        const json: UsersResponse | ErrorResponse = response.data;

        if ("error" in json) {
            Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Could not get channel data for ${identifier}: ${json.message}`);
            return false;
        }

        if (json.data.length === 0) {
            Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Could not get channel data for ${identifier}, no data.`, { json });
            throw new Error(`Could not get channel data for ${identifier}, no data.`);
        }

        const data = json.data[0];

        // use as ChannelData
        const userData = data as unknown as ChannelData;

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
                Log.logAdvanced(LOGLEVEL.ERROR, "helper", `Could not download channel logo for ${userData.id}: ${(error as Error).message}`, error);                
            }
            if (avatar_response) {
                avatar_response.data.pipe(fs.createWriteStream(logo_path));
                userData.cache_avatar = logo_filename;
            }
        }

        // insert into memory and save to file
        console.debug(`Inserting channel data for ${method} ${identifier} into cache and file`);
        TwitchChannel.channels_cache[userData.id] = userData;
        fs.writeFileSync(BaseConfigPath.streamerCache, JSON.stringify(TwitchChannel.channels_cache));

        return userData;

    }

    public static async subscribe(channel_id: string): Promise<boolean> {

        if (!Config.getInstance().cfg("app_url")) {
            throw new Error("app_url is not set");
        }

        if (Config.getInstance().cfg("app_url") === "debug") {
            throw new Error("app_url is set to debug, no subscriptions possible");
        }

        let hook_callback = `${Config.getInstance().cfg("app_url")}/api/v0/hook`;

        if (Config.getInstance().cfg("instance_id")) {
            hook_callback += "?instance=" + Config.getInstance().cfg("instance_id");
        }

        if (!Config.getInstance().cfg("eventsub_secret")) {
            throw new Error("eventsub_secret is not set");
        }

        const streamer_login = await TwitchChannel.channelLoginFromId(channel_id);

        for (const sub_type of Helper.CHANNEL_SUB_TYPES) {

            if (KeyValue.getInstance().get(`${channel_id}.sub.${sub_type}`)) {
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

        const subscriptions = await Helper.getSubs();

        if (!subscriptions) {
            return false;
        }

        const streamer_login = await TwitchChannel.channelLoginFromId(channel_id);

        let unsubbed = 0;
        for (const sub of subscriptions.data) {

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

        return unsubbed === subscriptions.data.length;

    }

    public static async getSubscriptionId(channel_id: string, sub_type: EventSubTypes): Promise<string | false> {
        const all_subs = await Helper.getSubs();
        if (all_subs) {
            const sub_id = all_subs.data.find(sub => sub.condition.broadcaster_user_id == channel_id && sub.type == sub_type);
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

        Log.logAdvanced(LOGLEVEL.INFO, "automator", `Starting chat dump with filename ${path.basename(output)}`);

        const chat_job = Helper.startJob(`chatdump_${name}`, chat_bin, chat_cmd);

        return chat_job;

    }
}