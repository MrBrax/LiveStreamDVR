<?php

namespace App\Controller\Api;

use Slim\Psr7\Request;
use Slim\Psr7\Response;

use App\TwitchConfig;
use App\TwitchHelper;

class Favourites
{

    /**
     * GET /api/v0/favourites
     * List favourite games
     *
     * @param Request $request
     * @param Response $response
     * @param array $args
     * @return Response
     */
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

    /**
     * PUT /api/v0/favourites
     * Save favourite games
     *
     * @param Request $request
     * @param Response $response
     * @param array $args
     * @return Response
     */
    public function favourites_save(Request $request, Response $response, array $args)
    {

        $formdata = $request->getParsedBody();
        $games = isset($formdata['games']) ? $formdata['games'] : null;

        $data = [];
        if ($games) {
            foreach ($games as $id => $value) {
                $data[$id] = true;
            }
        }

        TwitchConfig::$config['favourites'] = $data;
        TwitchConfig::saveConfig("favourites/save");

        $payload = json_encode([
            "message" => $games ? "Favourites saved." : "Favourites cleared.",
            "status" => "OK"
        ]);

        $response->getBody()->write($payload);
        return $response->withHeader('Content-Type', 'application/json')->withHeader('Access-Control-Allow-Origin', '*');
    }
}
