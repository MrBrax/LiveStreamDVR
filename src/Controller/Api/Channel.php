<?php

namespace App\Controller\Api;

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

class Channel
{

    /**
     * GET /api/v0/channels/{login}
     * Show channel info and VODs
     *
     * @Route("/api/v0/channels/{login}", methods={"GET"})
     * @param Request $request
     * @param Response $response
     * @param array $args
     * @return Response
     */
    public function channel(Request $request, Response $response, array $args)
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

    /**
     * GET /api/v0/channels/{login}/force_record
     * Start recording a channel manually
     * 
     * @Route("/api/v0/channels/{login}/force_record", methods={"GET"})
     * @param Request $request
     * @param Response $response
     * @param array $args
     * @return Response
     */
    public function channel_force_record(Request $request, Response $response, array $args)
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

    /**
     * GET /api/v0/channels/{login}/dump_playlist
     * Start recording a channel manually by using the most recent video as a playlist
     *
     * @Route("/api/v0/channels/{login}/dump_playlist", methods={"GET"})
     * @param Request $request
     * @param Response $response
     * @param array $args
     * @return Response
     */
    public function channel_dump_playlist(Request $request, Response $response, array $args)
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

    /**
     * GET /api/v0/channels/{login}/subscription
     * Show channel subscription info
     *
     * @Route("/api/v0/channels/{login}/subscription", methods={"GET"})
     * @param Request $request
     * @param Response $response
     * @param array $args
     * @return Response
     */
    public function channel_subscription(Request $request, Response $response, array $args)
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

    /**
     * GET /api/v0/channels/{login}/download_video
     * Download an archived video from a channel
     *
     * @Route("/api/v0/channels/{login}/download_video", methods={"GET"})
     * @param Request $request
     * @param Response $response
     * @param array $args
     * @return Response
     */
    public function channel_download_video(Request $request, Response $response, array $args)
    {
        $login = (string)$args['login'];
        $video_id = (int)$args['video_id'];
        $channel = TwitchChannel::loadFromLogin($login);

        if ($channel->hasVod($video_id)) {
            $response->getBody()->write(json_encode([
                "message" => "VOD {$video_id} already downloaded.",
                "status" => "ERROR"
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        $video = TwitchHelper::getVideo($video_id);
        $basename = $channel->login . "_" . str_replace(':', '_', $video['created_at']) . "_" . $video['stream_id'];

        $status = $channel->downloadVod($video_id);

        if ($status) {
            $vodclass = new TwitchVOD();
            $vodclass->create(TwitchHelper::vodFolder($channel->login) . DIRECTORY_SEPARATOR . $basename . ".json");
            $vodclass->meta = $video;
            $vodclass->streamer_name = $channel->display_name;
		    $vodclass->streamer_login = $channel->login;
		    $vodclass->streamer_id = $channel->userid;
		    $vodclass->dt_started_at = \DateTime::createFromFormat(TwitchHelper::DATE_FORMAT, $video['created_at']);

            $duration = TwitchHelper::parseTwitchDuration($video['duration']);
            $vodclass->dt_ended_at = \DateTime::createFromFormat(TwitchHelper::DATE_FORMAT, $video['created_at'])->add(new \DateInterval("PT{$duration}S"));
            $vodclass->saveJSON("manual creation");
            $vodclass = $vodclass->refreshJSON(true);

            $vodclass->addSegment($status);
            $vodclass->finalize();
            $vodclass->saveJSON("manual finalize");

            TwitchHelper::webhook([
                'action' => 'end_download',
                'vod' => $vodclass
            ]);
        }

        $payload = json_encode([
            'data' => $status,
            'status' => $status ? 'OK' : 'ERROR'
        ]);

        $response->getBody()->write($payload);
        return $response->withHeader('Content-Type', 'application/json');
    }
}
