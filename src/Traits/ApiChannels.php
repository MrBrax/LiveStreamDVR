<?php

namespace App\Traits;

use Slim\Psr7\Request;
use Slim\Psr7\Response;

use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;
use App\TwitchConfig;
use App\TwitchHelper;
use App\TwitchVOD;
use App\TwitchChannel;

trait ApiChannels
{

    /*
    private function generateStreamerList()
    {

        $total_size = 0;

        $streamerListStatic = TwitchConfig::getStreamers();
        $streamerList = [];

        /*
        usort( $streamerListStatic, function($a, $b){
            return $a->display_name <=> $b->display_name;
        });
        *

        foreach ($streamerListStatic as $streamer) {

            $data = new TwitchChannel();
            $data->load($streamer['username'], true);

            $total_size += $data->vods_size;

            $streamerList[] = $data;
        }
        return [$streamerList, $total_size];
    }
    */

    public function channels_list(Request $request, Response $response, $args)
    {

        list($streamerList, $total_size) = $this->generateStreamerList();

        $data = [
            'streamer_list' => $streamerList,
            'total_size' => $total_size,
            'free_size' => disk_free_space(TwitchHelper::vodFolder())
        ];

        $payload = json_encode([
            'data' => $data,
            'status' => 'OK'
        ]);
        $response->getBody()->write($payload);

        return $response->withStatus(200)->withHeader('Content-Type', 'application/json')->withHeader('Access-Control-Allow-Origin', '*');
    }

