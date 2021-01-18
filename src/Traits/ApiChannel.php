<?php

namespace App\Traits;

use Slim\Psr7\Request;
use Slim\Psr7\Response;

use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;
use App\TwitchConfig;
use App\TwitchHelper;
use App\TwitchVOD;
use App\Exporters\YouTubeExporter;
use App\TwitchChannel;
use App\TwitchAutomator;
use App\TwitchPlaylistAutomator;

trait ApiChannel
{

    public function channel(Request $request, Response $response, $args)
    {
        $username = $args['username'];

        $channel = new TwitchChannel();
        $channel->load($username, true);

        $payload = json_encode([
            'data' => $channel,
            'status' => 'OK'
        ]);
        $response->getBody()->write($payload);

        return $response->withHeader('Content-Type', 'application/json')->withHeader('Access-Control-Allow-Origin', '*');
    }

    public function channel_force_record(Request $request, Response $response, $args)
    {
        $channel_id = TwitchHelper::getChannelId($args['username']);
        $streams = TwitchHelper::getStreams($channel_id);
        if ($streams) {
            set_time_limit(0);
            $data = [
                'data' => $streams
            ];
            $TwitchAutomator = new TwitchAutomator();
            $TwitchAutomator->force_record = true;
            $TwitchAutomator->handle($data);
        } else {
            $response->getBody()->write("No streams found for " . $args['username']);
        }
        return $response;
    }

    public function channel_dump_playlist(Request $request, Response $response, $args)
    {

        $username = $args['username'];

        $pa = new TwitchPlaylistAutomator();
        $pa->setup($username, isset($_GET['quality']) ? $_GET['quality'] : 'best');

        // $output = TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . 'playlist' . DIRECTORY_SEPARATOR . $username . 'vod.ts';

        $pa->output_file = $pa->getCacheFolder() . DIRECTORY_SEPARATOR . $pa->username . '-' . $pa->video_id . '.ts';

        try {
            $data = $pa->downloadLatest();
        } catch (\Throwable $th) {
            $response->getBody()->write(json_encode([
                'error' => $th->getMessage(),
                'status' => 'ERROR'
            ]));
            return $response->withHeader('Content-Type', 'application/json');
        }

        $payload = json_encode([
            'data' => $data,
            'status' => 'OK'
        ]);
        $response->getBody()->write($payload);
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function channel_subscription(Request $request, Response $response, $args)
    {

        $username = $args['username'];

        $channel = new TwitchChannel();
        $channel->load($username);

        $sub = $channel->getSubscription();

        $payload = json_encode([
            'data' => $sub,
            'status' => $sub ? 'OK' : 'ERROR'
        ]);

        $response->getBody()->write($payload);
        return $response->withHeader('Content-Type', 'application/json');
    }
}
