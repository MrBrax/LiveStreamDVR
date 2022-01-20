<?php

declare(strict_types=1);

namespace App\Traits;

use Slim\Psr7\Request;
use Slim\Psr7\Response;

use App\TwitchConfig;
use App\TwitchHelper;
use App\TwitchAutomatorJob;
use App\TwitchChannel;
use Symfony\Component\Process\Process;

trait ApiSubs
{

    public function subscriptions_sub(Request $request, Response $response, $args)
    {

        $channels = TwitchConfig::getChannels();

        $payload_data = [
            'channels' => []
        ];

        foreach ($channels as $channel) {

            $entry = [];
            $entry['login'] = $channel->login;
            $ret = TwitchHelper::channelSubscribe($channel->userid);

            if ($ret === true) {
                $entry['status'] = 'Subscription request sent, check logs for details';
            } else {
                $entry['status'] = "Error: {$ret}";
                // $payload_data['channels'][] = $entry;
                // break;
            }

            $payload_data['channels'][] = $entry;
        }

        if (count($channels) == 0) {
            $response->getBody()->write(json_encode([
                "message" => "No channels to subscribe to.",
                "status" => "ERROR"
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        $response->getBody()->write(json_encode([
            "data" => $payload_data,
            "status" => "OK"
        ]));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function subscriptions_list(Request $request, Response $response, $args)
    {

        $subs = TwitchHelper::getSubs();

        // $response->getBody()->write(json_encode($subs));
        // return $response->withStatus(400)->withHeader('Content-Type', 'application/json');

        if (isset($subs['total']) && $subs['total'] > 0) {

            // $response->getBody()->write("Total: {$subs['total']}<br>");

            $all_usernames = [];

            $payload_data = [
                'channels' => [],
                'total' => $subs['total']
            ];

            foreach ($subs['data'] as $data) {

                $entry = [];

                /*
                $user_id = explode("=", $data['topic'])[1];

                $u = TwitchHelper::getChannelUsername($user_id);

                if (!$u) {
                    $entry['user_id'] = $user_id;
                    $entry['error'] = "Could not get username, did it not get cached?";
                    $payload_data['channels'][] = $entry;
                    continue;
                }

                $user_data = TwitchHelper::getChannelData($user_id);
                $username = $user_data['display_name'];

                $entry['username']          = $username;
                $entry['user_id']           = $user_id;
                $entry['topic']             = $data['topic'];
                $entry['callback']          = $data['callback'];
                $entry['instance_match']    = $data['callback'] == TwitchConfig::cfg('app_url') . '/hook' . (TwitchConfig::cfg('instance_id') ? '?instance=' . TwitchConfig::cfg('instance_id') : '');
                $entry['expires_at']        = $data['expires_at'];
                $entry['already_exists']    = isset($all_usernames[mb_strtolower($username)]);

                $all_usernames[mb_strtolower($username)] = true;
                */

                $entry['type']              = $data['type'];
                $entry['id']                = $data['id'];
                $entry['username']          = TwitchChannel::channelLoginFromId($data['condition']['broadcaster_user_id']);
                $entry['user_id']           = $data['condition']['broadcaster_user_id'];
                $entry['callback']          = $data['transport']['callback'];
                $entry['instance_match']    = $data['transport']['callback'] == TwitchConfig::cfg('app_url') . '/hook' . (TwitchConfig::cfg('instance_id') ? '?instance=' . TwitchConfig::cfg('instance_id') : '');
                $entry['status']            = $data['status'];
                $entry['created_at']        = $data['created_at'];
                // $entry['expires_at']        = $data['expires_at'];

                $payload_data['channels'][] = $entry;
            }

            $payload_data['all_usernames'] = $all_usernames;

            $response->getBody()->write(json_encode([
                "data" => $payload_data,
                "status" => "OK"
            ]));
            return $response->withHeader('Content-Type', 'application/json');
        } elseif (isset($subs['total']) && $subs['total'] == 0) {
            $response->getBody()->write(json_encode([
                "message" => "No subscriptions. Let cron do its job or visit the sub page.",
                "status" => "ERROR"
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        } else {
            $response->getBody()->write(json_encode([
                "message" => "Data error.",
                "data" => json_encode($subs),
                "status" => "ERROR"
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }
    }

    public function subscriptions_unsub(Request $request, Response $response, $args)
    {

        /*
        $override = $_GET['override'];

        if($override){
            TwitchHelper::channelUnsubscribe(TwitchChannel::channelIdFromLogin($override));
        }else{
            foreach (TwitchConfig::$channels_config as $k => $v) {
                TwitchHelper::channelUnsubscribe(TwitchChannel::channelIdFromLogin($v['login']));
            }
        }
        */

        $id = $_GET['id'];

        TwitchHelper::eventSubUnsubscribe($id);

        $response->getBody()->write(json_encode([
            "message" => "Unsubscribed from ${id}.",
        ]));
        return $response->withStatus(200)->withHeader('Content-Type', 'application/json');
    }

}
