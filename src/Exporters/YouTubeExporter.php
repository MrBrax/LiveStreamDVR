<?php

namespace App\Exporters;

use App\TwitchConfig;
use Google\Client;

class YouTubeExporter extends BaseExporter
{

    function exportSegment(array $segment, int $part, int $total_parts)
    {
        $full_title = $this->makeTitle($segment, $part, $total_parts);

        $client = new \Google\Client();
        $client->setApplicationName("TwitchAutomator");
        $client->setDeveloperKey( TwitchConfig::cfg('youtube_api_key') );

        

        // upload via youtube api
        // return "Not implemented";
    }
}
