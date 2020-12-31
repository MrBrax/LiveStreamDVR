<?php

declare(strict_types=1);

namespace App\Controller;

use Slim\Psr7\Request;
use Slim\Psr7\Response;

use App\TwitchAutomator;
use App\TwitchConfig;
use App\TwitchHelper;

class HookController
{

    public function hook(Request $request, Response $response, $args)
    {

        TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "hook", "Hook called");

        set_time_limit(0);

        $source = isset($_GET['source']) ? $_GET['source'] : 'twitch';

        // handle hub challenge after subscribing
        if (isset($_GET['hub_challenge'])) {

            $challenge_token = $_GET['hub_challenge'];

            $user_id = null;
            $username = null;
            if ($source == 'twitch') {  // twitch parse channel id
                if (isset($_GET['hub_topic'])) {
                    $user_url = parse_url($_GET['hub_topic']);
                    parse_str($user_url['query'], $user_query);
                    if (isset($user_query['user_id'])) {
                        $user_id = $user_query['user_id'];
                        $username = TwitchHelper::getChannelUsername($user_id);
                    }
                }
            } elseif ($source == 'youtube') { // youtube parse channel id
                $user_url = parse_url($_GET['hub_topic']);
                parse_str($user_url['query'], $user_query);
                if (isset($user_query['channel_id'])) {
                    $user_id = $user_query['channel_id'];
                    $username = $user_query['channel_id'];
                }
            }

            $hub_reason = isset($_GET['hub_reason']) ? $_GET['hub_reason'] : null;

            if (isset($hub_reason)) {
                TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "hook", "Received hub challenge ({$source}) with error for userid {$user_id} ({$username}): {$hub_reason}", ['GET' => $_GET, 'POST' => $_POST, 'user_id' => $user_id]);
            } else {
                TwitchHelper::logAdvanced(TwitchHelper::LOG_SUCCESS, "hook", "Received hub challenge ({$source}) for userid {$user_id} ({$username})", ['GET' => $_GET, 'POST' => $_POST, 'user_id' => $user_id]);
            }

            // todo: use some kind of memcache for this instead
            $hc = TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . "hubchallenge_{$user_id}";
            if (file_exists($hc) && time() < (int)file_get_contents($hc) + 30) {
                TwitchHelper::logAdvanced(TwitchHelper::LOG_SUCCESS, "hook", "Successfully subscribed to userid {$user_id} ({$username}) on {$source}", ['GET' => $_GET, 'POST' => $_POST, 'user_id' => $user_id]);
                unlink($hc);
            }

            // just write the response back without checking anything
            $response->getBody()->write($challenge_token);

            return $response;
        }


        // handle regular hook

        if ($source == 'twitch') {
            $data_json = json_decode(file_get_contents('php://input'), true);
            $post_json = isset($_POST['json']) ? $_POST['json'] : null;
            if ($post_json) {
                TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "hook", "Custom payload received...");
                $data_json = json_decode($post_json, true);
            }

            if ($data_json) {

                if (TwitchConfig::cfg('debug')) {
                    TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "hook", "Dumping payload...");
                    file_put_contents(__DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . 'payloads' . DIRECTORY_SEPARATOR . date("Y-m-d.h_i_s") . '.json', json_encode($data_json));
                }

                TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "hook", "Run handle...");
                $TwitchAutomator = new TwitchAutomator();
                $TwitchAutomator->handle($data_json);
                return $response;
            }
        } elseif ($source == 'youtube') {
            $data_xml = simplexml_load_string(file_get_contents('php://input'), true);
            TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "hook", "Hook called YouTube data...", ['xml' => $data_xml, 'GET' => $_GET, 'POST' => $_POST]);
            return $response;
        }

        TwitchHelper::logAdvanced(TwitchHelper::LOG_WARNING, "hook", "Hook called with no data ({$source})...");
        $response->getBody()->write("No data supplied");

        return $response;
    }
}
