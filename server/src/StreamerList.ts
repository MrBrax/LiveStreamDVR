import { TwitchChannel } from "./Core/TwitchChannel";
import { TwitchConfig } from "./Core/TwitchConfig";
import { TwitchHelper } from "./Core/TwitchHelper";
import { LOGLEVEL, TwitchLog } from "./Core/TwitchLog";

export function generateStreamerList(): { channels: TwitchChannel[], total_size: number } {

    let total_size = 0;

    // $streamerListStatic = TwitchConfig::getStreamers();
    // $streamerList = [];

    /*
    usort( $streamerListStatic, function($a, $b){
        return $a->display_name <=> $b->display_name;
    });
    */

    let channels = TwitchChannel.getChannels();

    if (channels.length == 0) {
        TwitchLog.logAdvanced(LOGLEVEL.WARNING, "api", "No channels in channel list");
    }

    for(let channel of channels) {

        // $data = new TwitchChannel();
        // $data->load($streamer['username'], true);

        total_size += channel.vods_size || 0;

        // $streamerList[] = $data;
    }

    return {channels, total_size};

}