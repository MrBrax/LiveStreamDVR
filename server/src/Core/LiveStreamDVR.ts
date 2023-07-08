import chalk from "chalk";
import { compareVersions } from "compare-versions";
import minimist from "minimist";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { Server } from "node:http";
// import { version } from "node:os";
import { BaseVODChapter } from "@/Core/Providers/Base/BaseVODChapter";
import { KickChannel } from "@/Core/Providers/Kick/KickChannel";
import { KickVOD } from "@/Core/Providers/Kick/KickVOD";
import { TwitchChannel } from "@/Core/Providers/Twitch/TwitchChannel";
import { TwitchGame } from "@/Core/Providers/Twitch/TwitchGame";
import { TwitchVOD } from "@/Core/Providers/Twitch/TwitchVOD";
import { TwitchVODChapter } from "@/Core/Providers/Twitch/TwitchVODChapter";
import { YouTubeChannel } from "@/Core/Providers/YouTube/YouTubeChannel";
import { YouTubeVOD } from "@/Core/Providers/YouTube/YouTubeVOD";
import { debugLog } from "@/Helpers/Console";
import { formatBytes } from "@/Helpers/Format";
import { DVRBinaries, DVRPipPackages, getBinaryVersion } from "@/Helpers/Software";
import { clearAllTimeoutsAndIntervals, xClearInterval, xInterval } from "@/Helpers/Timeout";
import { TwitchHelper } from "@/Providers/Twitch";
import { YouTubeHelper } from "@/Providers/YouTube";
import type { BinaryStatus } from "@common/Api/About";
import { ChannelConfig } from "@common/Config";
import { SubStatus } from "@common/Defs";
import checkDiskSpace from "check-disk-space";
import i18next, { t } from "i18next";
import path from "node:path";
import { WebSocket, WebSocketServer } from "ws";
import { version } from "../../package.json";
import { AppRoot, BaseConfigCacheFolder, BaseConfigDataFolder, BaseConfigPath, DataRoot, HomeRoot } from "./BaseConfig";
import { ClientBroker } from "./ClientBroker";
import { Config } from "./Config";
import { Helper } from "./Helper";
import { Job } from "./Job";
import { KeyValue } from "./KeyValue";
import { LOGLEVEL, log, readTodaysLog } from "./Log";
import { Scheduler } from "./Scheduler";
import { Webhook } from "./Webhook";

const argv = minimist(process.argv.slice(2));

export type ChannelTypes = TwitchChannel | YouTubeChannel | KickChannel;
export type VODTypes = TwitchVOD | YouTubeVOD | KickVOD;
export type ChapterTypes = TwitchVODChapter | BaseVODChapter;

