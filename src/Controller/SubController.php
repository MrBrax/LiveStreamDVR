<?php

declare(strict_types=1);

namespace App\Controller;

use Slim\Psr7\Request;
use Slim\Psr7\Response;

use App\TwitchAutomator;
use App\TwitchConfig;
use App\TwitchHelper;

class SubController
{

    public function sub(Request $request, Response $response, $args)
    {

        $response->getBody()->write('<h1>Subbing...</h1>');

        $streamers = TwitchConfig::getStreamers();

        foreach ($streamers as $k => $v) {

            $username = $v['username'];

            $response->getBody()->write('<strong>Subbing to ' . $username . '...</strong>');

            $response->getBody()->write('<pre>');

            $ret = TwitchHelper::sub($username);

            if ($ret === true) {
                $response->getBody()->write('Subscription request sent, check logs for details');
            } else {
                $response->getBody()->write("Error: " . $ret);
            }

            $response->getBody()->write('</pre>');

            $response->getBody()->write('<hr />');

            // sleep(2);

        }

        if (count($streamers) == 0) $response->getBody()->write('No channels to subscribe to');

        return $response;
    }

    public function subs(Request $request, Response $response, $args)
    {

        var_dump(TwitchHelper::getSubs());

        return $response;
    }
}
