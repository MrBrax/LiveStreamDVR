import { imageThumbnail } from "@/Helpers/Image";
import type { ApiTwitchChannel } from "@common/Api/Client";
// import type { TwitchChannelConfig, VideoQuality } from "@common/Config";
import type { TwitchChannelConfig } from "@/Zod/channel";
import type { VideoQuality } from "@/Zod/defs";
import type { Providers } from "@common/Defs";
import { MuteStatus, SubStatus } from "@common/Defs";
import { formatString } from "@common/Format";
import type { LocalVideo } from "@common/LocalVideo";
import type { AudioMetadata, VideoMetadata } from "@common/MediaInfo";
import type { VodBasenameTemplate } from "@common/Replacements";
import type { Channel, ChannelsResponse } from "@common/TwitchAPI/Channels";
import type { ErrorResponse, EventSubTypes } from "@common/TwitchAPI/Shared";
import type {
    Stream,
    StreamRequestParams,
    StreamsResponse,
} from "@common/TwitchAPI/Streams";
import type {
    SubscriptionRequest,
    SubscriptionResponse,
} from "@common/TwitchAPI/Subscriptions";
import type { BroadcasterType, UsersResponse } from "@common/TwitchAPI/Users";
import type { UserData } from "@common/User";
import type { AxiosResponse } from "axios";
import axios from "axios";
import chalk from "chalk";
import chokidar from "chokidar";
import { format, isValid, parseJSON } from "date-fns";
import { encode as htmlentities } from "html-entities";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import sanitize from "sanitize-filename";
import { Readable } from "stream";
import type { z } from "zod";
import { startJob } from "../../../Helpers/Execute";
import { formatBytes } from "../../../Helpers/Format";
import { xTimeout } from "../../../Helpers/Timeout";
import { isTwitchChannel } from "../../../Helpers/Types";
import { videoThumbnail, videometadata } from "../../../Helpers/Video";
import type { EventWebsocket } from "../../../Providers/Twitch";
import { TwitchHelper } from "../../../Providers/Twitch";
import type { TwitchVODChapterJSON } from "../../../Storage/JSON";
import {
    AppRoot,
    BaseConfigCacheFolder,
    BaseConfigDataFolder,
    BaseConfigPath,
} from "../../BaseConfig";
import { Config } from "../../Config";
import { Helper } from "../../Helper";
import type { Job } from "../../Job";
import { KeyValue } from "../../KeyValue";
import { LiveStreamDVR } from "../../LiveStreamDVR";
import { LOGLEVEL, log } from "../../Log";
import { Webhook } from "../../Webhook";
import { BaseChannel } from "../Base/BaseChannel";
import { TwitchGame } from "./TwitchGame";
import { TwitchVOD } from "./TwitchVOD";

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

    // public description: string | undefined;
    // public profile_image_url: string | undefined;
    public offline_image_url: string | undefined;
    /** TODO: Not implemented */
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

        if (
            fs.existsSync(
                path.join(
                    BaseConfigDataFolder.vods_db,
                    `${this.internalName}.json`
                )
            ) &&
            !rescan
        ) {
            let list: string[] = JSON.parse(
                fs.readFileSync(
                    path.join(
                        BaseConfigDataFolder.vods_db,
                        `${this.internalName}.json`
                    ),
                    { encoding: "utf-8" }
                )
            );
            log(
                LOGLEVEL.DEBUG,
                "channel.parseVODs",
                `Found ${list.length} stored VODs in database for ${this.internalName}`
            );
            // console.log(list);
            list = list.filter((p) =>
                fs.existsSync(path.join(BaseConfigDataFolder.vod, p))
            );
            // console.log(list);
            this.vods_raw = list;
            log(
                LOGLEVEL.DEBUG,
                "channel.parseVODs",
                `Found ${this.vods_raw.length} existing VODs in database for ${this.internalName}`
            );
        } else {
            this.vods_raw = this.rescanVods();
            log(
                LOGLEVEL.INFO,
                "channel.parseVODs",
                `No VODs in database found for ${this.internalName}, migrate ${this.vods_raw.length} from recursive file search`
            );
            // fs.writeFileSync(path.join(BaseConfigDataFolder.vods_db, `${this.internalName}.json`), JSON.stringify(this.vods_raw));
            this.saveVodDatabase();
        }

        this.vods_list = [];

        for (const vod of this.vods_raw) {
            log(LOGLEVEL.DEBUG, "channel.parseVODs", `Try to parse VOD ${vod}`);

            const vod_full_path = path.join(BaseConfigDataFolder.vod, vod);

            let vodclass;

            try {
                vodclass = await TwitchVOD.load(vod_full_path, true);
            } catch (e) {
                log(
                    LOGLEVEL.ERROR,
                    "channel.parseVODs",
                    `Could not load VOD ${vod}: ${(e as Error).message}`,
                    e
                );
                console.error(e);
                continue;
            }

            if (!vodclass) {
                continue;
            }

            if (!vodclass.channel_uuid) {
                log(
                    LOGLEVEL.WARNING,
                    "channel.parseVODs",
                    `VOD '${vod}' does not have a channel UUID, setting it to '${this.uuid}'`
                );
                vodclass.channel_uuid = this.uuid;
            } else if (
                vodclass.channel_uuid &&
                vodclass.channel_uuid !== this.uuid
            ) {
                log(
                    LOGLEVEL.WARNING,
                    "channel.parseVODs",
                    `VOD '${vod}' has a channel UUID '${vodclass.channel_uuid}', but it should be '${this.uuid}', setting it to '${this.uuid}'`
                );
                vodclass.channel_uuid = this.uuid;
            }

            // await vodclass.fixIssues();
            log(LOGLEVEL.DEBUG, "channel.parseVODs", `Fix issues for ${vod}`);
            let noIssues = false;
            do {
                noIssues = await vodclass.fixIssues("channel parseVODs");
            } while (!noIssues);

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

            log(
                LOGLEVEL.DEBUG,
                "channel.parseVODs",
                `VOD ${vod} added to ${this.internalName}`
            );

            this.addVod(vodclass);
        }
        this.sortVods();
    }

    public getSubscriptionStatus(): boolean {
        // for (const sub_type of TwitchHelper.CHANNEL_SUB_TYPES) {
        //     if (KeyValue.getInstance().get(`${this.userid}.substatus.${sub_type}`) != SubStatus.SUBSCRIBED) {
        //         return false;
        //     }
        // }
        // return true;
        return TwitchHelper.CHANNEL_SUB_TYPES.every(
            (sub_type) =>
                KeyValue.getInstance().get(
                    `${this.internalId}.substatus.${sub_type}`
                ) === SubStatus.SUBSCRIBED
        );
    }

    public async toAPI(): Promise<ApiTwitchChannel> {
        if (!this.internalId || !this.internalName || !this.displayName)
            console.error(
                chalk.red(
                    `Channel ${this.internalId} is missing internalId, internalName or displayName`
                )
            );

        const vods_list = await Promise.all(
            this.getVods().map(async (vod) => await vod.toAPI())
        );

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

            subbed_at: this.subbed_at
                ? this.subbed_at.toISOString()
                : undefined,
            expires_at: this.expires_at
                ? this.expires_at.toISOString()
                : undefined,
            last_online: this.last_online
                ? this.last_online.toISOString()
                : undefined,
            clips_list: this.clips_list,
            video_list: this.video_list,

            current_stream_number: this.current_stream_number,
            current_season: this.current_season,
            current_absolute_season: this.current_absolute_season,

            chapter_data: this.getChapterData(),

            saves_vods: this.saves_vods,

            displayName: this.displayName,
            internalName: this.internalName,
            internalId: this.internalId,
            url: this.url,
            profilePictureUrl: this.profilePictureUrl,
        };
    }

    /**
     * Update and save channel config
     *
     * @param config
     */
    public update(config: typeof TwitchChannelConfig): boolean {
        const i = LiveStreamDVR.getInstance().channels_config.findIndex(
            (ch) => ch.uuid === this.uuid
        );
        if (i !== -1) {
            this.config = config;
            this.applyConfig(config);
            log(
                LOGLEVEL.INFO,
                "tw.channel.update",
                `Replacing channel config for ${this.internalName}`
            );
            LiveStreamDVR.getInstance().channels_config[i] = config;
            LiveStreamDVR.getInstance().saveChannelsConfig();
            return true;
        } else {
            log(
                LOGLEVEL.ERROR,
                "tw.channel.update",
                `Could not update channel ${this.internalName}`
            );
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
        return KeyValue.getInstance().getBool(`${this.internalName}.online`);
    }

    /**
     * Create an empty VOD object. This is the only method to use to create a new VOD. Do NOT use the constructor of the VOD class.
     *
     * @param filename The filename of the vod including json extension.
     * @returns Empty VOD
     */
    public async createVOD(filename: string): Promise<TwitchVOD> {
        if (!this.internalId) throw new Error("Channel internalId is not set");
        if (!this.internalName)
            throw new Error("Channel internalName is not set");
        if (!this.displayName)
            throw new Error("Channel displayName is not set");

        log(
            LOGLEVEL.INFO,
            "tw.channel.createVOD",
            `Create VOD JSON for ${this.internalName}: ${path.basename(
                filename
            )} @ ${path.dirname(filename)}`
        );

        if (fs.existsSync(filename)) {
            log(
                LOGLEVEL.ERROR,
                "tw.channel.createVOD",
                `VOD JSON already exists for ${
                    this.internalName
                }: ${path.basename(filename)} @ ${path.dirname(filename)}`
            );
            throw new Error(
                `VOD JSON already exists for ${
                    this.internalName
                }: ${path.basename(filename)} @ ${path.dirname(filename)}`
            );
        }

        const vod = new TwitchVOD();

        vod.created = true;
        vod.not_started = true;

        vod.filename = filename;
        vod.basename = path.basename(filename, ".json");
        vod.directory = path.dirname(filename);

        vod.channel_uuid = this.uuid;

        vod.created_at = new Date();

        vod.uuid = randomUUID();

        await vod.saveJSON("create json");

        // reload
        const load_vod = await TwitchVOD.load(vod.filename, true);

        // TwitchVOD.addVod(vod);
        this.addVod(load_vod);
        this.sortVods();

        // add to database
        this.addVodToDatabase(
            path.relative(BaseConfigDataFolder.vod, filename)
        );
        this.saveVodDatabase();

        this.checkStaleVodsInMemory();

        return load_vod;
    }

    public checkStaleVodsInMemory(): void {
        log(
            LOGLEVEL.DEBUG,
            "tw.channel.checkStaleVodsInMemory",
            `Check stale VODs in memory for ${this.internalName}`
        );

        // const vods_on_disk = fs.readdirSync(Helper.vodFolder(this.login)).filter(f => this.login && f.startsWith(this.login) && f.endsWith(".json") && !f.endsWith("_chat.json"));
        const vods_on_disk = this.rescanVods();
        const vods_in_channel_memory = this.getVods();
        const vods_in_main_memory =
            LiveStreamDVR.getInstance().getVodsByChannelUUID(this.uuid);

        /**
         * // TODO: rewrite all of this, it's a mess. it doesn't make any sense anymore when vods can be stored in customised folders.
         * It always assumes the vod is in the channel folder and as such counts are not correct anymore.
        /*

        if (vods_on_disk.length !== vods_in_channel_memory.length) {
            const removedVods = vods_in_channel_memory.filter(v => !vods_on_disk.includes(v.basename));
            ClientBroker.notify(
                "VOD changed externally",
                `Please do not delete or rename VOD files manually.\nRemoved VODs: ${removedVods.map(v => v.basename).join(", ")}`,
                undefined,
                "system"
            );
            // console.log("Removed VODs: ", removedVods.map(v => v.basename).join(", "));
            logAdvanced(LOGLEVEL.ERROR, "channel", `Vod on disk and vod in memory are not the same for ${this.internalName}`, {
                vods_on_disk,
                vods_in_channel_memory: vods_in_channel_memory.map(v => v.basename),
                vods_in_main_memory: vods_in_main_memory.map(v => v.basename),
            });
        }

        if (vods_on_disk.length !== vods_in_main_memory.length) {
            const removedVods = vods_in_main_memory.filter(v => !vods_on_disk.includes(v.basename));
            ClientBroker.notify(
                "VOD changed externally",
                `Please do not delete or rename VOD files manually.\nRemoved VODs: ${removedVods.map(v => v.basename).join(", ")}`,
                undefined,
                "system"
            );
            // console.log("Removed VODs: ", removedVods.map(v => v.basename).join(", "));
            logAdvanced(LOGLEVEL.ERROR, "channel", `Vod on disk and vod in main memory are not the same for ${this.internalName}`, {
                vods_on_disk,
                vods_in_channel_memory: vods_in_channel_memory.map(v => v.basename),
                vods_in_main_memory: vods_in_main_memory.map(v => v.basename),
            });
        }

        if (vods_in_channel_memory.length !== vods_in_main_memory.length) {
            const removedVods = vods_in_main_memory.filter(v => v instanceof TwitchVOD && !vods_in_channel_memory.includes(v));
            ClientBroker.notify(
                "VOD changed externally",
                `Please do not delete or rename VOD files manually.\nRemoved VODs: ${removedVods.map(v => v.basename).join(", ")}`,
                undefined,
                "system"
            );
            // console.log("Removed VODs: ", removedVods.map(v => v.basename).join(", "));
            logAdvanced(LOGLEVEL.ERROR, "channel", `Vod in memory and vod in main memory are not the same for ${this.internalName}`, {
                vods_on_disk,
                vods_in_channel_memory: vods_in_channel_memory.map(v => v.basename),
                vods_in_main_memory: vods_in_main_memory.map(v => v.basename),
            });
        }
        */
    }

    public hasVod(video_id: string): boolean {
        return (
            this.getVods().find(
                (v) => v.twitch_vod_id && v.twitch_vod_id === video_id
            ) != undefined
        );
    }

    /**
     * Get the latest chapter data stored in cache
     *
     * @returns {TwitchVODChapterJSON|undefined} Chapter data
     */
    public getChapterData(): TwitchVODChapterJSON | undefined {
        const cd = KeyValue.getInstance().get(
            `${this.internalName}.chapterdata`
        );
        return cd ? (JSON.parse(cd) as TwitchVODChapterJSON) : undefined;
    }

    public async updateChapterData(force = false): Promise<void> {
        if (!this.internalId) return;
        if (
            (await KeyValue.getInstance().hasAsync(
                `${this.internalName}.chapterdata`
            )) &&
            !force
        )
            return;
        const data = await TwitchChannel.getChannelDataById(this.internalId);
        if (!data) return;
        const chapter = TwitchChannel.channelDataToChapterData(data);
        await KeyValue.getInstance().setAsync(
            `${this.internalName}.chapterdata`,
            JSON.stringify(chapter)
        );
        log(
            LOGLEVEL.INFO,
            "tw.channel.updateChapterData",
            `Updated chapter data for ${this.internalName}`
        );
    }

    public roundupCleanupVodCandidates(ignore_uuid = ""): TwitchVOD[] {
        let total_size = 0;
        let total_vods = 0;

        let vod_candidates: TwitchVOD[] = [];

        const max_storage =
            this.max_storage > 0
                ? this.max_storage
                : Config.getInstance().cfg<number>("storage_per_streamer", 100);
        const max_vods =
            this.max_vods > 0
                ? this.max_vods
                : Config.getInstance().cfg<number>("vods_to_keep", 5);

        const max_gigabytes = max_storage * 1024 * 1024 * 1024;
        // const vods_to_keep = max_vods;

        if (this.vods_list) {
            for (const vodclass of [...this.vods_list].reverse()) {
                // reverse so we can delete the oldest ones first

                if (!vodclass.is_finalized) {
                    log(
                        LOGLEVEL.DEBUG,
                        "tw.channel.roundupCleanupVodCandidates",
                        `Keeping ${vodclass.basename} due to not being finalized`
                    );
                    continue;
                }

                if (!vodclass.uuid) {
                    log(
                        LOGLEVEL.ERROR,
                        "tw.channel.roundupCleanupVodCandidates",
                        `VOD ${vodclass.basename} does not have an UUID, will not remove.`
                    );
                    continue;
                }

                if (vodclass.uuid === ignore_uuid) {
                    log(
                        LOGLEVEL.DEBUG,
                        "tw.channel.roundupCleanupVodCandidates",
                        `Keeping ${vodclass.basename} due to ignore_uuid '${ignore_uuid}'`
                    );
                    continue;
                }

                if (
                    Config.getInstance().cfg<boolean>("keep_deleted_vods") &&
                    vodclass.twitch_vod_exists === false
                ) {
                    log(
                        LOGLEVEL.DEBUG,
                        "tw.channel.roundupCleanupVodCandidates",
                        `Keeping ${vodclass.basename} due to it being deleted on Twitch.`
                    );
                    continue;
                }

                if (
                    Config.getInstance().cfg<boolean>("keep_favourite_vods") &&
                    vodclass.hasFavouriteGame()
                ) {
                    log(
                        LOGLEVEL.DEBUG,
                        "tw.channel.roundupCleanupVodCandidates",
                        `Keeping ${vodclass.basename} due to it having a favourite game.`
                    );
                    continue;
                }

                if (
                    Config.getInstance().cfg<boolean>("keep_muted_vods") &&
                    vodclass.twitch_vod_muted === MuteStatus.MUTED
                ) {
                    log(
                        LOGLEVEL.DEBUG,
                        "tw.channel.roundupCleanupVodCandidates",
                        `Keeping ${vodclass.basename} due to it being muted on Twitch.`
                    );
                    continue;
                }

                if (
                    Config.getInstance().cfg<boolean>("keep_commented_vods") &&
                    vodclass.comment !== "" &&
                    vodclass.comment !== undefined
                ) {
                    log(
                        LOGLEVEL.DEBUG,
                        "tw.channel.roundupCleanupVodCandidates",
                        `Keeping ${vodclass.basename} due to it having a comment set.`
                    );
                    continue;
                }

                if (vodclass.prevent_deletion) {
                    log(
                        LOGLEVEL.DEBUG,
                        "tw.channel.roundupCleanupVodCandidates",
                        `Keeping ${vodclass.basename} due to prevent_deletion`
                    );
                    continue;
                }

                total_size += vodclass.total_size;
                total_vods += 1;

                if (total_size > max_gigabytes) {
                    log(
                        LOGLEVEL.DEBUG,
                        "tw.channel.roundupCleanupVodCandidates",
                        `Adding ${
                            vodclass.basename
                        } to vod_candidates due to storage limit (${formatBytes(
                            vodclass.total_size
                        )} of current total ${formatBytes(
                            total_size
                        )}, limit ${formatBytes(max_gigabytes)})`
                    );
                    vod_candidates.push(vodclass);
                }

                if (total_vods > max_vods) {
                    log(
                        LOGLEVEL.DEBUG,
                        "tw.channel.roundupCleanupVodCandidates",
                        `Adding ${vodclass.basename} to vod_candidates due to vod limit (${total_vods} of limit ${max_vods})`
                    );
                    vod_candidates.push(vodclass);
                }

                if (!vod_candidates.includes(vodclass)) {
                    log(
                        LOGLEVEL.DEBUG,
                        "tw.channel.roundupCleanupVodCandidates",
                        `Keeping ${
                            vodclass.basename
                        } due to it not being over storage limit (${formatBytes(
                            total_size
                        )}/${formatBytes(
                            max_gigabytes
                        )}) and not being over vod limit (${total_vods}/${max_vods})`
                    );
                }
            }
        }

        // remove duplicates
        vod_candidates = vod_candidates.filter(
            (v, i, a) => a.findIndex((t) => t.basename === v.basename) === i
        );

        log(
            LOGLEVEL.INFO,
            "tw.channel.roundupCleanupVodCandidates",
            `Chose ${vod_candidates.length} vods to delete`,
            { vod_candidates: vod_candidates.map((v) => v.basename) }
        );

        return vod_candidates;
    }

    public async cleanupVods(ignore_uuid = ""): Promise<number | false> {
        if (this.no_cleanup) {
            log(
                LOGLEVEL.INFO,
                "tw.channel.cleanupVods",
                `Skipping cleanup for ${this.internalName} due to no_cleanup flag`
            );
            return false;
        }

        log(
            LOGLEVEL.INFO,
            "tw.channel.cleanupVods",
            `Cleanup VODs for ${this.internalName}, ignore ${ignore_uuid}`
        );

        const vod_candidates = this.roundupCleanupVodCandidates(ignore_uuid);

        if (vod_candidates.length === 0) {
            log(
                LOGLEVEL.INFO,
                "tw.channel.cleanupVods",
                `Not enough vods to delete for ${this.internalName}`
            );
            return false;
        }

        if (Config.getInstance().cfg("delete_only_one_vod")) {
            log(
                LOGLEVEL.INFO,
                "tw.channel.cleanupVods",
                `Deleting only one vod for ${this.internalName}: ${vod_candidates[0].basename}`
            );
            try {
                await vod_candidates[0].delete();
            } catch (error) {
                log(
                    LOGLEVEL.ERROR,
                    "tw.channel.cleanupVods",
                    `Failed to delete ${vod_candidates[0].basename} for ${
                        this.internalName
                    }: ${(error as Error).message}`
                );
                return false;
            }
            return 1;
        } else {
            for (const vodclass of vod_candidates) {
                log(
                    LOGLEVEL.INFO,
                    "tw.channel.cleanupVods",
                    `Cleanup delete: ${vodclass.basename}`
                );
                try {
                    await vodclass.delete();
                } catch (error) {
                    log(
                        LOGLEVEL.ERROR,
                        "tw.channel.cleanupVods",
                        `Failed to delete ${vodclass.basename} for ${
                            this.internalName
                        }: ${(error as Error).message}`
                    );
                }
            }
        }

        try {
            this.deleteEmptyVodFolders();
        } catch (error) {
            log(
                LOGLEVEL.ERROR,
                "tw.channel.cleanupVods",
                `Failed to delete empty folders for ${this.internalName}: ${
                    (error as Error).message
                }`
            );
        }

        return vod_candidates.length;
    }

    public async refreshData(): Promise<boolean> {
        if (!this.internalId) throw new Error("Userid not set");
        log(
            LOGLEVEL.INFO,
            "tw.channel.refreshData",
            `Refreshing data for ${this.internalName}`
        );

        const channel_data = await TwitchChannel.getUserDataById(
            this.internalId,
            true
        );

        if (channel_data) {
            this.channel_data = channel_data;
            this.userid = channel_data.id;
            this.login = channel_data.login;
            this.display_name = channel_data.display_name;
            // this.profile_image_url = channel_data.profile_image_url;
            this.broadcaster_type = channel_data.broadcaster_type;
            // this.description = channel_data.description;

            await this.checkIfChannelSavesVods();

            this.saveKodiNfo();

            return true;
        }

        return false;
    }

    /**
     * Save Kodi-style nfo file for the channel into the channel folder
     * @returns {boolean} True if the nfo file was saved
     */
    public saveKodiNfo(): boolean {
        if (!this.channel_data) {
            log(
                LOGLEVEL.ERROR,
                "tw.channel.kodi",
                `Cannot save Kodi nfo for ${this.internalName}, channel_data is not set`
            );
            return false;
        }
        if (!Config.getInstance().cfg("create_kodi_nfo")) return false;
        if (!Config.getInstance().cfg("channel_folders")) {
            log(
                LOGLEVEL.WARNING,
                "tw.channel.kodi",
                `Not creating nfo for ${this.internalName}, channel_folders is disabled`
            );
            return false;
        }

        const nfo_file = path.join(this.getFolder(), "tvshow.nfo");
        let avatar;

        if (this.channel_data.avatar_cache) {
            const avatar_path = path.join(
                BaseConfigCacheFolder.public_cache_avatars,
                this.channel_data.avatar_cache
            );

            if (fs.existsSync(avatar_path)) {
                fs.copyFileSync(
                    avatar_path,
                    path.join(
                        this.getFolder(),
                        `poster${path.extname(this.channel_data.avatar_cache)}`
                    )
                );
                avatar = `poster${path.extname(
                    this.channel_data.avatar_cache
                )}`;
                log(
                    LOGLEVEL.DEBUG,
                    "tw.channel.kodi",
                    `Copied avatar ${this.channel_data.avatar_cache} to ${avatar}`
                );
            } else {
                log(
                    LOGLEVEL.WARNING,
                    "tw.channel.kodi",
                    `Avatar ${
                        this.channel_data.avatar_cache
                    } not found in cache, not copying to ${this.getFolder()}`,
                    {
                        avatar_cache: this.channel_data.avatar_cache,
                        public_cache_avatars:
                            BaseConfigCacheFolder.public_cache_avatars,
                        getFolder: this.getFolder(),
                    }
                );
            }
        } else {
            log(
                LOGLEVEL.WARNING,
                "tw.channel.kodi",
                `Avatar not found for ${this.internalName}, it is recommended to refresh the channel data`
            );
        }

        let nfo_content =
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
        nfo_content += "<tvshow>\n";
        nfo_content += `<title>${this.channel_data.display_name}</title>\n`;
        nfo_content += `<uniqueid type="twitch>${this.internalId}</uniqueid>\n`;
        if (avatar) nfo_content += `<thumb aspect="poster">${avatar}</thumb>\n`;
        // nfo_content += `<thumb aspect="fanart">${this.channel_data.profile_banner_url}</thumb>\n`;
        nfo_content += `<episode>${this.getVods().length}</episode>\n`;
        nfo_content += `<plot>${htmlentities(
            this.channel_data.description
        )}</plot>\n`;
        nfo_content += "<actor>\n";
        nfo_content += `\t<name>${this.channel_data.display_name}</name>\n`;
        nfo_content += "\t<role>Themselves</role>\n";
        nfo_content += "</actor>\n";
        nfo_content += "</tvshow>";

        fs.writeFileSync(nfo_file, nfo_content);

        log(
            LOGLEVEL.INFO,
            "tw.channel.kodi",
            `Wrote nfo file for ${this.internalName} to ${nfo_file}`
        );

        return fs.existsSync(nfo_file);
    }

    public async setupStreamNumber(): Promise<void> {
        // set season
        if (
            !(await KeyValue.getInstance().hasAsync(
                `${this.internalName}.season_identifier`
            ))
        ) {
            await KeyValue.getInstance().setAsync(
                `${this.internalName}.season_identifier`,
                format(new Date(), Config.SeasonFormat)
            );
            this.current_season = format(new Date(), Config.SeasonFormat);
            log(
                LOGLEVEL.INFO,
                "channel.setupStreamNumber",
                `Setting season for ${this.internalName} to ${this.current_season} as it is not set`
            );
        } else {
            this.current_season = (await KeyValue.getInstance().getAsync(
                `${this.internalName}.season_identifier`
            )) as string;
        }

        // absolute season numbering, one each month that goes on forever
        if (
            !(await KeyValue.getInstance().hasAsync(
                `${this.internalName}.absolute_season_identifier`
            ))
        ) {
            await KeyValue.getInstance().setIntAsync(
                `${this.internalName}.absolute_season_identifier`,
                1
            );
            await KeyValue.getInstance().setIntAsync(
                `${this.internalName}.absolute_season_month`,
                parseInt(format(new Date(), "M"))
            );
            this.current_absolute_season = 1;
            log(
                LOGLEVEL.INFO,
                "channel.setupStreamNumber",
                `Setting season for ${this.internalName} to ${this.current_season} as it is not set`
            );
        } else {
            this.current_absolute_season =
                await KeyValue.getInstance().getIntAsync(
                    `${this.internalName}.absolute_season_identifier`
                );
        }

        if (
            await KeyValue.getInstance().hasAsync(
                `${this.internalName}.stream_number`
            )
        ) {
            this.current_stream_number =
                await KeyValue.getInstance().getIntAsync(
                    `${this.internalName}.stream_number`
                );
        } else {
            this.current_stream_number = 1;
            log(
                LOGLEVEL.INFO,
                "channel.setupStreamNumber",
                `Channel ${this.internalName} has no stream number, setting to 1`
            );
            await KeyValue.getInstance().setIntAsync(
                `${this.internalName}.stream_number`,
                1
            );
        }
    }

    public async postLoad(): Promise<void> {
        await this.parseVODs();
        await this.setupStreamNumber();
        if (
            !(await KeyValue.getInstance().hasAsync(
                `${this.internalName}.saves_vods`
            ))
        ) {
            await this.checkIfChannelSavesVods();
        }
        this.addAllLocalVideos();
        await this.startWatching();
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
        log(
            LOGLEVEL.INFO,
            "channel.rename",
            `Renaming channel ${this.login} to ${new_login}`
        );

        if (this.login === new_login) {
            throw new Error("Cannot rename channel to same name");
        }
        const old_login = this.login;
        if (!old_login) {
            throw new Error("Cannot rename channel without login");
        }

        // update config
        const channelConfigIndex =
            LiveStreamDVR.getInstance().channels_config.findIndex(
                (c) => c.provider == "twitch" && c.login === old_login
            );
        if (channelConfigIndex !== -1) {
            (
                LiveStreamDVR.getInstance().channels_config[
                    channelConfigIndex
                ] as TwitchChannelConfig
            ).login = new_login;
            LiveStreamDVR.getInstance().saveChannelsConfig();
        } else {
            throw new Error(`Could not find channel config for ${old_login}`);
        }

        // rename vods
        for (const vod of this.getVods()) {
            await vod.changeBaseName(
                vod.basename.replace(old_login, new_login)
            );
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

        await newChannel.refreshData(); // refresh data for new login

        return true;
    }

    public async isLiveApi(): Promise<boolean> {
        if (!this.internalId) return false;
        const streams = await TwitchChannel.getStreams(this.internalId);
        return streams && streams.length > 0;
    }

    public async checkIfChannelSavesVods(): Promise<boolean> {
        if (!this.internalId) return false;
        log(
            LOGLEVEL.DEBUG,
            "tw.channel.checkIfChannelSavesVods",
            `Checking if channel ${this.internalName} saves vods`
        );
        const videos = await TwitchVOD.getLatestVideos(this.internalId);
        const state = videos && videos.length > 0;
        await KeyValue.getInstance().setBoolAsync(
            `${this.internalName}.saves_vods`,
            state
        );
        if (state) {
            log(
                LOGLEVEL.SUCCESS,
                "tw.channel.checkIfChannelSavesVods",
                `Channel ${this.internalName} saves vods`
            );
        } else {
            log(
                LOGLEVEL.WARNING,
                "tw.channel.checkIfChannelSavesVods",
                `Channel ${this.internalName} does not save vods`
            );
        }
        return state;
    }

    get saves_vods(): boolean {
        return KeyValue.getInstance().getBool(
            `${this.internalName}.saves_vods`
        );
    }

    public async downloadLatestVod(
        quality: typeof VideoQuality
    ): Promise<string> {
        if (!this.internalId) {
            throw new Error("Cannot download latest vod without userid");
        }

        const vods = await TwitchVOD.getLatestVideos(this.internalId);

        if (!vods || vods.length === 0) {
            throw new Error("No vods found");
        }

        const latestVodData = vods[0];
        const now = new Date();
        const latestVodDate = new Date(latestVodData.created_at);
        const latestVodDuration = TwitchHelper.parseTwitchDuration(
            latestVodData.duration
        );
        const latestVodDateTotal = new Date(
            latestVodDate.getTime() + latestVodDuration * 1000
        );
        const latestVodDateDiff = Math.abs(
            now.getTime() - latestVodDateTotal.getTime()
        );
        const latestVodId = latestVodData.id;

        // check locally captured vods for a base vod object to use instead of downloading a new one
        const localVod = this.getVods().find(
            (v) =>
                v.twitch_vod_id === latestVodData.id ||
                (v.created_at?.getTime() &&
                    now.getTime() - v.created_at?.getTime() < latestVodDateDiff)
        );
        if (localVod) {
            await localVod.downloadVod(quality);
            return localVod.path_downloaded_vod;
        }

        if (latestVodDateDiff > 1000 * 60 * 15) {
            throw new Error(
                `Latest vod is older than 15 minutes (${Math.floor(
                    latestVodDateDiff / 1000 / 60
                )} minutes, ${latestVodDateTotal.toISOString()})`
            );
        }

        const channel_basepath = this.getFolder();
        let basepath = "";

        // const basename = `${this.login}_${latestVodData.created_at.replaceAll(":", "-")}_${latestVodData.stream_id}`;

        if (Config.getInstance().cfg<boolean>("vod_folders")) {
            const vod_folder_template_variables: VodBasenameTemplate = {
                login: this.internalName,
                internalName: this.internalName,
                displayName: this.displayName,
                date: latestVodData.created_at.replaceAll(":", "_"),
                year: isValid(latestVodDate)
                    ? format(latestVodDate, "yyyy")
                    : "",
                year_short: isValid(latestVodDate)
                    ? format(latestVodDate, "yy")
                    : "",
                month: isValid(latestVodDate)
                    ? format(latestVodDate, "MM")
                    : "",
                day: isValid(latestVodDate) ? format(latestVodDate, "dd") : "",
                hour: isValid(latestVodDate) ? format(latestVodDate, "HH") : "",
                minute: isValid(latestVodDate)
                    ? format(latestVodDate, "mm")
                    : "",
                second: isValid(latestVodDate)
                    ? format(latestVodDate, "ss")
                    : "",
                id: latestVodId.toString(),
                // season: this.vod_season || "",
                // absolute_season: this.vod_absolute_season ? this.vod_absolute_season.toString().padStart(2, "0") : "",
                // episode: this.vod_episode ? this.vod_episode.toString().padStart(2, "0") : "",
                // absolute_episode: this.vod_absolute_episode ? this.vod_absolute_episode.toString().padStart(2, "0") : "",

                // TODO: add season and episode
                season: "",
                absolute_season: "",
                episode: "",
                absolute_episode: "",

                title: latestVodData.title,
                game_name: "", // not exposed by twitch api
            };

            const vod_folder_base = sanitize(
                formatString(
                    Config.getInstance().cfg("filename_vod_folder"),
                    vod_folder_template_variables
                )
            );

            basepath = path.join(channel_basepath, vod_folder_base);
        } else {
            basepath = channel_basepath;
        }

        if (!fs.existsSync(basepath)) {
            fs.mkdirSync(basepath, { recursive: true });
        }

        const vod_filename_template_variables: VodBasenameTemplate = {
            login: this.internalName,
            internalName: this.internalName,
            displayName: this.displayName,
            date: latestVodData.created_at.replaceAll(":", "_"),
            year: isValid(latestVodDate) ? format(latestVodDate, "yyyy") : "",
            year_short: isValid(latestVodDate)
                ? format(latestVodDate, "yy")
                : "",
            month: isValid(latestVodDate) ? format(latestVodDate, "MM") : "",
            day: isValid(latestVodDate) ? format(latestVodDate, "dd") : "",
            hour: isValid(latestVodDate) ? format(latestVodDate, "HH") : "",
            minute: isValid(latestVodDate) ? format(latestVodDate, "mm") : "",
            second: isValid(latestVodDate) ? format(latestVodDate, "ss") : "",
            id: latestVodId.toString(),
            // season: this.vod_season || "",
            // absolute_season: this.vod_absolute_season ? this.vod_absolute_season.toString().padStart(2, "0") : "",
            // episode: this.vod_episode ? this.vod_episode.toString().padStart(2, "0") : "",
            // absolute_episode: this.vod_absolute_episode ? this.vod_absolute_episode.toString().padStart(2, "0") : "",

            // TODO: add season and episode
            season: "",
            absolute_season: "",
            episode: "",
            absolute_episode: "",

            title: latestVodData.title,
            game_name: "", // not exposed by twitch api
        };

        const vod_filename_base = sanitize(
            formatString(
                Config.getInstance().cfg("filename_vod"),
                vod_filename_template_variables
            )
        );

        const basename = `${vod_filename_base}`;

        const video_file_path = path.join(
            basepath,
            `${basename}.${Config.getInstance().cfg("vod_container", "mp4")}`
        );

        let success;

        try {
            success = await TwitchVOD.downloadVideo(
                latestVodData.id,
                quality,
                video_file_path
            );
        } catch (e) {
            throw new Error(`Failed to download vod: ${(e as Error).message}`);
        }

        if (!success) {
            throw new Error("Failed to download vod");
        }

        const vod = await this.createVOD(
            path.join(basepath, `${basename}.json`)
        );
        vod.started_at = parseJSON(latestVodData.created_at);

        const duration = TwitchHelper.parseTwitchDuration(
            latestVodData.duration
        );
        vod.ended_at = new Date(vod.started_at.getTime() + duration * 1000);
        await vod.saveJSON("manual creation");

        await vod.addSegment(path.basename(video_file_path));
        await vod.finalize();
        await vod.saveJSON("manual finalize");

        Webhook.dispatchAll("end_download", {
            vod: await vod.toAPI(),
        });

        return video_file_path;
    }

    /**
     * Get videos (shortcut for TwitchVOD.getVideos)
     */
    public async getVideos() {
        if (!this.internalId) return false;
        return await TwitchVOD.getLatestVideos(this.internalId);
    }

    /**
     * Get clips (shortcut for TwitchVOD.getClips)
     */
    public async getClips(max_age?: number, limit?: number) {
        if (!this.internalId) return false;
        return await TwitchVOD.getClips(
            { broadcaster_id: this.internalId },
            max_age,
            limit
        );
    }

    fileWatcher?: chokidar.FSWatcher;
    /**
     * @test disable
     * @returns
     */
    public async startWatching() {
        if (this.fileWatcher) await this.stopWatching();

        // no blocks in testing
        // if (process.env.NODE_ENV === "test") return;

        if (!Config.getInstance().cfg("channel_folders")) {
            log(
                LOGLEVEL.WARNING,
                "tw.channel.startWatching",
                `Channel folders are disabled, not watching channel ${this.internalName}`
            );
            return; // don't watch if no channel folders are enabled
        }

        const folders = [Helper.vodFolder(this.internalName)];

        // if (this.login && fs.existsSync(path.join(BaseConfigDataFolder.saved_clips, "scheduler", this.login)))
        //     folders.push(path.join(BaseConfigDataFolder.saved_clips, "scheduler", this.login));

        // if (this.login && fs.existsSync(path.join(BaseConfigDataFolder.saved_clips, "downloader", this.login)))
        //     folders.push(path.join(BaseConfigDataFolder.saved_clips, "downloader", this.login));

        console.log(`Watching channel ${this.internalName} folders...`);

        this.fileWatcher = chokidar
            .watch(folders, {
                ignoreInitial: true,
            })
            .on("all", (eventType, filename) => {
                if (eventType === "add") {
                    if (Config.getInstance().cfg("localvideos.enabled")) {
                        const allVodFiles = this.getVods()
                            .map((v) =>
                                v.associatedFiles.map((f) => path.basename(f))
                            )
                            .flat();

                        if (allVodFiles.includes(filename)) {
                            return; // skip actual vods
                        }

                        if (!filename.endsWith(".mp4")) return;

                        if (eventType === "add") {
                            this.addLocalVideo(path.basename(filename));
                        }
                    }
                } else if (eventType === "unlink") {
                    this.video_list = this.video_list.filter(
                        (v) => v.basename !== path.basename(filename)
                    );
                    this.sortLocalVideos();
                    this.broadcastUpdate();
                }
            });
    }

    private async addLocalVideo(basename: string): Promise<boolean> {
        const filename = path.join(this.getFolder(), basename);

        let video_metadata: VideoMetadata | AudioMetadata;

        try {
            video_metadata = await videometadata(filename);
        } catch (th) {
            log(
                LOGLEVEL.ERROR,
                "tw.channel.addLocalVideo",
                `Trying to get mediainfo of ${filename} returned: ${
                    (th as Error).message
                }`
            );
            return false;
        }

        if (!video_metadata || video_metadata.type !== "video") {
            log(
                LOGLEVEL.WARNING,
                "tw.channel.addLocalVideo",
                `${filename} is not a local video, not adding`
            );
            return false;
        }

        let thumbnail;
        try {
            thumbnail = await videoThumbnail(filename, 240);
        } catch (error) {
            log(
                LOGLEVEL.ERROR,
                "tw.channel.addLocalVideo",
                `Failed to generate thumbnail for ${filename}: ${error}`
            );
        }

        const video_entry: LocalVideo = {
            basename: basename,
            extension: path.extname(filename).substring(1),
            channel: this.internalName,
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

    public addAllLocalVideos() {
        if (!Config.getInstance().cfg("channel_folders")) return; // don't watch if no channel folders are enabled
        if (!Config.getInstance().cfg("localvideos.enabled")) return;
        const folder = this.getFolder();
        const files = fs.readdirSync(folder);
        const allVodFiles = this.getVods()
            .map((v) => v.associatedFiles.map((f) => path.basename(f)))
            .flat();
        for (const file of files) {
            if (!file.endsWith(".mp4")) continue;
            if (allVodFiles.includes(path.basename(file))) continue;
            // console.debug(`Adding local video ${file} for channel ${this.internalName}`);
            this.addLocalVideo(path.basename(file));
        }
        // console.log(`Added ${this.video_list.length} local videos to ${this.internalName}`);
        log(
            LOGLEVEL.INFO,
            "tw.channel.addAllLocalVideos",
            `Added ${this.video_list.length} local videos to ${this.internalName}`
        );
    }

    /**
     *
     * STATIC
     *
     */

    public static async loadAbstract(
        channel_id: string
    ): Promise<TwitchChannel> {
        log(
            LOGLEVEL.DEBUG,
            "tw.channel.loadAbstract",
            `Load channel ${channel_id}`
        );

        const channel_memory = LiveStreamDVR.getInstance()
            .getChannels()
            .find<TwitchChannel>(
                (channel): channel is TwitchChannel =>
                    isTwitchChannel(channel) &&
                    channel.internalId === channel_id
            );
        if (channel_memory) {
            log(
                LOGLEVEL.WARNING,
                "tw.channel.loadAbstract",
                `Channel ${channel_id} already loaded`
            );
            return channel_memory;
        }

        const channel = new this();
        channel.userid = channel_id;

        const channel_data = await this.getUserDataById(channel_id);
        if (!channel_data)
            throw new Error(
                `Could not get channel data for channel id: ${channel_id}`
            );

        const channel_login = channel_data.login;

        const channel_config = LiveStreamDVR.getInstance().channels_config.find(
            (c) => c.provider == "twitch" && c.login === channel_login
        );
        if (!channel_config)
            throw new Error(
                `Could not find channel config in memory for channel login: ${channel_login}`
            );

        channel.uuid = channel_config.uuid;
        channel.channel_data = channel_data;
        channel.config = channel_config;

        if (!channel.uuid) {
            throw new Error(`Channel ${channel_login} has no uuid`);
        }

        channel.login = channel_data.login;
        channel.display_name = channel_data.display_name;
        // channel.description = channel_data.description;
        // channel.profile_image_url = channel_data.profile_image_url;
        channel.broadcaster_type = channel_data.broadcaster_type;
        channel.applyConfig(channel_config);

        if (
            await KeyValue.getInstance().getBoolAsync(
                `${channel.internalName}.online`
            )
        ) {
            log(
                LOGLEVEL.WARNING,
                "tw.channel.loadAbstract",
                `Channel ${channel.internalName} is online, stale?`
            );
        }

        if (
            await KeyValue.getInstance().hasAsync(
                `${channel.internalName}.channeldata`
            )
        ) {
            log(
                LOGLEVEL.WARNING,
                "tw.channel.loadAbstract",
                `Channel ${channel.internalName} has stale chapter data.`
            );
        }

        if ((channel.channel_data as any).cache_avatar) {
            log(
                LOGLEVEL.WARNING,
                "tw.channel.loadAbstract",
                `Channel ${channel.internalName} has stale avatar data.`
            );
            channel.channel_data.avatar_thumb = (
                channel.channel_data as any
            ).cache_avatar;
        }

        if (
            channel.channel_data.profile_image_url &&
            !channel.channelLogoExists
        ) {
            log(
                LOGLEVEL.INFO,
                "tw.channel.loadAbstract",
                `Channel ${channel.internalName} has no logo during load, fetching`
            );
            await this.fetchChannelLogo(channel.channel_data);
        }

        // $channel->api_getSubscriptionStatus = $channel->getSubscriptionStatus();

        channel.makeFolder();

        try {
            channel.deleteEmptyVodFolders();
        } catch (error) {
            log(
                LOGLEVEL.WARNING,
                "tw.channel.loadAbstract",
                `Failed to delete empty vod folders for ${channel.internalName}: ${error}`
            );
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

        // await channel.parseVODs();

        await channel.findClips();

        channel.saveKodiNfo();

        try {
            await channel.updateChapterData();
        } catch (error) {
            log(
                LOGLEVEL.ERROR,
                "tw.channel.loadAbstract",
                `Failed to update chapter data for channel ${
                    channel.internalName
                }: ${(error as Error).message}`
            );
        }

        return channel;
    }

    /**
     * Create and insert channel in memory. Subscribe too.
     *
     * @param config
     * @returns
     */
    public static async create(
        config: z.infer<typeof TwitchChannelConfig>
    ): Promise<TwitchChannel> {
        const exists_config = LiveStreamDVR.getInstance().channels_config.find(
            (ch) => ch.provider == "twitch" && ch.login === config.login
        );
        if (exists_config)
            throw new Error(`Channel ${config.login} already exists in config`);

        // const exists_channel = TwitchChannel.channels.find(ch => ch.login === config.login);
        const exists_channel = LiveStreamDVR.getInstance()
            .getChannels()
            .find<TwitchChannel>(
                (channel): channel is TwitchChannel =>
                    isTwitchChannel(channel) &&
                    channel.internalName === config.login
            );
        if (exists_channel)
            throw new Error(
                `Channel ${config.login} already exists in channels`
            );

        const data = await TwitchChannel.getUserDataByLogin(config.login);
        if (!data)
            throw new Error(
                `Could not get channel data for channel login: ${config.login}`
            );

        config.uuid = randomUUID();

        LiveStreamDVR.getInstance().channels_config.push(config);
        LiveStreamDVR.getInstance().saveChannelsConfig();

        const channel = await TwitchChannel.loadFromLogin(config.login);
        if (!channel || !channel.userid)
            throw new Error(`Channel ${config.login} could not be loaded`);

        if (
            Config.getInstance().cfg<string>("app_url", "") !== "" &&
            Config.getInstance().cfg<string>("app_url", "") !== "debug" &&
            !Config.getInstance().cfg<boolean>("isolated_mode")
        ) {
            try {
                await channel.subscribe();
            } catch (error) {
                log(
                    LOGLEVEL.ERROR,
                    "tw.channel.create",
                    `Failed to subscribe to channel ${channel.internalName}: ${
                        (error as Error).message
                    }`
                );
                LiveStreamDVR.getInstance().channels_config =
                    LiveStreamDVR.getInstance().channels_config.filter(
                        (ch) =>
                            ch.provider == "twitch" && ch.login !== config.login
                    ); // remove channel from config
                LiveStreamDVR.getInstance().saveChannelsConfig();
                // throw new Error(`Failed to subscribe to channel ${channel.login}: ${(error as Error).message}`, { cause: error });
                throw error; // rethrow error
            }
        } else if (Config.getInstance().cfg("app_url") == "debug") {
            log(
                LOGLEVEL.WARNING,
                "tw.channel.create",
                `Not subscribing to ${channel.internalName} due to debug app_url.`
            );
        } else if (Config.getInstance().cfg("isolated_mode")) {
            log(
                LOGLEVEL.WARNING,
                "tw.channel.create",
                `Not subscribing to ${channel.internalName} due to isolated mode.`
            );
        } else {
            log(
                LOGLEVEL.ERROR,
                "tw.channel.create",
                `Can't subscribe to ${channel.internalName} due to either no app_url or isolated mode disabled.`
            );
            LiveStreamDVR.getInstance().channels_config =
                LiveStreamDVR.getInstance().channels_config.filter(
                    (ch) => ch.provider == "twitch" && ch.login !== config.login
                ); // remove channel from config
            LiveStreamDVR.getInstance().saveChannelsConfig();
            throw new Error(
                "Can't subscribe due to either no app_url or isolated mode disabled."
            );
        }

        LiveStreamDVR.getInstance().addChannel(channel);

        if (TwitchHelper.hasAxios()) {
            // bad hack?
            const streams = await TwitchChannel.getStreams(channel.internalId);
            if (streams && streams.length > 0) {
                await KeyValue.getInstance().setBoolAsync(
                    `${channel.internalName}.online`,
                    true
                );
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

        logAdvanced(LOGLEVEL.INFO, "channel", "Loading channel configs...");

        const data: ChannelConfig[] = JSON.parse(fs.readFileSync(BaseConfigPath.channel, "utf8"));

        let needsSave = false;
        for (const channel of data) {
            if (!("quality" in channel) || !channel.quality) {
                logAdvanced(LOGLEVEL.WARNING, "channel", `Channel ${channel.login} has no quality set, setting to default`);
                channel.quality = ["best"];
                needsSave = true;
            }
        }

        this.channels_config = data;

        logAdvanced(LOGLEVEL.SUCCESS, "channel", `Loaded ${this.channels_config.length} channel configs!`);

        if (needsSave) {
            this.saveChannelsConfig();
        }

        if (Config.getInstance().cfg("channel_folders")) {
            const folders = fs.readdirSync(BaseConfigDataFolder.vod);
            for (const folder of folders) {
                if (folder == ".gitkeep") continue;
                if (!this.channels_config.find(ch => ch.login === folder)) {
                    logAdvanced(LOGLEVEL.WARNING, "channel", `Channel folder ${folder} is not in channel config, left over?`);
                }
            }
        }

        return true;

    }
    */

    // public static saveChannelsConfig(): boolean {
    //     logAdvanced(LOGLEVEL.INFO, "channel", "Saving channel config");
    //     fs.writeFileSync(BaseConfigPath.channel, JSON.stringify(this.channels_config, null, 4));
    //     return fs.existsSync(BaseConfigPath.channel) && fs.readFileSync(BaseConfigPath.channel, "utf8") === JSON.stringify(this.channels_config, null, 4);
    // }

    /**
     * Load channel cache into memory, like usernames and id's.
     * @test disable
     */
    public static loadChannelsCache(): boolean {
        if (!fs.existsSync(BaseConfigPath.streamerCache)) return false;

        const data = fs.readFileSync(BaseConfigPath.streamerCache, "utf8");
        this.channels_cache = JSON.parse(data);
        log(
            LOGLEVEL.SUCCESS,
            "tw.channel.loadChannelsCache",
            `Loaded ${
                Object.keys(this.channels_cache).length
            } channels from cache.`
        );
        return true;
    }

    /**
     * Load channels into memory
     *
     * @returns Amount of loaded channels
     */
    /*
    public static async loadChannels(): Promise<number> {
        logAdvanced(LOGLEVEL.INFO, "channel", "Loading channels...");
        if (this.channels_config.length > 0) {
            for (const channel of this.channels_config) {

                let ch: TwitchChannel;

                try {
                    ch = await TwitchChannel.loadFromLogin(channel.login);
                } catch (th) {
                    logAdvanced(LOGLEVEL.FATAL, "config", `Channel ${channel.login} could not be loaded: ${th}`);
                    continue;
                    // break;
                }

                if (ch) {
                    this.channels.push(ch);
                    ch.postLoad();
                    ch.vods_list.forEach(vod => vod.postLoad());
                    logAdvanced(LOGLEVEL.SUCCESS, "config", `Loaded channel ${channel.login} with ${ch.vods_list?.length} vods`);
                    if (ch.no_capture) {
                        logAdvanced(LOGLEVEL.WARNING, "config", `Channel ${channel.login} is configured to not capture streams.`);
                    }
                } else {
                    logAdvanced(LOGLEVEL.FATAL, "config", `Channel ${channel.login} could not be added, please check logs.`);
                    break;
                }
            }
        }
        logAdvanced(LOGLEVEL.SUCCESS, "channel", `Loaded ${this.channels.length} channels!`);
        return this.channels.length;
    }
    */

    public static getChannels(): TwitchChannel[] {
        // return this.channels;
        return (
            LiveStreamDVR.getInstance()
                .getChannels()
                .filter<TwitchChannel>((channel): channel is TwitchChannel =>
                    isTwitchChannel(channel)
                ) || []
        );
    }

    public static isType(channel: unknown): channel is TwitchChannel {
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
        return LiveStreamDVR.getInstance()
            .getChannels()
            .find<TwitchChannel>(
                (ch): ch is TwitchChannel =>
                    ch instanceof TwitchChannel && ch.internalName === login
            );
    }

    public static getChannelById(id: string): TwitchChannel | undefined {
        return LiveStreamDVR.getInstance()
            .getChannels()
            .find<TwitchChannel>(
                (ch): ch is TwitchChannel =>
                    ch instanceof TwitchChannel && ch.internalId === id
            );
    }

    public static async getStreams(
        streamer_id: string
    ): Promise<Stream[] | false> {
        let response;

        if (!TwitchHelper.hasAxios()) {
            throw new Error("Axios is not initialized");
        }

        try {
            response = await TwitchHelper.getRequest<StreamsResponse>(
                "/helix/streams",
                {
                    params: {
                        user_id: streamer_id,
                    } as StreamRequestParams,
                }
            );
        } catch (error) {
            log(
                LOGLEVEL.ERROR,
                "tw.channel.getStreams",
                `Could not get streams for ${streamer_id}: ${error}`
            );
            return false;
        }

        const json = response.data;

        if (!json.data) {
            log(
                LOGLEVEL.ERROR,
                "tw.channel.getStreams",
                `No streams found for user id ${streamer_id}`
            );
            return false;
        }

        log(
            LOGLEVEL.INFO,
            "tw.channel.getStreams",
            `Querying streams for streamer id ${streamer_id} returned ${json.data.length} streams`
        );

        return json.data ?? false;
    }

    /**
     * Load channel class using login, don't call this. Used internally.
     *
     * @internal
     * @param login
     * @returns
     */
    public static async loadFromLogin(login: string): Promise<TwitchChannel> {
        if (!login) throw new Error("Streamer login is empty");
        if (typeof login !== "string")
            throw new TypeError("Streamer login is not a string");
        log(
            LOGLEVEL.DEBUG,
            "tw.channel.loadFromLogin",
            `Load from login ${login}`
        );
        const channel_id = await this.channelIdFromLogin(login);
        if (!channel_id)
            throw new Error(`Could not get channel id from login: ${login}`);
        return this.loadAbstract(channel_id); // $channel;
    }

    public static async channelIdFromLogin(
        login: string
    ): Promise<string | false> {
        const channelData = await this.getUserDataByLogin(login, false);
        return channelData ? channelData.id : false;
    }

    public static async channelLoginFromId(
        channel_id: string
    ): Promise<string | false> {
        const channelData = await this.getUserDataById(channel_id, false);
        return channelData ? channelData.login : false;
    }

    public static async channelDisplayNameFromId(
        channel_id: string
    ): Promise<string | false> {
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
    public static async getUserDataById(
        channel_id: string,
        force = false
    ): Promise<UserData | false> {
        return await this.getUserDataProxy("id", channel_id, force);
    }

    /**
     * Get user data using the channel login, not the display name
     * @param login
     * @param force
     * @throws
     * @returns
     */
    public static async getUserDataByLogin(
        login: string,
        force = false
    ): Promise<UserData | false> {
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
     * @test disable
     * @returns
     */
    static async getUserDataProxy(
        method: "id" | "login",
        identifier: string,
        force: boolean
    ): Promise<UserData | false> {
        log(
            LOGLEVEL.DEBUG,
            "tw.channel.getUserDataProxy",
            `Fetching user data for ${method} ${identifier}, force: ${force}`
        );

        // check cache first
        if (!force) {
            const channelData =
                method == "id"
                    ? this.channels_cache[identifier]
                    : Object.values(this.channels_cache).find(
                          (channel) => channel.login == identifier
                      );
            if (channelData) {
                log(
                    LOGLEVEL.DEBUG,
                    "tw.channel.getUserDataProxy",
                    `User data found in memory cache for ${method} ${identifier}`
                );
                if (
                    Date.now() >
                    channelData._updated + Config.streamerCacheTime
                ) {
                    log(
                        LOGLEVEL.INFO,
                        "tw.channel.getUserDataProxy",
                        `Memory cache for ${identifier} is outdated, fetching new data`
                    );
                } else {
                    log(
                        LOGLEVEL.DEBUG,
                        "tw.channel.getUserDataProxy",
                        `Returning memory cache for ${method} ${identifier}`
                    );
                    return channelData;
                }
            } else {
                log(
                    LOGLEVEL.DEBUG,
                    "tw.channel.getUserDataProxy",
                    `User data not found in memory cache for ${method} ${identifier}, continue fetching`
                );
            }

            if (
                await KeyValue.getInstance().hasAsync(`${identifier}.deleted`)
            ) {
                log(
                    LOGLEVEL.WARNING,
                    "tw.channel.getUserDataProxy",
                    `Channel ${identifier} is deleted, ignore. Delete kv file to force update.`
                );
                return false;
            }
        }

        /*
        const access_token = await TwitchHelper.getAccessToken();

        if (!access_token) {
            logAdvanced(LOGLEVEL.ERROR, "channel", "Could not get access token, aborting.");
            throw new Error("Could not get access token, aborting.");
        }
        */

        if (!TwitchHelper.hasAxios()) {
            throw new Error("Axios is not initialized");
        }

        let response;

        try {
            response = await TwitchHelper.getRequest<
                UsersResponse | ErrorResponse
            >(`/helix/users?${method}=${identifier}`);
        } catch (err) {
            if (axios.isAxiosError(err)) {
                // logAdvanced(LOGLEVEL.ERROR, "channel", `Could not get channel data for ${method} ${identifier}: ${err.message} / ${err.response?.data.message}`, err);
                // return false;
                if (err.response && err.response.status === 404) {
                    // throw new Error(`Could not find channel data for ${method} ${identifier}, server responded with 404`);
                    log(
                        LOGLEVEL.ERROR,
                        "tw.channel.getUserDataProxy",
                        `Could not find user data for ${method} ${identifier}, server responded with 404`
                    );
                    return false;
                }
                throw new Error(
                    `Could not get user data for ${method} ${identifier} axios error: ${
                        (err as Error).message
                    }`
                );
            }

            log(
                LOGLEVEL.ERROR,
                "tw.channel.getUserDataProxy",
                `User data request for ${identifier} exceptioned: ${err}`,
                err
            );
            console.log(err);
            return false;
        }

        // TwitchlogAdvanced(LOGLEVEL.INFO, "channel", `URL: ${response.request.path} (default ${axios.defaults.baseURL})`);

        if (response.status !== 200) {
            log(
                LOGLEVEL.ERROR,
                "tw.channel.getUserDataProxy",
                `Could not get user data for ${identifier}, code ${response.status}.`
            );
            throw new Error(
                `Could not get user data for ${identifier}, code ${response.status}.`
            );
        }

        const json = response.data;

        if ("error" in json) {
            log(
                LOGLEVEL.ERROR,
                "tw.channel.getUserDataProxy",
                `Could not get user data for ${identifier}: ${json.message}`
            );
            return false;
        }

        if (json.data.length === 0) {
            log(
                LOGLEVEL.ERROR,
                "tw.channel.getUserDataProxy",
                `Could not get user data for ${identifier}, no data.`,
                { json }
            );
            throw new Error(
                `Could not get user data for ${identifier}, no data.`
            );
        }

        const data = json.data[0];

        // use as ChannelData
        const userData = data as unknown as UserData;

        userData._updated = Date.now();

        // download channel logo
        if (userData.profile_image_url) {
            await TwitchChannel.fetchChannelLogo(userData);
        } else {
            log(
                LOGLEVEL.WARNING,
                "tw.channel.getUserDataProxy",
                `User ${userData.id} has no profile image url`
            );
        }

        if (userData.offline_image_url) {
            const offline_filename = `${userData.id}${path.extname(
                userData.offline_image_url
            )}`;
            const offline_path = path.join(
                BaseConfigCacheFolder.public_cache_banners,
                offline_filename
            );
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
                log(
                    LOGLEVEL.ERROR,
                    "tw.channel.getUserDataProxy",
                    `Could not download user offline image for ${
                        userData.id
                    }: ${(error as Error).message}`,
                    error
                );
            }
            if (offline_response && offline_response.data instanceof Readable) {
                offline_response.data.pipe(fs.createWriteStream(offline_path));
                userData.cache_offline_image = offline_filename;
            } else {
                log(
                    LOGLEVEL.ERROR,
                    "tw.channel.getUserDataProxy",
                    `Could not download offline image for ${userData.id}, data is not readable`
                );
            }
        }

        // insert into memory and save to file
        // console.debug(`Inserting user data for ${method} ${identifier} into cache and file`);
        TwitchChannel.channels_cache[userData.id] = userData;
        fs.writeFileSync(
            BaseConfigPath.streamerCache,
            JSON.stringify(TwitchChannel.channels_cache)
        );

        return userData;
    }

    private static async fetchChannelLogo(userData: UserData) {
        log(
            LOGLEVEL.INFO,
            "tw.channel.fetchChannelLogo",
            `Fetching channel logo for ${userData.id} (${userData.login})`
        );

        const logo_filename = `${userData.id}${path.extname(
            userData.profile_image_url
        )}`;

        const logo_path = path.join(
            BaseConfigCacheFolder.public_cache_avatars,
            logo_filename
        );

        if (fs.existsSync(logo_path)) {
            fs.unlinkSync(logo_path);
            log(
                LOGLEVEL.DEBUG,
                "tw.channel.fetchChannelLogo",
                `Deleted old avatar for ${userData.id}`
            );
        }

        let avatar_response: AxiosResponse<Readable> | undefined;

        try {
            avatar_response = await axios({
                url: userData.profile_image_url,
                method: "GET",
                responseType: "stream",
            });
        } catch (error) {
            log(
                LOGLEVEL.ERROR,
                "tw.channel.fetchChannelLogo",
                `Could not download user logo for ${userData.id}: ${
                    (error as Error).message
                }`,
                error
            );
        }

        if (avatar_response) {
            log(
                LOGLEVEL.DEBUG,
                "tw.channel.fetchChannelLogo",
                `Fetched avatar for ${userData.id}`
            );

            await pipeline(
                avatar_response.data,
                fs.createWriteStream(logo_path)
            );

            log(
                LOGLEVEL.DEBUG,
                "tw.channel.fetchChannelLogo",
                `Saved avatar for ${userData.id}`
            );

            if (fs.existsSync(logo_path) && fs.statSync(logo_path).size > 0) {
                userData.avatar_cache = logo_filename;

                // make thumbnails

                log(
                    LOGLEVEL.DEBUG,
                    "tw.channel.fetchChannelLogo",
                    `Create thumbnail for ${userData.id}`
                );

                let avatar_thumbnail;
                try {
                    avatar_thumbnail = await imageThumbnail(logo_path, 64);
                } catch (error) {
                    log(
                        LOGLEVEL.ERROR,
                        "tw.channel.fetchChannelLogo",
                        `Could not create thumbnail for user logo for ${
                            userData.id
                        }: ${(error as Error).message}`,
                        error
                    );
                }

                if (avatar_thumbnail) {
                    userData.avatar_thumb = avatar_thumbnail;
                    log(
                        LOGLEVEL.DEBUG,
                        "tw.channel.fetchChannelLogo",
                        `Created thumbnail for user logo for ${userData.id}`
                    );
                } else {
                    log(
                        LOGLEVEL.ERROR,
                        "tw.channel.fetchChannelLogo",
                        `Could not create thumbnail for user logo for ${userData.id}`
                    );
                }

                TwitchChannel.channels_cache[userData.id] = userData; // TODO: is this a good idea
            } else {
                log(
                    LOGLEVEL.ERROR,
                    "tw.channel.fetchChannelLogo",
                    `Could not find downloaded avatar for ${userData.id}`
                );
            }
        }
    }

    /**
     * Get channel data from api using either id or login, a helper
     * function for getChannelDataById and getChannelDataByLogin.
     *
     * @internal
     * @throws
     * @returns
     * @param broadcaster_id
     */
    static async getChannelDataById(
        broadcaster_id: string
    ): Promise<Channel | false> {
        log(
            LOGLEVEL.DEBUG,
            "tw.channel.getChannelDataById",
            `Fetching channel data for ${broadcaster_id}`
        );

        if (!TwitchHelper.hasAxios()) {
            throw new Error("Axios is not initialized");
        }

        let response;

        try {
            response = await TwitchHelper.getRequest<
                ChannelsResponse | ErrorResponse
            >(`/helix/channels?broadcaster_id=${broadcaster_id}`);
        } catch (err) {
            if (axios.isAxiosError(err)) {
                // logAdvanced(LOGLEVEL.ERROR, "channel", `Could not get channel data for ${method} ${identifier}: ${err.message} / ${err.response?.data.message}`, err);
                // return false;
                if (err.response && err.response.status === 404) {
                    // throw new Error(`Could not find channel data for ${method} ${identifier}, server responded with 404`);
                    log(
                        LOGLEVEL.ERROR,
                        "tw.channel.getChannelDataById",
                        `Could not find user data for ${broadcaster_id}, server responded with 404`
                    );
                    return false;
                }
                throw new Error(
                    `Could not get user data for ${broadcaster_id} axios error: ${
                        (err as Error).message
                    }`
                );
            }

            log(
                LOGLEVEL.ERROR,
                "tw.channel.getChannelDataById",
                `User data request for ${broadcaster_id} exceptioned: ${err}`,
                err
            );
            console.log(err);
            return false;
        }

        if (response.status !== 200) {
            log(
                LOGLEVEL.ERROR,
                "tw.channel.getChannelDataById",
                `Could not get user data for ${broadcaster_id}, code ${response.status}.`
            );
            throw new Error(
                `Could not get user data for ${broadcaster_id}, code ${response.status}.`
            );
        }

        const json = response.data;

        if ("error" in json) {
            log(
                LOGLEVEL.ERROR,
                "tw.channel.getChannelDataById",
                `Could not get user data for ${broadcaster_id}: ${json.message}`
            );
            return false;
        }

        if (json.data.length === 0) {
            log(
                LOGLEVEL.ERROR,
                "tw.channel.getChannelDataById",
                `Could not get user data for ${broadcaster_id}, no data.`,
                { json }
            );
            throw new Error(
                `Could not get user data for ${broadcaster_id}, no data.`
            );
        }

        return json.data[0];
    }

    public static channelDataToChapterData(
        channelData: Channel
    ): TwitchVODChapterJSON {
        const game = channelData.game_id
            ? TwitchGame.getGameFromCache(channelData.game_id)
            : undefined;
        return {
            started_at: JSON.stringify(new Date()),
            title: channelData.title,

            game_id: channelData.game_id,
            game_name: channelData.game_name,
            box_art_url: game ? game.box_art_url : undefined,

            is_mature: false,
            online: false,
            // viewer_count:
        };
    }

    public async subscribe(force = false): Promise<boolean> {
        if (Config.getInstance().cfg("twitchapi.eventsub_type") === "webhook") {
            return await TwitchChannel.subscribeToIdWithWebhook(
                this.internalId,
                force
            );
        } else {
            return await TwitchChannel.subscribeToIdWithWebsocket(
                this.internalId,
                force
            );
        }
    }

    /**
     * @test disable
     * @param channel_id
     * @param force
     * @throws
     */
    public static async subscribeToIdWithWebhook(
        channel_id: string,
        force = false
    ): Promise<boolean> {
        if (!Config.getInstance().hasValue("app_url")) {
            throw new Error("app_url is not set");
        }

        if (Config.getInstance().cfg("app_url") === "debug") {
            throw new Error(
                "app_url is set to debug, no subscriptions possible"
            );
        }

        let hook_callback = `${Config.getInstance().cfg(
            "app_url"
        )}/api/v0/hook/twitch`;

        if (Config.getInstance().hasValue("instance_id")) {
            hook_callback +=
                "?instance=" + Config.getInstance().cfg("instance_id");
        }

        if (!Config.getInstance().hasValue("eventsub_secret")) {
            throw new Error("eventsub_secret is not set");
        }

        const streamer_login = await TwitchChannel.channelLoginFromId(
            channel_id
        );

        for (const sub_type of TwitchHelper.CHANNEL_SUB_TYPES) {
            if (
                (await KeyValue.getInstance().hasAsync(
                    `${channel_id}.sub.${sub_type}`
                )) &&
                !force
            ) {
                log(
                    LOGLEVEL.INFO,
                    "tw.ch.subWebhook",
                    `Skip subscription to ${channel_id}:${sub_type} (${streamer_login}), in cache.`
                );
                continue; // todo: alert
            }

            log(
                LOGLEVEL.INFO,
                "tw.ch.subWebhook",
                `Subscribe to ${channel_id}:${sub_type} (${streamer_login})`
            );

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

            if (!TwitchHelper.hasAxios()) {
                throw new Error("Axios is not initialized");
            }

            let response;

            try {
                response = await TwitchHelper.postRequest<SubscriptionResponse>(
                    "/helix/eventsub/subscriptions",
                    payload
                );
            } catch (err) {
                if (axios.isAxiosError(err)) {
                    log(
                        LOGLEVEL.ERROR,
                        "tw.ch.subWebhook",
                        `Could not subscribe to ${channel_id}:${sub_type}: ${err.message} / ${err.response?.data.message}`
                    );

                    if (err.response?.data.status == 409) {
                        // duplicate
                        const sub_id = await TwitchChannel.getSubscriptionId(
                            channel_id,
                            sub_type
                        );
                        if (sub_id) {
                            await KeyValue.getInstance().setAsync(
                                `${channel_id}.sub.${sub_type}`,
                                sub_id
                            );
                            await KeyValue.getInstance().setAsync(
                                `${channel_id}.substatus.${sub_type}`,
                                SubStatus.SUBSCRIBED
                            );
                        }
                        continue;
                    }

                    continue;
                }

                log(
                    LOGLEVEL.ERROR,
                    "tw.ch.subWebhook",
                    `Subscription request for ${channel_id} exceptioned: ${err}`
                );
                console.log(err);
                continue;
            }

            const json = response.data;
            const http_code = response.status;

            await KeyValue.getInstance().setIntAsync(
                "twitch.max_total_cost",
                json.max_total_cost
            );
            await KeyValue.getInstance().setIntAsync(
                "twitch.total_cost",
                json.total_cost
            );
            await KeyValue.getInstance().setIntAsync(
                "twitch.total",
                json.total
            );

            if (http_code == 202) {
                if (
                    json.data[0].status !==
                    "webhook_callback_verification_pending"
                ) {
                    log(
                        LOGLEVEL.ERROR,
                        "tw.ch.subWebhook",
                        `Got 202 return for subscription request for ${channel_id}:${sub_type} but did not get callback verification.`
                    );
                    return false;
                    // continue;
                }

                await KeyValue.getInstance().setAsync(
                    `${channel_id}.sub.${sub_type}`,
                    json.data[0].id
                );
                await KeyValue.getInstance().setAsync(
                    `${channel_id}.substatus.${sub_type}`,
                    SubStatus.WAITING
                );

                log(
                    LOGLEVEL.INFO,
                    "tw.ch.subWebhook",
                    `Subscribe request for ${channel_id}:${sub_type} (${streamer_login}) sent, awaiting response...`
                );

                await new Promise((resolve, reject) => {
                    let kvResponse: boolean | undefined = undefined;
                    KeyValue.getInstance().once("set", (key, value) => {
                        if (
                            key === `${channel_id}.substatus.${sub_type}` &&
                            value === SubStatus.SUBSCRIBED
                        ) {
                            log(
                                LOGLEVEL.SUCCESS,
                                "tw.ch.subWebhook",
                                `Subscription for ${channel_id}:${sub_type} (${streamer_login}) active.`
                            );
                            kvResponse = true;
                            resolve(true);
                            return;
                        } else if (
                            key === `${channel_id}.substatus.${sub_type}` &&
                            value === SubStatus.FAILED
                        ) {
                            log(
                                LOGLEVEL.ERROR,
                                "tw.ch.subWebhook",
                                `Subscription for ${channel_id}:${sub_type} (${streamer_login}) failed.`
                            );
                            kvResponse = true;
                            reject(
                                new Error(
                                    "Subscription failed, check logs for details."
                                )
                            );
                            return;
                        } else if (
                            key === `${channel_id}.substatus.${sub_type}` &&
                            value === SubStatus.WAITING
                        ) {
                            // this one shouldn't happen?
                            log(
                                LOGLEVEL.ERROR,
                                "tw.ch.subWebhook",
                                `Subscription for ${channel_id}:${sub_type} (${streamer_login}) failed, no response received.`
                            );
                            kvResponse = true;
                            reject(
                                new Error(
                                    "Subscription failed, check logs for details."
                                )
                            );
                            return;
                        }
                        kvResponse = false;
                        reject(new Error("Unknown error"));
                    });
                    // timeout and reject, remove if we get a response
                    xTimeout(() => {
                        if (kvResponse === undefined) {
                            log(
                                LOGLEVEL.ERROR,
                                "tw.ch.subWebhook",
                                `Subscription for ${channel_id}:${sub_type} (${streamer_login}) failed, no response received within 10 seconds.`
                            );
                            reject(
                                new Error(
                                    "Timeout, no response received within 10 seconds."
                                )
                            );
                        }
                    }, 10000);
                });
            } else if (http_code == 409) {
                log(
                    LOGLEVEL.ERROR,
                    "tw.ch.subWebhook",
                    `Duplicate sub for ${channel_id}:${sub_type} detected.`
                );
            } else {
                log(
                    LOGLEVEL.ERROR,
                    "tw.ch.subWebhook",
                    `Failed to send subscription request for ${channel_id}:${sub_type}: ${json}, HTTP ${http_code})`
                );
                // return false;
                // continue;
                throw new Error(
                    `Failed to send subscription request for ${channel_id}:${sub_type}: ${json}, HTTP ${http_code})`
                );
            }
        }

        return true;
    }

    /**
     * @test disable
     * @param channel_id
     */
    public static async unsubscribeFromIdWithWebhook(
        channel_id: string
    ): Promise<boolean> {
        const subscriptions = await TwitchHelper.getSubsList();

        if (!subscriptions) {
            log(
                LOGLEVEL.ERROR,
                "tw.ch.unsubWebhook",
                "Failed to get subscriptions list, or no subscriptions found."
            );
            return false;
        }

        const streamer_login = await TwitchChannel.channelLoginFromId(
            channel_id
        );

        let user_subscriptions_amount = 0;
        let unsubbed = 0;
        for (const sub of subscriptions) {
            if (sub.condition.broadcaster_user_id !== channel_id) {
                continue;
            }

            user_subscriptions_amount++;

            const unsub = await TwitchHelper.eventSubUnsubscribe(sub.id);

            if (unsub) {
                log(
                    LOGLEVEL.SUCCESS,
                    "tw.ch.unsubWebhook",
                    `Unsubscribed from ${channel_id}:${sub.type} (${streamer_login})`
                );
                unsubbed++;
                await KeyValue.getInstance().deleteAsync(
                    `${channel_id}.sub.${sub.type}`
                );
                await KeyValue.getInstance().deleteAsync(
                    `${channel_id}.substatus.${sub.type}`
                );
            } else {
                log(
                    LOGLEVEL.ERROR,
                    "tw.ch.unsubWebhook",
                    `Failed to unsubscribe from ${channel_id}:${sub.type} (${streamer_login})`
                );

                if (
                    await KeyValue.getInstance().hasAsync(
                        `${channel_id}.sub.${sub.type}`
                    )
                ) {
                    await KeyValue.getInstance().deleteAsync(
                        `${channel_id}.sub.${sub.type}`
                    );
                    await KeyValue.getInstance().deleteAsync(
                        `${channel_id}.substatus.${sub.type}`
                    );
                    log(
                        LOGLEVEL.WARNING,
                        "tw.ch.unsubWebhook",
                        `Removed subscription from cache for ${channel_id}:${sub.type} (${streamer_login})`
                    );
                }
            }
        }

        log(
            LOGLEVEL.INFO,
            "tw.ch.unsubWebhook",
            `Unsubscribed from ${unsubbed}/${user_subscriptions_amount} subscriptions for ${channel_id} (${streamer_login})`
        );

        return unsubbed === user_subscriptions_amount;
    }

    /**
     * @test disable
     * @param channel_id
     * @param force
     */
    public static async subscribeToIdWithWebsocket(
        channel_id: string,
        force = false
    ): Promise<boolean> {
        const streamer_login = await TwitchChannel.channelLoginFromId(
            channel_id
        );

        for (const sub_type of TwitchHelper.CHANNEL_SUB_TYPES) {
            let selectedWebsocket: EventWebsocket | undefined = undefined;
            for (const ws of TwitchHelper.eventWebsockets) {
                if (ws.isAvailable(1)) {
                    // estimated cost
                    log(
                        LOGLEVEL.DEBUG,
                        "tw.ch.subscribeToIdWithWebsocket",
                        `Using existing websocket ${ws.id} for ${channel_id}:${sub_type} sub (${streamer_login})`
                    );
                    selectedWebsocket = ws;
                    break;
                }
            }

            if (!selectedWebsocket) {
                // throw new Error("No websocket available for subscription");
                selectedWebsocket = await TwitchHelper.createNewWebsocket(
                    TwitchHelper.eventWebsocketUrl
                );
                log(
                    LOGLEVEL.DEBUG,
                    "tw.ch.subscribeToIdWithWebsocket",
                    `Using new websocket ${selectedWebsocket.id}/${selectedWebsocket.sessionId} for ${channel_id}:${sub_type} sub (${streamer_login})`
                );
            }

            if (!selectedWebsocket) {
                log(
                    LOGLEVEL.ERROR,
                    "tw.ch.subscribeToIdWithWebsocket",
                    `Could not create websocket for ${channel_id}:${sub_type} subscription, aborting`
                );
                throw new Error("Could not create websocket for subscription");
            }

            if (!selectedWebsocket.sessionId) {
                throw new Error(
                    `EventSub session ID is not set on websocket ${selectedWebsocket.id}`
                );
            }

            // if (KeyValue.getInstance().get(`${channel_id}.sub.${sub_type}`) && !force) {
            //     logAdvanced(LOGLEVEL.INFO, "tw.ch.subscribeToIdWithWebsocket", `Skip subscription to ${channel_id}:${sub_type} (${streamer_login}), in cache.`);
            //     continue; // todo: alert
            // }

            log(
                LOGLEVEL.INFO,
                "tw.ch.subscribeToIdWithWebsocket",
                `Subscribe to ${channel_id}:${sub_type} (${streamer_login}) with websocket ${selectedWebsocket.id}/${selectedWebsocket.sessionId}`
            );

            const payload: SubscriptionRequest = {
                type: sub_type,
                version: "1",
                condition: {
                    broadcaster_user_id: channel_id,
                },
                transport: {
                    method: "websocket",
                    session_id: selectedWebsocket.sessionId,
                },
            };

            if (!TwitchHelper.hasAxios()) {
                throw new Error("Axios is not initialized");
            }

            let response;

            try {
                response = await TwitchHelper.postRequest<SubscriptionResponse>(
                    "/helix/eventsub/subscriptions",
                    payload
                );
            } catch (err) {
                if (axios.isAxiosError(err)) {
                    log(
                        LOGLEVEL.ERROR,
                        "tw.ch.subscribeToIdWithWebsocket",
                        `Could not subscribe to ${channel_id}:${sub_type}: ${err.message} / ${err.response?.data.message}`
                    );

                    if (err.response?.status == 409) {
                        // duplicate
                        // const sub_id = await TwitchChannel.getSubscriptionId(channel_id, sub_type);
                        // if (sub_id) {
                        //     KeyValue.getInstance().set(`${channel_id}.sub.${sub_type}`, sub_id);
                        //     KeyValue.getInstance().set(`${channel_id}.substatus.${sub_type}`, SubStatus.SUBSCRIBED);
                        // }
                        console.error(
                            `Duplicate subscription detected for ${channel_id}:${sub_type}`
                        );
                        continue;
                    } else if (err.response?.status == 429) {
                        // rate limit
                        log(
                            LOGLEVEL.ERROR,
                            "tw.ch.subscribeToIdWithWebsocket",
                            `Rate limit hit for ${channel_id}:${sub_type}, skipping`
                        );
                        continue;
                    }

                    continue;
                }

                log(
                    LOGLEVEL.ERROR,
                    "tw.ch.subscribeToIdWithWebsocket",
                    `Subscription request for ${channel_id} exceptioned: ${err}`
                );
                console.log(err);
                continue;
            }

            const json = response.data;
            const http_code = response.status;

            await KeyValue.getInstance().setIntAsync(
                "twitch.ws.max_total_cost",
                json.max_total_cost
            );
            await KeyValue.getInstance().setIntAsync(
                "twitch.ws.total_cost",
                json.total_cost
            );
            await KeyValue.getInstance().setIntAsync(
                "twitch.ws.total",
                json.total
            );

            selectedWebsocket.quotas = {
                max_total_cost: json.max_total_cost,
                total_cost: json.total_cost,
                total: json.total,
            };

            if (http_code == 202) {
                if (json.data[0].status === "enabled") {
                    log(
                        LOGLEVEL.SUCCESS,
                        "tw.ch.subscribeToIdWithWebsocket",
                        `Subscribe for ${channel_id}:${sub_type} (${streamer_login}) successful.`
                    );

                    if (selectedWebsocket) {
                        selectedWebsocket.addSubscription(json.data[0]);
                    } else {
                        log(
                            LOGLEVEL.ERROR,
                            "tw.ch.subscribeToIdWithWebsocket",
                            `Could not find websocket for ${channel_id}:${sub_type}`
                        );
                    }
                } else {
                    log(
                        LOGLEVEL.ERROR,
                        "tw.ch.subscribeToIdWithWebsocket",
                        `Subscribe for ${channel_id}:${sub_type} (${streamer_login}) failed: ${json.data[0].status}`
                    );
                }
            } else if (http_code == 409) {
                log(
                    LOGLEVEL.ERROR,
                    "tw.ch.subscribeToIdWithWebsocket",
                    `Duplicate sub for ${channel_id}:${sub_type} detected.`
                );
            } else {
                log(
                    LOGLEVEL.ERROR,
                    "tw.ch.subscribeToIdWithWebsocket",
                    `Failed to send subscription request for ${channel_id}:${sub_type}: ${json}, HTTP ${http_code})`
                );
                return false;
            }
        }

        return true;
    }

    public static async unsubscribeFromIdWithWebsocket(
        channel_id: string
    ): Promise<boolean> {
        const subscriptions = await TwitchHelper.getSubsList();

        if (!subscriptions) {
            return false;
        }

        const streamer_login = await TwitchChannel.channelLoginFromId(
            channel_id
        );

        let unsubbed = 0;
        for (const sub of subscriptions) {
            if (sub.condition.broadcaster_user_id !== channel_id) {
                continue;
            }

            const unsub = await TwitchHelper.eventSubUnsubscribe(sub.id);

            if (unsub) {
                log(
                    LOGLEVEL.SUCCESS,
                    "tw.ch.unsubscribeToIdWithWebsocket",
                    `Unsubscribed from ${channel_id}:${sub.type} (${streamer_login})`
                );
                unsubbed++;
                // KeyValue.getInstance().delete(`${channel_id}.sub.${sub.type}`);
                // KeyValue.getInstance().delete(`${channel_id}.substatus.${sub.type}`);
                const ws = TwitchHelper.findWebsocketSubscriptionBearer(
                    channel_id,
                    sub.type
                );
                if (ws) {
                    ws.removeSubscription(sub.id);
                }
            } else {
                log(
                    LOGLEVEL.ERROR,
                    "tw.ch.unsubscribeToIdWithWebsocket",
                    `Failed to unsubscribe from ${channel_id}:${sub.type} (${streamer_login})`
                );
            }
        }

        return unsubbed === subscriptions.length;
    }

    public async unsubscribe(): Promise<boolean> {
        // if (Config.getInstance().cfg("app_url") === "debug") {
        //     return false;
        // }
        // return await TwitchChannel.unsubscribeFromIdWithWebhook(this.internalId);
        if (Config.getInstance().cfg("twitchapi.eventsub_type") === "webhook") {
            return await TwitchChannel.unsubscribeFromIdWithWebhook(
                this.internalId
            );
        } else {
            return await TwitchChannel.unsubscribeFromIdWithWebsocket(
                this.internalId
            );
        }
    }

    public static async getSubscriptionId(
        channel_id: string,
        sub_type: EventSubTypes
    ): Promise<string | false> {
        const all_subs = await TwitchHelper.getSubsList();
        if (all_subs) {
            const sub_id = all_subs.find(
                (sub) =>
                    sub.condition.broadcaster_user_id == channel_id &&
                    sub.type == sub_type
            );
            return sub_id ? sub_id.id : false;
        } else {
            return false;
        }
    }

    public static startChatDump(
        name: string,
        channel_login: string,
        channel_id: string,
        started: Date,
        output: string
    ): Job | false {
        const chat_bin = Helper.path_node();
        const chat_cmd: string[] = [];
        const jsfile = path.join(
            AppRoot,
            "twitch-chat-dumper",
            "build",
            "index.js"
        );

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

        log(
            LOGLEVEL.INFO,
            "tw.channel.startChatDump",
            `Starting chat dump with filename ${path.basename(output)}`
        );

        return startJob(`chatdump_${name}`, chat_bin, chat_cmd);
    }

    public getVods(): TwitchVOD[] {
        return this.vods_list;
    }

    public getVodByIndex(index: number): TwitchVOD | undefined {
        if (index < 0 || index >= this.vods_list.length) {
            return undefined;
        }
        return this.vods_list[index];
    }

    public addVod(vod: TwitchVOD): void {
        this.vods_list.push(vod);
    }

    get current_vod(): TwitchVOD | undefined {
        return this.getVods().find((vod) => vod.is_capturing);
    }

    get latest_vod(): TwitchVOD | undefined {
        if (!this.getVods() || this.getVods().length == 0) return undefined;
        return this.getVodByIndex(this.getVods().length - 1); // is this reliable?
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

    get description(): string {
        return this.channel_data?.description || "";
    }

    get profilePictureUrl(): string {
        if (this.channel_data && this.channel_data.avatar_thumb) {
            // return `${Config.getInstance().cfg<string>("basepath", "")}/cache/avatars/${this.channel_data.cache_avatar}`;
            // return `${Config.getInstance().cfg<string>("basepath", "")}/cache/thumbs/${this.channel_data.cache_avatar}`;
            const app_url = Config.getInstance().cfg<string>("app_url", "");
            if (app_url && app_url !== "debug") {
                return `${app_url}/cache/thumbs/${this.channel_data.avatar_thumb}`;
            } else {
                return `${Config.getInstance().cfg<string>(
                    "basepath",
                    ""
                )}/cache/thumbs/${this.channel_data.avatar_thumb}`;
            }
        }
        return this.channel_data?.profile_image_url || "";
    }

    get channelLogoExists(): boolean {
        if (!this.channel_data) return false;
        // const logo_filename_jpg = `${this.channel_data.id}${path.extname(this.channel_data.profile_image_url)}`;
        return (
            fs.existsSync(
                path.join(
                    BaseConfigCacheFolder.public_cache_avatars,
                    `${this.channel_data.id}.jpg`
                )
            ) ||
            fs.existsSync(
                path.join(
                    BaseConfigCacheFolder.public_cache_avatars,
                    `${this.channel_data.id}.png`
                )
            )
        );
    }

    public static async subscribeToAllChannels() {
        console.debug("Subscribing to all channels");
        for (const channel of TwitchChannel.getChannels()) {
            console.debug(`Subscribing to ${channel.internalName}`);
            await channel.subscribe();
            // break; // TODO: remove
        }
    }
}