export class LiveStreamDVR {
    public static instance: LiveStreamDVR | undefined;
    public static filenameIllegalChars = /[:*?"<>|]/g;

    channels_config: ChannelConfig[] = [];
    private channels: ChannelTypes[] = [];
    private vods: VODTypes[] = [];

    static server: Server;
    static websocketServer: WebSocketServer;
    static shutting_down = false;
    static argv: minimist.ParsedArgs;

    static getInstance(): LiveStreamDVR {
        if (!this.instance) {
            this.instance = new LiveStreamDVR();
        }
        return this.instance;
    }

    static getCleanInstance() {
        return new LiveStreamDVR();
    }

    static destroyInstance() {
        this.instance = undefined;
    }

    /**
     * Initialise entire application, like loading config, creating folders, etc.
     */
    static async init() {

        // Main load
        console.log(chalk.green("Initialising..."));
        console.log(chalk.magenta(`Environment: ${process.env.NODE_ENV}`));
        console.log(chalk.magenta(`Running as user ${process.env.USER}`));

        console.log(`AppRoot: ${AppRoot}`);
        console.log(`DataRoot: ${DataRoot}`);

        if (argv.home && !fs.existsSync(HomeRoot)) {
            fs.mkdirSync(HomeRoot, { recursive: true });
        } else if (!argv.home && !fs.existsSync(DataRoot)) { // create data root, is this a good idea?
            // throw new Error(`DataRoot does not exist: ${DataRoot}`);
            fs.mkdirSync(DataRoot, { recursive: true });
        }

        Config.checkAppRoot();

        Config.checkBuiltDependencies();

        const config = Config.getInstance().config;
        if (config && Object.keys(config).length > 0) {
            // throw new Error("Config already loaded, has init been called twice?");
            console.error(chalk.red("Config already loaded, has init been called twice?"));
            return false;
        }

        Config.getInstance().checkPermissions();

        Config.createFolders();

        if (fs.existsSync(path.join(BaseConfigCacheFolder.cache, "is_running"))) {
            console.error(chalk.red("Application did not exit cleanly, please check logs for more information. Will continue to run."));
        }

        KeyValue.getInstance().load();

        Config.getInstance().loadConfig(); // load config, calls after this will work if config is required

        i18next.changeLanguage(Config.getInstance().cfg("basic.language", "en"));

        await YouTubeHelper.setupClient();

        ClientBroker.loadNotificationSettings();

        Config.getInstance().generateEventSubSecret();

        await TwitchHelper.setupAxios();

        readTodaysLog();

        log(
            LOGLEVEL.SUCCESS,
            "config",
            t("base.bootmessage", new Date().toISOString())
        );

        await Config.getInstance().getGitHash();
        await Config.getInstance().getGitBranch();

        TwitchGame.populateGameDatabase();
        TwitchGame.populateFavouriteGames();
        LiveStreamDVR.getInstance().loadChannelsConfig();
        TwitchChannel.loadChannelsCache();
        YouTubeChannel.loadChannelsCache();
        await LiveStreamDVR.getInstance().loadChannels();
        Job.loadJobsFromCache();

        Config.getInstance().startWatchingConfig();

        Scheduler.defaultJobs();

        await TwitchHelper.setupWebsocket();

        await LiveStreamDVR.getInstance().updateFreeStorageDiskSpace();
        LiveStreamDVR.getInstance().startDiskSpaceInterval();

        await LiveStreamDVR.checkPythonVirtualEnv();

        await LiveStreamDVR.checkBinaryVersions();

        // monitor for program exit
        // let saidGoobye = false;
        // const goodbye = () => {
        //     if (saidGoobye) return;
        //     TwitchlogAdvanced(LOGLEVEL.INFO, "config", "See you next time!");
        //     saidGoobye = true;
        // };
        // process.on("exit", goodbye);
        // process.on("SIGINT", goodbye);
        // process.on("SIGTERM", goodbye);

        log(LOGLEVEL.SUCCESS, "config", "Loading config stuff done.");

        Config.getInstance().initialised = true;

        if (fs.existsSync(BaseConfigCacheFolder.cache)) {
            fs.writeFileSync(path.join(BaseConfigCacheFolder.cache, "is_running"), "true");
        }

        // TwitchHelper.refreshUserAccessToken();

    }

    /**
     * @test disable
     * @returns 
     */
    public loadChannelsConfig(): boolean {

        if (!fs.existsSync(BaseConfigPath.channel)) {
            return false;
        }

        log(LOGLEVEL.INFO, "dvr.loadChannelsConfig", "Loading channel configs...");

        const data: ChannelConfig[] = JSON.parse(fs.readFileSync(BaseConfigPath.channel, "utf8"));

        let needsSave = false;
        for (const channel of data) {
            if ((!("quality" in channel) || !channel.quality) && channel.provider == "twitch") {
                log(LOGLEVEL.WARNING, "dvr.loadChannelsConfig", `Channel ${channel.login} has no quality set, setting to default`);
                channel.quality = ["best"];
                needsSave = true;
            }
            if (!("provider" in channel)) {
                (channel as any).provider = "twitch";
            }
            if (!channel.uuid) {
                channel.uuid = randomUUID();
                log(LOGLEVEL.WARNING, "dvr.loadChannelsConfig", `Channel does not have an UUID, generated: ${channel.uuid}`);
                needsSave = true;
            }
        }

        this.channels_config = data;

        log(LOGLEVEL.SUCCESS, "dvr.loadChannelsConfig", `Loaded ${this.channels_config.length} channel configs!`);

        if (needsSave) {
            this.saveChannelsConfig();
        }

        if (Config.getInstance().cfg("channel_folders")) {
            const folders = fs.readdirSync(BaseConfigDataFolder.vod);
            for (const folder of folders) {
                if (folder == ".gitkeep") continue;
                if (!this.channels_config.find(ch => ch.provider == "twitch" && ch.login === folder)) {
                    log(LOGLEVEL.WARNING, "dvr.loadChannelsConfig", `Channel folder ${folder} is not in channel config, left over?`);
                }
            }
        }

        return true;

    }

    /**
     * Load channels into memory
     * 
     * @returns Amount of loaded channels
     */
    public async loadChannels(): Promise<number> {
        log(LOGLEVEL.INFO, "dvr.loadChannels", "Loading channels...");
        if (this.channels_config.length > 0) {
            for (const channel of this.channels_config) {

                log(LOGLEVEL.INFO, "dvr.loadChannels", `Loading channel ${channel.uuid}, provider ${channel.provider}...`);

                if (!channel.provider || channel.provider == "twitch") {

                    let ch: TwitchChannel;

                    try {
                        ch = await TwitchChannel.loadFromLogin(channel.login);
                    } catch (th) {
                        log(LOGLEVEL.FATAL, "dvr.load.tw", `TW Channel ${channel.login} could not be loaded: ${th}`);
                        console.error(th);
                        continue;
                        // break;
                    }

                    if (ch) {
                        this.addChannel(ch);
                        await ch.postLoad();
                        ch.getVods().forEach(vod => vod.postLoad());
                        log(LOGLEVEL.SUCCESS, "dvr.load.tw", `Loaded channel ${channel.login} with ${ch.getVods().length} vods`);
                        if (ch.no_capture) {
                            log(LOGLEVEL.WARNING, "dvr.load.tw", `Channel ${channel.login} is configured to not capture streams.`);
                        }
                    } else {
                        log(LOGLEVEL.FATAL, "dvr.load.tw", `Channel ${channel.login} could not be added, please check logs.`);
                        break;
                    }

                } else if (channel.provider == "youtube") {

                    let ch: YouTubeChannel;

                    try {
                        ch = await YouTubeChannel.loadFromId(channel.channel_id);
                    } catch (th) {
                        log(LOGLEVEL.FATAL, "dvr.load.yt", `YT Channel ${channel.channel_id} could not be loaded: ${th}`);
                        console.error(th);
                        continue;
                        // break;
                    }

                    if (ch) {
                        this.addChannel(ch);
                        await ch.postLoad();
                        ch.getVods().forEach(vod => vod.postLoad());
                        log(LOGLEVEL.SUCCESS, "dvr.load.yt", `Loaded channel ${ch.displayName} with ${ch.getVods().length} vods`);
                        if (ch.no_capture) {
                            log(LOGLEVEL.WARNING, "dvr.load.yt", `Channel ${ch.displayName} is configured to not capture streams.`);
                        }
                    } else {
                        log(LOGLEVEL.FATAL, "dvr.load.yt", `Channel ${channel.channel_id} could not be added, please check logs.`);
                        break;
                    }

                }
            }
        }
        log(LOGLEVEL.SUCCESS, "dvr.loadChannels", `Loaded ${this.channels.length} channels!`);
        return this.channels.length;
    }

    /**
     * @test disable
     * @returns 
     */
    public saveChannelsConfig(): boolean {
        log(LOGLEVEL.INFO, "dvr", "Saving channel config");
        fs.writeFileSync(BaseConfigPath.channel, JSON.stringify(this.channels_config, null, 4));
        return fs.existsSync(BaseConfigPath.channel) && fs.readFileSync(BaseConfigPath.channel, "utf8") === JSON.stringify(this.channels_config, null, 4);
    }

    public getChannels(): ChannelTypes[] {
        return this.channels;
    }

    public cleanLingeringVODs(): void {
        this.vods.forEach((vod) => {
            const channel = vod.getChannel();
            if (!channel) {
                log(LOGLEVEL.WARNING, "dvr", `Channel ${vod.getChannel().internalName} removed but VOD ${vod.basename} still lingering`);
            }
            if (!fs.existsSync(vod.filename)) {
                log(LOGLEVEL.WARNING, "dvr", `VOD ${vod.basename} in memory but not on disk`);
            }
        });
    }

    public getChannelByUUID<T extends ChannelTypes>(uuid: string): T | false {
        const search = this.channels.find(c => c.uuid == uuid);
        // if (!search) {
        //     console.error(`Channel with UUID ${uuid} not found in list: ${this.channels.map(c => c.uuid).join(", ")}`);
        //     return false;
        // }
        return search as T;
    }

    /**
     * Get channel by internal name aka login. If there are multiple channels with the same login, the first one will be returned.
     * @param login 
     * @returns 
     */
    public getChannelByInternalName<T extends ChannelTypes>(internalName: string): T | false {
        const search = this.channels.find(c => c.internalName == internalName);
        return search as T;
    }

    public addVod(vod: VODTypes): void {
        this.vods.push(vod);
    }

    public addChannel(channel: ChannelTypes): void {
        if (!channel.uuid) {
            log(LOGLEVEL.WARNING, "dvr.addChannel", `Channel ${channel.internalName} does not have an UUID!`);
        }
        this.channels.push(channel);
    }

    public removeChannelByIndex(index: number): void {
        this.channels.splice(index, 1);
    }

    public getVods(): VODTypes[] {
        return this.vods;
    }

    public getVodByUUID<T extends VODTypes>(uuid: string): T | false {
        const search = this.getVods().find(c => c.uuid == uuid);
        if (!search) return false;
        return search as T;
    }

    public getVodsByChannelUUID<T extends VODTypes>(uuid: string): T[] {
        return this.getVods().filter(c => c.channel_uuid == uuid) as T[];
    }

    public removeVodByIndex(index: number): void {
        this.vods.splice(index, 1);
    }

    public removeVodByUUID(uuid: string): void {
        const index = this.vods.findIndex(c => c.uuid == uuid);
        if (index > -1) {
            this.removeVodByIndex(index);
        }
    }

    public removeVodByChannelUUID(uuid: string): void {
        const index = this.vods.findIndex(c => c.channel_uuid == uuid);
        if (index > -1) {
            this.removeVodByIndex(index);
        }
    }

    public removeAllVodsByChannelUUID(uuid: string): void {
        const index = this.vods.findIndex(c => c.channel_uuid == uuid);
        if (index > -1) {
            this.removeVodByIndex(index);
            this.removeAllVodsByChannelUUID(uuid);
        }
    }

    public clearChannels(): void {
        this.channels.forEach(c => c.clearVODs());
        this.channels = [];
    }

    public clearVods(): void {
        this.vods.forEach(vod => vod.stopWatching());
        this.vods = [];
    }


    /**
     * Remove a vod from the vods list.
     * It is not deleted from disk.
     * 
     * @param uuid 
     * @returns 
     */
    public removeVod(uuid: string): boolean {
        const vod = this.getVodByUUID(uuid);
        if (vod) {
            this.vods = this.vods.filter(vod => vod.uuid != uuid);
            log(LOGLEVEL.INFO, "dvr.removeVod", `VOD ${vod.basename} removed from memory!`);
            Webhook.dispatchAll("vod_removed", { basename: vod.basename });
            return true;
        }
        return false;
    }

    public static shutdown(reason: string, doNotActuallyShutdown?: boolean): void {
        this.shutting_down = true;
        console.log(chalk.red(`[${new Date().toISOString()}] Shutting down (${reason})...`));

        if (this.websocketServer) {
            this.websocketServer.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    debugLog(`Closing websocket client connection ${client.url}`);
                    client.close();
                }
            });
        }

        if (this.server) {

            // let timeout: NodeJS.Timeout | undefined = undefined;
            // introduced in node 18.2
            if ("closeAllConnections" in this.server) {
                debugLog("closeAllConnections is available, using it");
                this.server.closeAllConnections();
            } else {
                console.error("closeAllConnections is not available");
                // bad workaround
                /*
                timeout = xTimeout(() => {
                    console.log(chalk.red("Force exiting server, 10 seconds have passed without close event."));
                    if (!doNotActuallyShutdown) process.exit(1);
                }, 10000);*/
            }

        }

        if (this.debugConnectionInterval) {
            clearInterval(this.debugConnectionInterval);
        }

        clearAllTimeoutsAndIntervals();

        // this will not be called until all connections are closed
        if (this.server) {
            this.server.close(async (error) => {
                if (error) {
                    console.error(chalk.red(error));
                } else {
                    debugLog(chalk.red("express server is now down"));
                }
                await this.shutdownRest();
            });
        } else {
            this.shutdownRest();
        }
    }

    private static async shutdownRest(): Promise<void> {
        if (this.websocketServer) this.websocketServer.close();
        Scheduler.removeAllJobs();
        for (const c of LiveStreamDVR.getInstance().channels) {
            await c.stopWatching();
        }
        for (const v of LiveStreamDVR.getInstance().vods) {
            await v.stopWatching();
        }
        for (const j of Job.jobs) {
            await j.kill();
        }
        ClientBroker.wss = undefined;
        Config.getInstance().stopWatchingConfig();
        TwitchHelper.removeAllEventWebsockets();
        // if (timeout !== undefined) clearTimeout(timeout);
        const dsi = LiveStreamDVR.getInstance().diskSpaceInterval;
        if (dsi) xClearInterval(dsi);
        if (fs.existsSync(path.join(BaseConfigCacheFolder.cache, "is_running"))) fs.unlinkSync(path.join(BaseConfigCacheFolder.cache, "is_running"));
        console.log(chalk.red("Finished tasks, bye bye."));
        // process.exit(0);
    }

    /**
     * @test disable
     * @returns 
     */
    public static checkVersion(): void {
        if (fs.existsSync(path.join(BaseConfigCacheFolder.cache))) {
            if (fs.existsSync(path.join(BaseConfigCacheFolder.cache, "currentversion.dat"))) {
                const old_version = fs.readFileSync(path.join(BaseConfigCacheFolder.cache, "currentversion.dat"), { encoding: "utf-8" });
                let compare;
                try {
                    compare = compareVersions(version, old_version) == -1 && !this.argv["ignore-version"];
                } catch (error) {
                    console.log(chalk.bgRed.whiteBright(`Could not compare version ${version} to ${old_version}: ${(error as Error).message}`));
                    return;
                }
                if (compare) {
                    console.log(chalk.bgRed.whiteBright(`Server has been started with an older version than the data folder (old ${old_version}, current ${version}).`));
                    console.log(chalk.bgRed.whiteBright("Use the argument --ignore-version to continue."));
                    console.log(chalk.bgRed.whiteBright("If you have been using the ts-develop branch and gone back to master, this can happen."));
                    process.exit(1);
                }
            }
            fs.writeFileSync(path.join(BaseConfigCacheFolder.cache, "currentversion.dat"), version);
        }
    }

    /*
    public async buildClientWithBasepath(basepath = ""): Promise<boolean> {
        console.log(process.env.PATH);
        const bin = "yarn";
        const args: string[] = ["build", "--basepath", basepath ?? Config.getInstance().cfg<string>("basepath")];
        try {
            await Helper.execSuperAdvanced(bin, args, path.join(AppRoot, "client-vue"), process.env, "buildClientWithBasepath");
        } catch (error) {
            console.log(chalk.red(`Could not build client: ${(error as Error).message}`));
            return false;
        }
        return true;
    }
    */

    // private migrateCacheToData(relative_path: string): void {
    //     if (fs.existsSync(path.join(BaseConfigCacheFolder.cache, relative_path))) {
    //         fs.renameSync(path.join(BaseConfigCacheFolder.cache, relative_path), path.join(BaseConfigDataFolder., relative_path));
    //     }
    // }

    private static debugConnectionInterval: NodeJS.Timeout | undefined = undefined;
    public static postInit() {
        this.debugConnectionInterval = xInterval(() => {
            this.server.getConnections((error, count) => {
                if (error) {
                    console.log(chalk.red(error));
                } else {
                    if (Config.debug) {
                        debugLog(chalk.yellow(`Currently ${count} HTTP/WebSocket connections`));
                    } else if (count > 5) {
                        console.log(chalk.yellow(`Currently ${count} HTTP/WebSocket connections`));
                    }
                }
            });
        }, 60000);
    }

    public static getErrors(): string[] {
        const errors = [];
        if (!TwitchHelper.hasAxios()) errors.push("Axios is not initialized. Make sure the client id and secret are set in the config.");
        if (!Config.getInstance().cfg("app_url") && Config.getInstance().cfg("app_url") !== "debug") errors.push("No app url set in the config."); // FIXME: contradicting
        if (!Config.getInstance().cfg("api_client_id")) errors.push("No client id set in the config.");
        if (!Config.getInstance().cfg("api_secret")) errors.push("No client secret set in the config.");
        if (LiveStreamDVR.getInstance().getChannels().length == 0) errors.push("No channels set in the config.");

        if (!Helper.path_ffmpeg()) errors.push("Failed to find ffmpeg");
        if (!Helper.path_streamlink()) errors.push("Failed to find streamlink");
        if (!Helper.path_mediainfo()) errors.push("Failed to find mediainfo");

        for (const key in Config.settingsFields) {
            const field = Config.settingsFields[key];
            if (field.deprecated && Config.getInstance().cfg(key) !== field.default) {
                if (typeof field.deprecated === "string") {
                    errors.push(`${key} is deprecated: ${field.deprecated}`);
                } else {
                    errors.push(`'${key}' is deprecated and will be removed in the future.`);
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

        for (const vod of LiveStreamDVR.getInstance().getVods()) {
            if (!vod.is_finalized) continue;
            if (vod.segments.length > 1) {
                if (!vod.segments.some(s => s.filename?.endsWith("_vod.mp4"))) {
                    errors.push(`VOD ${vod.basename} has more than one segment.`);
                }
            } else if (vod.segments.length > 0) {
                vod.segments.forEach(s => {
                    if (s.filename?.endsWith("_vod.mp4")) return;
                    if (s.basename && path.parse(s.basename).name !== vod.basename) {
                        errors.push(`VOD ${vod.basename} has a segment with a different basename: ${s.basename}`);
                    }
                });
            } else {
                errors.push(`VOD ${vod.basename} has no segments.`);
            }
        }

        for (const bin in this.binaryVersions) {
            const d = this.binaryVersions[bin];
            if (d.status !== "ok") {
                errors.push(`Binary ${bin} (${d.version}/${d.min_version}) is not ok: ${d.status}`);
            }
        }

        if (Config.debug) {

            for (const vod of LiveStreamDVR.getInstance().getVods()) {

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

    // public subscribeToAllSubscriptions() {
    //     console.debug("Subscribing to all subscriptions");
    // }

    public freeStorageDiskSpace = 0;
    public diskSpaceInterval?: NodeJS.Timeout;
    public async updateFreeStorageDiskSpace(): Promise<boolean> {
        let ds;
        try {
            ds = await checkDiskSpace(BaseConfigDataFolder.storage);
        } catch (error) {
            console.error(error);
            return false;
        }
        this.freeStorageDiskSpace = ds.free;
        log(LOGLEVEL.DEBUG, "dvr", `Free storage disk space: ${formatBytes(this.freeStorageDiskSpace)}`);
        return true;
    }

    public startDiskSpaceInterval() {
        if (this.diskSpaceInterval) xClearInterval(this.diskSpaceInterval);
        this.diskSpaceInterval = xInterval(() => {
            // if (LiveStreamDVR.getInstance().isIdle) return;
            this.updateFreeStorageDiskSpace();
        }, 1000 * 60 * 10); // 10 minutes
    }

    /**
     * Is there anything that is happening?
     */
    get isIdle(): boolean {
        if (this.getChannels().some(c => c.is_capturing)) return false;
        if (this.getVods().some(v => v.is_capturing)) return false;
        if (this.getVods().some(v => v.is_converting)) return false;
        if (Job.jobs.length > 0) return false;
        return true;
    }

    public static binaryVersions: Record<string, BinaryStatus> = {};
    public static async checkBinaryVersions() {
        log(LOGLEVEL.INFO, "dvr.bincheck", "Checking binary versions...");
        const bins = DVRBinaries();
        const pkgs = DVRPipPackages();
        for (const key in bins) {
            const binary = bins[key];
            if (binary.on_boot) {
                const ret = await getBinaryVersion("bin", key);
                if (ret) {
                    LiveStreamDVR.binaryVersions[key] = ret;
                    console.log(`Binary ${key} version: ${ret.version}`);
                }
            }
        }
        for (const key in pkgs) {
            const binary = pkgs[key];
            if (binary.on_boot) {
                const ret = await getBinaryVersion("pip", key);
                if (ret) {
                    LiveStreamDVR.binaryVersions[key] = ret;
                    console.log(`Pip package ${key} version: ${ret.version}`);
                }
            }
        }

    }

    public static async checkPythonVirtualEnv() {

        log(LOGLEVEL.INFO, "dvr.venvcheck", "Checking python virtual environment...");

        const is_enabled = Config.getInstance().cfg<boolean>("python.enable_pipenv");

        if (!is_enabled) {
            log(LOGLEVEL.INFO, "dvr.venvcheck", "Python virtual environment is not enabled in config.");
            return;
        }

        const has_pipenv = Helper.path_pipenv();
        if (!has_pipenv) {
            log(LOGLEVEL.ERROR, "dvr.venvcheck", "Python virtual environment is enabled but pipenv is not found. Is it installed?");
            return;
        }

        const venv_path = await Helper.path_venv();
        if (!venv_path && Helper.path_pipenv()) {
            console.log(chalk.red("Python virtual environment is enabled but not found."));
            console.log(chalk.red("Please run 'pipenv install' in the root folder."));
            process.exit(1);
        }

        if (!venv_path) {
            log(LOGLEVEL.ERROR, "dvr.venvcheck", "Python virtual environment is not enabled (not found).");
            return;
        }

        if (venv_path !== Config.getInstance().cfg("python.virtualenv_path")) {
            log(LOGLEVEL.INFO, "dvr.venvcheck", "Updating python virtual environment path in config.");
            Config.getInstance().setConfig("python.virtualenv_path", venv_path);
            Config.getInstance().saveConfig();
        }

        log(LOGLEVEL.INFO, "dvr.venvcheck", `Python virtual environment path: ${venv_path}`);

    }

}
