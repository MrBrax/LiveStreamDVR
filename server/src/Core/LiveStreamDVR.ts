import chalk from "chalk";
import { compareVersions } from "compare-versions";
import { randomUUID } from "crypto";
import fs from "fs";
import { Server } from "http";
import minimist from "minimist";
// import { version } from "os";
import { version } from "../../package.json";
import path from "path";
import { WebSocketServer } from "ws";
import { ChannelConfig } from "../../../common/Config";
import { AppRoot, BaseConfigCacheFolder, BaseConfigDataFolder, BaseConfigPath } from "./BaseConfig";
import { ClientBroker } from "@/Core/ClientBroker";
import { Config } from "./Config";
import { Job } from "./Job";
import { Log, LOGLEVEL } from "./Log";
import { BaseVODChapter } from "./Providers/Base/BaseVODChapter";
import { TwitchChannel } from "./Providers/Twitch/TwitchChannel";
import { TwitchVOD } from "./Providers/Twitch/TwitchVOD";
import { TwitchVODChapter } from "./Providers/Twitch/TwitchVODChapter";
import { YouTubeChannel } from "./Providers/YouTube/YouTubeChannel";
import { YouTubeVOD } from "./Providers/YouTube/YouTubeVOD";
import { Scheduler } from "./Scheduler";
import { Webhook } from "./Webhook";
import { log } from "console";
import { Helper } from "./Helper";

