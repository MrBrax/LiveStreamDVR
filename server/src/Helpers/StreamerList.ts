import {  LOGLEVEL, log } from "@/Core/Log";
import type { ChannelTypes} from "@/Core/LiveStreamDVR";
import { LiveStreamDVR } from "@/Core/LiveStreamDVR";

export function generateStreamerList(): { channels: ChannelTypes[], total_size: number } {

    const channels = LiveStreamDVR.getInstance().getChannels();

    if (channels.length == 0) log(LOGLEVEL.WARNING, "api", "No channels in channel list");

    const total_size = channels.reduce((acc, channel) => acc + (channel.vods_size || 0), 0);

    return {channels, total_size};

}