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
                $response->getBody()->write("Error: {$ret}");
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

        $subs = TwitchHelper::getSubs();

        if ($subs['data']) {

            $response->getBody()->write("Total: {$subs['total']}<br>");

            foreach ($subs['data'] as $data) {

                $user_id = explode("=", $data['topic'])[1];

                $user_data = TwitchHelper::getChannelData(TwitchHelper::getChannelUsername($user_id));

                $response->getBody()->write("<h1>{$user_data['display_name']}</h1>");
                $response->getBody()->write("Topic: {$data['topic']}");
                $response->getBody()->write("<br>Callback: {$data['callback']}");
                if ($data['callback'] !== TwitchConfig::cfg('app_url') . '/hook') {
                    $response->getBody()->write(" (does not match this instance app url)");
                }
                $response->getBody()->write("");
                $response->getBody()->write("<br>Expires at: {$data['expires_at']}");
            }
        } else {
            $response->getBody()->write("Data error. " . json_encode($subs));
        }

        return $response;
    }

    public function unsub_all(Request $request, Response $response, $args)
    {
        TwitchHelper::unsubAll();
        $response->getBody()->write("Unsubbed from all.");
        return $response;
    }
}
