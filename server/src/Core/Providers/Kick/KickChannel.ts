import { KickChannelConfig } from "@common/Config";
import { Providers } from "@common/Defs";
import { KickChannel as KickChannelT, KickUser } from "@common/KickAPI/Kick";
import { randomUUID } from "crypto";
import { KeyValue } from "../../../Core/KeyValue";
import { LiveStreamDVR } from "../../../Core/LiveStreamDVR";
import { Log } from "../../../Core/Log";
import { isKickChannel } from "../../../Helpers/Types";
import { GetChannel, GetStream, GetUser, hasAxiosInstance } from "../../../Providers/Kick";
import { BaseChannel } from "../Base/BaseChannel";

export class KickChannel extends BaseChannel {

    public provider: Providers = "kick";

    public channel_data?: KickChannelT;
    public user_data?: KickUser;

    public slug?: string;

    public get internalName(): string {
        return this.channel_data?.slug || "";
    }

    public get internalId(): string {
        return this.channel_data?.id.toString() || "";
    }

    public get displayName(): string {
        return this.user_data?.username ?? "";
    }

    public static async getUserDataBySlug(slug: string): Promise<KickUser | undefined> {
        let data;
        try {
            data = await GetUser(slug);
        } catch (error) {
            console.error(error);
            return undefined;
        }

        return data;
    }

    /**
     * API does not seem to support looking up by id
     * @param id 
     */
    public static async getUserDataById(id: string): Promise<KickUser | undefined> {
        throw new Error("Not implemented");
    }

    public static async getChannelDataBySlug(slug: string): Promise<KickChannelT | undefined> {
        let data;
        try {
            data = await GetChannel(slug);
        } catch (error) {
            console.error(error);
            return undefined;
        }

        return data;
    }

    /**
     * API does not seem to support looking up by id
     * @param slug 
     * @returns 
     */
    public static async getChannelDataById(id: string): Promise<KickChannelT | undefined> {
        throw new Error("Not implemented");
    }

    /**
     * Create and insert channel in memory. Subscribe too.
     * 
     * @param config
     * @returns 
     */
    public static async create(config: KickChannelConfig): Promise<KickChannel> {

        const exists_config = LiveStreamDVR.getInstance().channels_config.find(ch => ch.provider == "kick" && ch.slug === config.slug);
        if (exists_config) throw new Error(`Channel ${config.slug} already exists in config`);

        const exists_channel = LiveStreamDVR.getInstance().getChannels().find<KickChannel>((channel): channel is KickChannel => isKickChannel(channel) && channel.slug === config.slug);
        if (exists_channel) throw new Error(`Channel ${config.slug} already exists in channels`);

        const data = await KickChannel.getUserDataBySlug(config.slug);
        if (!data) throw new Error(`Could not get channel data for channel slug: ${config.slug}`);

        config.uuid = randomUUID();

        LiveStreamDVR.getInstance().channels_config.push(config);
        LiveStreamDVR.getInstance().saveChannelsConfig();

        const channel = await KickChannel.loadFromSlug(config.slug);
        if (!channel || !channel.slug) throw new Error(`Channel ${config.slug} could not be loaded`);

        /*
        if (
            Config.getInstance().cfg<string>("app_url", "") !== "" &&
            Config.getInstance().cfg<string>("app_url", "") !== "debug" &&
            !Config.getInstance().cfg<boolean>("isolated_mode")
        ) {
            try {
                await channel.subscribe();
            } catch (error) {
                Log.logAdvanced(Log.Level.ERROR, "channel", `Failed to subscribe to channel ${channel.internalName}: ${(error as Error).message}`);
                LiveStreamDVR.getInstance().channels_config = LiveStreamDVR.getInstance().channels_config.filter(ch => ch.provider == "twitch" && ch.login !== config.login); // remove channel from config
                LiveStreamDVR.getInstance().saveChannelsConfig();
                // throw new Error(`Failed to subscribe to channel ${channel.login}: ${(error as Error).message}`, { cause: error });
                throw error; // rethrow error
            }
        } else if (Config.getInstance().cfg("app_url") == "debug") {
            Log.logAdvanced(Log.Level.WARNING, "channel", `Not subscribing to ${channel.internalName} due to debug app_url.`);
        } else if (Config.getInstance().cfg("isolated_mode")) {
            Log.logAdvanced(Log.Level.WARNING, "channel", `Not subscribing to ${channel.internalName} due to isolated mode.`);
        } else {
            Log.logAdvanced(Log.Level.ERROR, "channel", `Can't subscribe to ${channel.internalName} due to either no app_url or isolated mode disabled.`);
            LiveStreamDVR.getInstance().channels_config = LiveStreamDVR.getInstance().channels_config.filter(ch => ch.provider == "twitch" && ch.login !== config.login); // remove channel from config
            LiveStreamDVR.getInstance().saveChannelsConfig();
            throw new Error("Can't subscribe due to either no app_url or isolated mode disabled.");
        }
        */

        LiveStreamDVR.getInstance().addChannel(channel);

        if (hasAxiosInstance()) { // bad hack?
            const streams = await GetStream(channel.internalName);
            if (streams) {
                KeyValue.getInstance().setBool(`kick.${channel.internalName}.online`, true);
            }
        }

        return channel;
    }

