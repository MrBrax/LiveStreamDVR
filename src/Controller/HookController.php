<?php

namespace App\Controller;

use Slim\Psr7\Request;
use Slim\Psr7\Response;

use App\TwitchAutomator;
use App\TwitchHelper;

class HookController
{

    public function hook(Request $request, Response $response, $args)
    {

        TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Hook called");

        $TwitchAutomator = new TwitchAutomator();

        set_time_limit(0);

        if (isset($_GET['hub_challenge'])) {
            $response->getBody()->write($_GET['hub_challenge']);
            return $response;
        }

        if (isset($_GET['hub.challenge'])) {
            $response->getBody()->write($_GET['hub.challenge']);
            return $response;
        }

        $data = json_decode(file_get_contents('php://input'), true);

        $post_json = isset($_POST['json']) ? $_POST['json'] : null;

        if ($post_json) {
            TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Custom payload received...");
            $data = json_decode($post_json, true);
        }

        if ($data) {

            TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Dumping payload...");
            file_put_contents(__DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . 'payloads' . DIRECTORY_SEPARATOR . date("Y-m-d.h_i_s") . '.json', json_encode($data));

            /*
            $data_id = $data['data'][0]['id'];
            $data_title = $data['data'][0]['title'];
            $data_started = $data['data'][0]['started_at'];
            $data_game_id = $data['data'][0]['game_id'];
            $data_username = $data['data'][0]['user_name'];
            */

            TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Run handle...");
            $TwitchAutomator->handle($data);
        } else {

            TwitchHelper::log(TwitchHelper::LOG_WARNING, "Hook called with no data...");
            $response->getBody()->write("No data supplied");
        }

        return $response;
    }
}
