<?php

declare(strict_types=1);

namespace App\Controller\Api;

use Slim\Psr7\Request;
use Slim\Psr7\Response;

use App\TwitchConfig;

class Games
{

    /**
     * GET /api/v0/games
     * List games in cache
     *
     * @param Request $request
     * @param Response $response
     * @param array $args
     * @return Response
     */
    public function games_list(Request $request, Response $response, array $args)
    {

        $games = TwitchConfig::getGames();

        $payload = json_encode([
            'data' => $games,
            'status' => 'OK'
        ]);

        $response->getBody()->write($payload);
        return $response->withHeader('Content-Type', 'application/json');
    }
}
