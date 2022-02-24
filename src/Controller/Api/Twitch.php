<?php
declare(strict_types=1);
namespace App\Controller\Api;

use App\TwitchChannel;
use App\TwitchHelper;
use Slim\Psr7\Request;
use Slim\Psr7\Response;

class Twitch
{
    public function twitchapi_videos(Request $request, Response $response, $args)
    {

        $login = $args['login'];

        $userid = TwitchChannel::channelIdFromLogin($login);

        $data = TwitchHelper::getVideos($userid);

        $payload = json_encode([
            'data' => $data,
            'status' => 'OK'
        ]);
        $response->getBody()->write($payload);
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function twitchapi_video(Request $request, Response $response, $args)
    {

        $video_id = isset($args['video_id']) ? (int)$args['video_id'] : null;
        if (!$video_id) {
            $response->getBody()->write(json_encode([
                'error' => 'Missing video id',
                'status' => 'ERROR'
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        $data = TwitchHelper::getVideo($video_id);

        $payload = json_encode([
            'data' => $data,
            'status' => 'OK'
        ]);
        $response->getBody()->write($payload);
        return $response->withHeader('Content-Type', 'application/json');
    }
}