export type ChannelTypes = TwitchChannel | YouTubeChannel;
export type VODTypes = TwitchVOD | YouTubeVOD;
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

    public loadChannelsConfig(): boolean {

        if (!fs.existsSync(BaseConfigPath.channel)) {
            return false;
        }

        Log.logAdvanced(LOGLEVEL.INFO, "dvr", "Loading channel configs...");

        const data: ChannelConfig[] = JSON.parse(fs.readFileSync(BaseConfigPath.channel, "utf8"));

        let needsSave = false;
        for (const channel of data) {
            if ((!("quality" in channel) || !channel.quality) && channel.provider == "twitch") {
                Log.logAdvanced(LOGLEVEL.WARNING, "dvr", `Channel ${channel.login} has no quality set, setting to default`);
                channel.quality = ["best"];
                needsSave = true;
            }
            if (!("provider" in channel)) {
                (channel as any).provider = "twitch";
            }
            if (!channel.uuid) {
                channel.uuid = randomUUID();
                console.log(`Channel does not have an UUID, generated: ${channel.uuid}`);
                needsSave = true;
            }
        }

        this.channels_config = data;

        Log.logAdvanced(LOGLEVEL.SUCCESS, "dvr", `Loaded ${this.channels_config.length} channel configs!`);

        if (needsSave) {
            this.saveChannelsConfig();
        }

        if (Config.getInstance().cfg("channel_folders")) {
            const folders = fs.readdirSync(BaseConfigDataFolder.vod);
            for (const folder of folders) {
                if (folder == ".gitkeep") continue;
                if (!this.channels_config.find(ch => ch.provider == "twitch" && ch.login === folder)) {
                    Log.logAdvanced(LOGLEVEL.WARNING, "dvr", `Channel folder ${folder} is not in channel config, left over?`);
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
        Log.logAdvanced(LOGLEVEL.INFO, "dvr", "Loading channels...");
        if (this.channels_config.length > 0) {
            for (const channel of this.channels_config) {

                Log.logAdvanced(LOGLEVEL.INFO, "dvr", `Loading channel ${channel.uuid}, provider ${channel.provider}...`);

                if (!channel.provider || channel.provider == "twitch") {

                    let ch: TwitchChannel;

                    try {
                        ch = await TwitchChannel.loadFromLogin(channel.login);
                    } catch (th) {
                        Log.logAdvanced(LOGLEVEL.FATAL, "dvr.load.tw", `TW Channel ${channel.login} could not be loaded: ${th}`);
                        console.error(th);
                        continue;
                        // break;
                    }

                    if (ch) {
                        this.channels.push(ch);
                        ch.postLoad();
                        ch.getVods().forEach(vod => vod.postLoad());
                        Log.logAdvanced(LOGLEVEL.SUCCESS, "dvr.load.tw", `Loaded channel ${channel.login} with ${ch.getVods().length} vods`);
                        if (ch.no_capture) {
                            Log.logAdvanced(LOGLEVEL.WARNING, "dvr.load.tw", `Channel ${channel.login} is configured to not capture streams.`);
                        }
                    } else {
                        Log.logAdvanced(LOGLEVEL.FATAL, "dvr.load.tw", `Channel ${channel.login} could not be added, please check logs.`);
                        break;
                    }

                } else if (channel.provider == "youtube") {

                    let ch: YouTubeChannel;

                    try {
                        ch = await YouTubeChannel.loadFromId(channel.channel_id);
                    } catch (th) {
                        Log.logAdvanced(LOGLEVEL.FATAL, "dvr.load.yt", `YT Channel ${channel.channel_id} could not be loaded: ${th}`);
                        console.error(th);
                        continue;
                        // break;
                    }

                    if (ch) {
                        this.channels.push(ch);
                        ch.postLoad();
                        ch.getVods().forEach(vod => vod.postLoad());
                        Log.logAdvanced(LOGLEVEL.SUCCESS, "dvr.load.yt", `Loaded channel ${ch.displayName} with ${ch.getVods().length} vods`);
                        if (ch.no_capture) {
                            Log.logAdvanced(LOGLEVEL.WARNING, "dvr.load.yt", `Channel ${ch.displayName} is configured to not capture streams.`);
                        }
                    } else {
                        Log.logAdvanced(LOGLEVEL.FATAL, "dvr.load.yt", `Channel ${channel.channel_id} could not be added, please check logs.`);
                        break;
                    }

                }
            }
        }
        Log.logAdvanced(LOGLEVEL.SUCCESS, "dvr", `Loaded ${this.channels.length} channels!`);
        return this.channels.length;
    }

    public saveChannelsConfig(): boolean {
        Log.logAdvanced(LOGLEVEL.INFO, "dvr", "Saving channel config");
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
                Log.logAdvanced(LOGLEVEL.WARNING, "dvr", `Channel ${vod.getChannel().internalName} removed but VOD ${vod.basename} still lingering`);
            }
            if (!fs.existsSync(vod.filename)) {
                Log.logAdvanced(LOGLEVEL.WARNING, "dvr", `VOD ${vod.basename} in memory but not on disk`);
            }
        });
    }

    public getChannelByUUID<T extends ChannelTypes>(uuid: string): T | false {
        const search = this.channels.find(c => c.uuid == uuid);
        if (!search) {
            console.error(`Channel with UUID ${uuid} not found in list: ${this.channels.map(c => c.uuid).join(", ")}`);
            return false;
        }
        return search as T;
    }

    public addVod(vod: VODTypes): void {
        this.vods.push(vod);
    }

    public addChannel(channel: ChannelTypes): void {
        this.channels.push(channel);
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
            Log.logAdvanced(LOGLEVEL.INFO, "dvr", `VOD ${vod.basename} removed from memory!`);
            Webhook.dispatch("vod_removed", { basename: vod.basename });
            return true;
        }
        return false;
    }

    public static shutdown(reason: string) {
        this.shutting_down = true;
        console.log(chalk.red(`[${new Date().toISOString()}] Shutting down (${reason})...`));

        let timeout: NodeJS.Timeout | undefined = undefined;
        // introduced in node 18.2
        if ("closeAllConnections" in this.server) {
            (this.server as any).closeAllConnections();
        } else {
            // bad workaround
            timeout = setTimeout(() => {
                console.log(chalk.red("Force exiting server, 10 seconds have passed without close event."));
                process.exit(1);
            }, 10000);
        }

        // this will not be called until all connections are closed
        this.server.close(async (error) => {
            if (error) {
                console.log(chalk.red(error));
            } else {
                console.log(chalk.red("express server is now down"));
            }
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
            if (timeout !== undefined) clearTimeout(timeout);
            console.log(chalk.red("Finished tasks, bye bye."));
        });
    }

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

}