    public function channels_add(Request $request, Response $response, $args)
    {

        $login          = isset($_POST['login']) ? $_POST['login'] : null;
        $quality        = isset($_POST['quality']) ? explode(" ", $_POST['quality']) : null;
        $match          = isset($_POST['match']) ? $_POST['match'] : null;
        $download_chat  = isset($_POST['download_chat']);
        $burn_chat      = isset($_POST['burn_chat']);
        $no_capture     = isset($_POST['no_capture']);

        if (!$login) {
            $response->getBody()->write(json_encode([
                "message" => "No login provided.",
                "status" => "ERROR"
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        if (!$quality) {
            $response->getBody()->write(json_encode([
                "message" => "No quality entered. Use 'best' if you don't know better.",
                "status" => "ERROR"
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        $channel_id = TwitchChannel::channelIdFromLogin($login);

        if (!$channel_id) {
            $response->getBody()->write(json_encode([
                "message" => "Streamer with the login '{$login}' doesn't seem to exist on Twitch.",
                "status" => "ERROR"
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        // $tmp = TwitchHelper::getChannelData($channel_id);
        // 
        // // fix capitalization
        // if ($tmp['display_name'] !== $username) {
        //     // $response->getBody()->write("Username capitalization seems to be incorrect, fixing.<br>");
        //     $username = $tmp['display_name'];
        // }

        if (TwitchConfig::getChannelByLogin($login)) {
            $response->getBody()->write(json_encode([
                "message" => "Streamer with the username '{$login}' already exists in config",
                "status" => "ERROR"
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        // template
        $streamer = [
            "login" => $login,
            "quality" => $quality
        ];

        if ($match) {
            $streamer["match"] = explode(",", $match);
        }

        if ($download_chat) $streamer["download_chat"] = true;
        if ($burn_chat) $streamer["burn_chat"] = true;
        if ($no_capture) $streamer["no_capture"] = true;

        // TwitchConfig::$config['streamers'][] = $streamer;

        TwitchConfig::$channels_config[] = $streamer;

        if (TwitchConfig::cfg('app_url') !== 'debug') {
            try {
                TwitchHelper::channelSubscribe($channel_id);
            } catch (\Throwable $th) {
                $response->getBody()->write(json_encode([
                    "message" => "Subscription error: " . $th->getMessage(),
                    "status" => "ERROR"
                ]));
                return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
            }
        }

        // TwitchConfig::saveConfig("streamer/add");
        TwitchConfig::saveChannels();
        TwitchConfig::loadChannels(); // reload from disk

        $payload = json_encode([
            'message' => "Channel added: {$login}.",
            'status' => 'OK'
        ]);

        $response->getBody()->write($payload);

        return $response->withHeader('Content-Type', 'application/json')->withHeader('Access-Control-Allow-Origin', '*');
    }

    public function channels_update(Request $request, Response $response, array $args)
    {

        $username       = isset($_POST['username']) ? $_POST['username'] : null;
        $quality        = isset($_POST['quality']) ? explode(" ", $_POST['quality']) : null;
        $match          = isset($_POST['match']) ? $_POST['match'] : null;
        $download_chat  = isset($_POST['download_chat']);
        $burn_chat      = isset($_POST['burn_chat']);
        $no_capture     = isset($_POST['no_capture']);

        if (!TwitchConfig::getStreamer($username)) {
            $response->getBody()->write(json_encode([
                "message" => "Streamer with that username does not exist in config",
                "status" => "ERROR"
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        // template
        $streamer = [
            "username" => $username,
            "quality" => $quality
        ];

        if ($match) {
            $streamer["match"] = explode(",", $match);
        }

        if ($download_chat) $streamer["download_chat"] = true;
        if ($burn_chat) $streamer["burn_chat"] = true;
        if ($no_capture) $streamer["no_capture"] = true;

        if (!TwitchConfig::$config['streamers']) {
            $response->getBody()->write(json_encode([
                "message" => "No streamers have been added.",
                "status" => "ERROR"
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        // todo: find a better way to do this
        $key = null;
        foreach (TwitchConfig::$config['streamers'] as $k => $v) {
            if ($v['username'] == $username) $key = $k;
        }
        if ($key === null) {
            $response->getBody()->write(json_encode([
                "message" => "Streamer {$username} not found.",
                "status" => "ERROR"
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        TwitchConfig::$config['streamers'][$key] = $streamer;

        if (TwitchConfig::cfg('app_url') !== 'debug') {
            try {
                TwitchHelper::channelSubscribe(TwitchHelper::getChannelId($username));
            } catch (\Throwable $th) {
                $response->getBody()->write(json_encode([
                    "message" => "Subscription error: " . $th->getMessage(),
                    "status" => "ERROR"
                ]));
                return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
            }
        }

        TwitchConfig::saveConfig("streamer/update");

        $response->getBody()->write(json_encode([
            "message" => "Streamer '{$username}' updated",
            "status" => "OK"
        ]));
        return $response->withStatus(200)->withHeader('Content-Type', 'application/json');
    }

    public function channels_delete(Request $request, Response $response, array $args)
    {

        $username = $_POST['username'];

        try {
            $streamer_data = TwitchConfig::getStreamer($username);
        } catch (\Throwable $th) {
            $response->getBody()->write(json_encode([
                "message" => "Server error: " . $th->getMessage(),
                "status" => "ERROR"
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }
        
        if (!$streamer_data) {
            $response->getBody()->write(json_encode([
                "message" => "Streamer with that username does not exist in config",
                "status" => "ERROR"
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        $streamer = new TwitchChannel();
        $streamer->load($username);
        if ($streamer->is_live) {
            $response->getBody()->write(json_encode([
                "message" => "Please wait until the streamer has stopped streaming before deleting.",
                "status" => "ERROR"
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        $key = null;
        foreach (TwitchConfig::$config['streamers'] as $k => $v) {
            if ($v['username'] == $username) $key = $k;
        }
        if ($key === null) {
            $response->getBody()->write(json_encode([
                "message" => "Streamer {$username} not found.",
                "status" => "ERROR"
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        TwitchHelper::channelUnsubscribe(TwitchHelper::getChannelId($username));

        sleep(5);

        if($streamer->getSubscription()){
            $response->getBody()->write(json_encode([
                "message" => "Unsubscribe failed, did not remove streamer {$username}.",
                "status" => "ERROR"
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        unset(TwitchConfig::$config['streamers'][$key]);
        TwitchConfig::saveConfig("streamer/deleted");

        $response->getBody()->write(json_encode([
            "message" => "Streamer {$username} deleted.",
            "status" => "OK"
        ]));
        return $response->withStatus(200)->withHeader('Content-Type', 'application/json');
        
    }

}
