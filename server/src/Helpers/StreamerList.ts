import { TwitchChannel } from "../Core/TwitchChannel";
import { LOGLEVEL, TwitchLog } from "../Core/TwitchLog";

export function generateStreamerList(): { channels: TwitchChannel[], total_size: number } {

    const channels = TwitchChannel.getChannels();

    if (channels.length == 0) TwitchLog.logAdvanced(LOGLEVEL.WARNING, "api", "No channels in channel list");

    const total_size = channels.reduce((acc, channel) => acc + (channel.vods_size || 0), 0);

    return {channels, total_size};

}