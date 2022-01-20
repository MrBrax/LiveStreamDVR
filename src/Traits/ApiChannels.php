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

        $display_name = TwitchChannel::channelDisplayNameFromId($channel_id);
        $cache_login = TwitchChannel::channelLoginFromId($channel_id);

        if ($login !== $cache_login) {
            $response->getBody()->write(json_encode([
                "message" => "Login '{$login}' doesn't match the one provided by Twitch: '{$cache_login}'. Check that it's the LOGIN name and not the DISPLAY name.",
                "status" => "ERROR"
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }
        // $tmp = TwitchHelper::getChannelData($channel_id);
        // 
        // // fix capitalization
        // if ($tmp['display_name'] !== $display_name) {
        //     // $response->getBody()->write("Username capitalization seems to be incorrect, fixing.<br>");
        //     $display_name = $tmp['display_name'];
        // }

        if (TwitchConfig::getChannelByLogin($login)) {
            $response->getBody()->write(json_encode([
                "message" => "Streamer with the login '{$login}' already exists in config",
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
            'message' => "Channel added: {$login} ({$display_name}).",
            'status' => 'OK'
        ]);

        $response->getBody()->write($payload);

        return $response->withHeader('Content-Type', 'application/json')->withHeader('Access-Control-Allow-Origin', '*');
    }

    public function channels_update(Request $request, Response $response, array $args)
    {

        $login       = isset($_POST['login']) ? $_POST['login'] : null;
        $quality        = isset($_POST['quality']) ? explode(" ", $_POST['quality']) : null;
        $match          = isset($_POST['match']) ? $_POST['match'] : null;
        $download_chat  = isset($_POST['download_chat']);
        $burn_chat      = isset($_POST['burn_chat']);
        $no_capture     = isset($_POST['no_capture']);

        if (!TwitchConfig::getChannelByLogin($login)) {
            $response->getBody()->write(json_encode([
                "message" => "Streamer with that login does not exist in config",
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

        /*
        if (!TwitchConfig::$config['streamers']) {
            $response->getBody()->write(json_encode([
                "message" => "No streamers have been added.",
                "status" => "ERROR"
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }
        */

        // todo: find a better way to do this
        $key = null;
        foreach (TwitchConfig::$channels_config as $k => $v) {
            if ($v['login'] == $login) $key = $k;
        }
        if ($key === null) {
            $response->getBody()->write(json_encode([
                "message" => "Streamer {$login} not found.",
                "status" => "ERROR"
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        TwitchConfig::$channels_config[$key] = $streamer;

        if (TwitchConfig::cfg('app_url') !== 'debug') {
            try {
                TwitchHelper::channelSubscribe(TwitchChannel::channelIdFromLogin($login));
            } catch (\Throwable $th) {
                $response->getBody()->write(json_encode([
                    "message" => "Subscription error: " . $th->getMessage(),
                    "status" => "ERROR"
                ]));
                return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
            }
        }

        TwitchConfig::saveChannels();

        $response->getBody()->write(json_encode([
            "message" => "Channel '{$login}' updated",
            "status" => "OK"
        ]));
        return $response->withStatus(200)->withHeader('Content-Type', 'application/json');
    }

    public function channels_delete(Request $request, Response $response, array $args)
    {

        $login = $_POST['login'];

        $streamer_data = TwitchConfig::getChannelByLogin($login);
        
        if (!$streamer_data) {
            $response->getBody()->write(json_encode([
                "message" => "Streamer with that login does not exist in config",
                "status" => "ERROR"
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        $streamer = TwitchChannel::loadFromLogin($login);

        if ($streamer->is_live) {
            $response->getBody()->write(json_encode([
                "message" => "Please wait until the channel has stopped streaming before deleting.",
                "status" => "ERROR"
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        $key = null;
        foreach (TwitchConfig::$channels_config as $k => $v) {
            if ($v['login'] == $login) $key = $k;
        }
        if ($key === null) {
            $response->getBody()->write(json_encode([
                "message" => "Channel {$login} not found.",
                "status" => "ERROR"
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        TwitchHelper::channelUnsubscribe(TwitchChannel::channelIdFromLogin($login));

        /*
        sleep(5);

        if($streamer->getSubscription()){
            $response->getBody()->write(json_encode([
                "message" => "Unsubscribe failed, did not remove streamer {$username}.",
                "status" => "ERROR"
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }
        */

        array_splice(TwitchConfig::$channels_config, $key, 1);

        // unset(TwitchConfig::$config['streamers'][$key]);
        // TwitchConfig::saveConfig("streamer/deleted");
        TwitchConfig::saveChannels();

        $response->getBody()->write(json_encode([
            "message" => "Streamer {$login} deleted.",
            "status" => "OK"
        ]));

        return $response->withStatus(200)->withHeader('Content-Type', 'application/json');
        
    }

}
