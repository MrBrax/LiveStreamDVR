<?php

namespace App\Traits;

use Slim\Psr7\Request;
use Slim\Psr7\Response;

use App\TwitchConfig;
use App\TwitchHelper;

trait ApiFavourites
{

    public function favourites_list(Request $request, Response $response, array $args)
    {

        $games = [];

        foreach (TwitchConfig::$config['favourites'] as $game_id => $is_favourite) {
            $games[] = [
                'id' => $game_id,
                'data' => TwitchHelper::getGameData($game_id)
            ];
        }

        $payload = json_encode([
            'data' => $games,
            'status' => 'OK'
        ]);

        $response->getBody()->write($payload);
        return $response->withHeader('Content-Type', 'application/json')->withHeader('Access-Control-Allow-Origin', '*');
    }

    public function favourites_save(Request $request, Response $response, array $args)
    {

        $games = $_POST['games'];

        $data = [];
        foreach ($games as $id => $value) {
            $data[$id] = true;
        }

        TwitchConfig::$config['favourites'] = $data;
        TwitchConfig::saveConfig("favourites/save");

        $payload = json_encode([
            'message' => "Favourites saved.",
            'status' => 'OK'
        ]);

        $response->getBody()->write($payload);
        return $response->withHeader('Content-Type', 'application/json')->withHeader('Access-Control-Allow-Origin', '*');
    }
}
