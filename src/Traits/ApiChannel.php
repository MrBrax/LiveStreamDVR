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
        $login = $args['login'];

        $channel = TwitchConfig::getChannelByLogin($login);

        $payload = json_encode([
            'data' => $channel,
            'status' => 'OK',
        ]);
        $response->getBody()->write($payload);

        return $response->withHeader('Content-Type', 'application/json')->withHeader('Access-Control-Allow-Origin', '*');
    }

    public function channel_force_record(Request $request, Response $response, $args)
    {
        
        $channel_id = TwitchChannel::channelIdFromLogin($args['login']);
        $streams = TwitchHelper::getStreams($channel_id);
        if ($streams) {
            set_time_limit(0);

            $stream = $streams[0];
            
            $fake_data = [
                'subscription' => [
                    'id' => 'fake',
                    'type' => 'stream.online',
                    'condition' => [
                        'broadcaster_user_id' => $channel_id,
                    ],
                ],
                'event' => [
                    'type' => 'live',
                    'id' => $stream['id'],
                    'broadcaster_user_id' => $stream['user_id'],
                    'broadcaster_user_login' => $stream['user_login'],
                    'broadcaster_user_name' => $stream['user_name'],
                    'title' => $stream['title'],
                    'category_id' => $stream['game_id'],
                    'category_name' => $stream['game_name'],
                    'is_mature' => $stream['is_mature'],
                    'started_at' => $stream['started_at'],
                ],
            ];

            $fake_headers = [
                'Twitch-Eventsub-Message-Id' => ['fake'],
                'Twitch-Eventsub-Message-Retry' => ['0'],
            ];

            $TwitchAutomator = new TwitchAutomator();
            $TwitchAutomator->force_record = true;
            $TwitchAutomator->handle($fake_data, $fake_headers);
            $response->getBody()->write(json_encode([
                "message" => "Finished recording",
                "status" => "OK"
            ]));
        } else {
            $response->getBody()->write(json_encode([
                "message" => "No streams found for {$args['username']}",
                "status" => "ERROR"
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }
        return $response;
        
    }

    public function channel_dump_playlist(Request $request, Response $response, $args)
    {

        $login = $args['login'];

        $pa = new TwitchPlaylistAutomator();
        $pa->setup($login, isset($_GET['quality']) ? $_GET['quality'] : 'best');

        // $output = TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . 'playlist' . DIRECTORY_SEPARATOR . $username . 'vod.ts';

        $pa->output_file = $pa->getCacheFolder() . DIRECTORY_SEPARATOR . $pa->username . '-' . $pa->video_id . '.ts';

        try {
            $data = $pa->downloadLatest();
        } catch (\Throwable $th) {
            $response->getBody()->write(json_encode([
                'message' => $th->getMessage(),
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

        $login = $args['login'];

        $channel = TwitchChannel::loadFromLogin($login);

        $sub = $channel->getSubscription();

        $payload = json_encode([
            'data' => $sub,
            'status' => $sub ? 'OK' : 'ERROR'
        ]);

        $response->getBody()->write($payload);
        return $response->withHeader('Content-Type', 'application/json');
    }
}