    /**
     * Fetch channel class object from memory by channel slug.
     * This is the main function to get a channel object.
     * If it does not exist, undefined is returned.
     * It does not fetch the channel data from the API or create it.
     * 
     * @param {string} slug 
     * @returns {KickChannel} Channel object
     */
    public static getChannelBySlug(slug: string): KickChannel | undefined {
        return LiveStreamDVR
            .getInstance()
            .getChannels()
            .find<KickChannel>((ch): ch is KickChannel => ch instanceof KickChannel && ch.slug === slug);
    }

    public static getChannelById(id: string): KickChannel | undefined {
        return LiveStreamDVR
            .getInstance()
            .getChannels()
            .find<KickChannel>((ch): ch is KickChannel => ch instanceof KickChannel && ch.internalId === id);
    }

    /**
     * Load channel class using slug, don't call this. Used internally.
     *
     * @internal
     * @param slug
     * @returns
     */
    public static async loadFromSlug(slug: string): Promise<KickChannel> {
        if (!slug) throw new Error("Streamer slug is empty");
        if (typeof slug !== "string") throw new TypeError("Streamer slug is not a string");
        Log.logAdvanced(Log.Level.DEBUG, "channel.loadFromslug", `Load from slug ${slug}`);
        const channel_id = await this.channelIdFromSlug(slug);
        if (!channel_id) throw new Error(`Could not get channel id from slug: ${slug}`);
        return this.loadAbstract(channel_id); // $channel;
    }

    public static async channelIdFromSlug(slug: string): Promise<string | false> {
        const userData = await this.getUserDataBySlug(slug);
        return userData ? userData.id.toString() : false;
    }

    public static async loadAbstract(channel_id: string): Promise<KickChannel> {

        Log.logAdvanced(Log.Level.DEBUG, "channel", `Load channel ${channel_id}`);

        const channel_memory = KickChannel.getChannelById(channel_id);
        if (channel_memory) {
            Log.logAdvanced(Log.Level.WARNING, "channel", `Channel ${channel_id} already loaded`);
            return channel_memory;
        }

        const channel = new this();

        const channel_data = await this.getChannelDataById(channel_id);
        if (!channel_data) throw new Error(`Could not get channel data for channel id: ${channel_id}`);

        const channel_slug = channel_data.slug;

        const channel_config = LiveStreamDVR.getInstance().channels_config.find(c => c.provider == "kick" && c.slug === channel_slug);
        if (!channel_config) throw new Error(`Could not find channel config in memory for channel login: ${channel_slug}`);

        channel.uuid = channel_config.uuid;
        channel.channel_data = channel_data;
        channel.config = channel_config;

        if (!channel.uuid) {
            throw new Error(`Channel ${channel_slug} has no uuid`);
        }

        channel.applyConfig(channel_config);

        if (KeyValue.getInstance().getBool(`kick.${channel.internalId}.online`)) {
            Log.logAdvanced(Log.Level.WARNING, "channel", `Channel ${channel.internalName} is online, stale?`);
        }

        if (KeyValue.getInstance().get(`kick.${channel.internalName}.channeldata`)) {
            Log.logAdvanced(Log.Level.WARNING, "channel", `Channel ${channel.internalName} has stale chapter data.`);
        }

        // if (channel.channel_data.profile_image_url && !channel.channelLogoExists) {
        //     await this.fetchChannelLogo(channel.channel_data);
        // }

        channel.makeFolder();

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

        // channel.saveKodiNfo();

        // try {
        //     await channel.updateChapterData();
        // } catch (error) {
        //     Log.logAdvanced(Log.Level.ERROR, "channel", `Failed to update chapter data for channel ${channel.login}: ${(error as Error).message}`);
        // }

        return channel;

    }

}