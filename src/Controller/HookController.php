<?php

namespace App\Controller;

use Slim\Psr7\Request;
use Slim\Psr7\Response;

use App\TwitchAutomator;

class HookController
{

    public function hook( Request $request, Response $response, $args )
    {
        $TwitchAutomator = new TwitchAutomator();

        set_time_limit(0);

        if ( isset( $_GET['hub_challenge'] ) ) {
            $response->getBody()->write( $_GET['hub_challenge'] );
            return $response;
        }

        if ( isset( $_GET['hub.challenge'] ) ) {
            $response->getBody()->write( $_GET['hub.challenge'] );
            return $response;
        }

        $data = json_decode(file_get_contents('php://input'), true);

        $post_json = isset( $_POST['json'] ) ? $_POST['json'] : null;

        if ($post_json) {
            $data = json_decode($post_json, true);
        }

        if ($data) {

            file_put_contents( __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . 'payloads' . DIRECTORY_SEPARATOR . date("Y-m-d.h_i_s") . '.json', json_encode($data) );

            $data_id = $data['data'][0]['id'];
            $data_title = $data['data'][0]['title'];
            $data_started = $data['data'][0]['started_at'];
            $data_game_id = $data['data'][0]['game_id'];
            $data_username = $data['data'][0]['user_name'];

            $TwitchAutomator->handle($data);

        } else {
            
            $response->getBody()->write("No data supplied");

        }

        return $response;

    }
}