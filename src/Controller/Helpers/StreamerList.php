<?php
namespace App\Controller\Helpers;
use App\TwitchHelper;
use App\TwitchConfig;

trait StreamerList {
    public function generateStreamerList()
    {

        $total_size = 0;

        // $streamerListStatic = TwitchConfig::getStreamers();
        // $streamerList = [];

        /*
        usort( $streamerListStatic, function($a, $b){
            return $a->display_name <=> $b->display_name;
        });
        */

        $channels = TwitchConfig::getChannels();

        if (count($channels) == 0) {
            TwitchHelper::logAdvanced(TwitchHelper::LOG_WARNING, "api", "No channels in channel list");
        }

        foreach ($channels as $channel) {

            // $data = new TwitchChannel();
            // $data->load($streamer['username'], true);

            $total_size += $channel->vods_size;

            // $streamerList[] = $data;
        }
        return [$channels, $total_size];
    }
}