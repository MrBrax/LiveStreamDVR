<?php

declare(strict_types=1);

namespace App\Controller\Api;

use Slim\Psr7\Request;
use Slim\Psr7\Response;

use App\TwitchConfig;

class Games
{
    public function games_list(Request $request, Response $response, $args)
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
