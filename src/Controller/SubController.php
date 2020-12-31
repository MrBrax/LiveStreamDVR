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

        if (isset($subs['total']) && $subs['total'] > 0) {

            $response->getBody()->write("Total: {$subs['total']}<br>");

            $all_usernames = [];

            foreach ($subs['data'] as $data) {

                $user_id = explode("=", $data['topic'])[1];

                $u = TwitchHelper::getChannelUsername($user_id);

                if (!$u) {
                    $response->getBody()->write("<h1>{$user_id}</h1>Could not get username, did it not get cached?");
                    continue;
                }

                $user_data = TwitchHelper::getChannelData($u);
                $username = $user_data['display_name'];

                $response->getBody()->write("<h1>{$username}</h1>");
                $response->getBody()->write("<strong>Topic:</strong> {$data['topic']}");
                $response->getBody()->write("<br><strong>Callback:</strong> {$data['callback']}");
                if ($data['callback'] !== TwitchConfig::cfg('app_url') . '/hook' . ( TwitchConfig::cfg('instance_id') ? '?instance=' . TwitchConfig::cfg('instance_id') : '' ) ) {
                    $response->getBody()->write(" (does not match this instance app url)");
                }
                $response->getBody()->write("<br><strong>Expires at:</strong> {$data['expires_at']}");

                if (isset($all_usernames[mb_strtolower($username)])) {
                    $response->getBody()->write("<br><strong style='color:#f00'>Warning! This username already exists for this client id!</strong>");
                }

                $all_usernames[mb_strtolower($username)] = true;
            }
        } elseif (isset($subs['total']) && $subs['total'] == 0) {
            $response->getBody()->write("No subscriptions. Let cron do its job or visit /sub");
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
