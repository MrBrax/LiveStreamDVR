<?php

declare(strict_types=1);

use App\TwitchChannel;
use App\TwitchConfig;
use App\TwitchHelper;
use App\TwitchVOD;
use PHPUnit\Framework\TestCase;
use GuzzleHttp\Client;

class ToolsTest extends TestCase
{

    private function getClient()
    {
        // create our http client (Guzzle)
        $client = new \GuzzleHttp\Client([
            'base_uri' => 'http://localhost:8080',
        ]);
        return $client;
    }

    public function test_downloadVod(): void
    {
        $client = $this->getClient();

        $url = 'https://www.twitch.tv/videos/794495683';

        $client->request('POST', '/tools/voddownload', [
            'form_params' => [
                'url' => $url,
                'quality' => 'best'
            ]
        ]);
        
    }

    public function test_downloadChat(): void
    {
    }
}
