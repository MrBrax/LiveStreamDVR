import { TwitchChannel } from "../Core/TwitchChannel";
import { LOGLEVEL, Log } from "../Core/Log";
import { ChannelFactory } from "Core/ChannelFactory";
import { AllChannels } from "Core/Channel";

export function generateStreamerList(): { channels: AllChannels[], total_size: number } {

    const channels = ChannelFactory.getChannels();

    if (channels.length == 0) Log.logAdvanced(LOGLEVEL.WARNING, "api", "No channels in channel list");

    const total_size = channels.reduce((acc, channel) => acc + (channel.vods_size || 0), 0);

    return {channels, total_size};

}