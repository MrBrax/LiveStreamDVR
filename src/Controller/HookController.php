<?php

declare(strict_types=1);

namespace App\Controller;

use Slim\Psr7\Request;
use Slim\Psr7\Response;

use App\TwitchAutomator;
use App\TwitchAutomatorYouTube;
use App\TwitchConfig;
use App\TwitchHelper;
use App\YouTubeHelper;

class HookController
{

    /**
     * This is the core of the entire project, this is what the Twitch webhook calls when a streamer goes online, or changes their game/title. 
     *
     * @param Request $request
     * @param Response $response
     * @param array $args
     * @return void
     */
    public function hook(Request $request, Response $response, $args)
    {

        set_time_limit(0);

        $source = isset($_GET['source']) ? $_GET['source'] : 'twitch';

        $headers = $request->getHeaders();

        TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "hook", "Hook called", ['GET' => $_GET, 'POST' => $_POST, 'HEADERS' => $headers]);

        if (TwitchConfig::cfg('instance_id')) {
            if (!isset($_GET['instance']) || $_GET['instance'] != TwitchConfig::cfg('instance_id')) {
                TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "hook", "Hook called with the wrong instance (" . $_GET['instance'] . ")");
                $response->getBody()->write("Invalid instance");
                return $response;
            }
        }

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
                    $username = YouTubeHelper::getChannelUsername($user_query['channel_id']);
                }
            }

            $hub_reason = isset($_GET['hub_reason']) ? $_GET['hub_reason'] : null;

            $hub_mode = isset($_GET['hub_mode']) ? $_GET['hub_mode'] : null;

            if (isset($hub_reason)) {
                TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "hook", "Received error on hub challenge from {$source} for {$username} ({$user_id}) when trying to {$hub_mode}: {$hub_reason}", ['GET' => $_GET, 'POST' => $_POST, 'HEADERS' => $headers, 'user_id' => $user_id]);
            } else {
                TwitchHelper::logAdvanced(TwitchHelper::LOG_SUCCESS, "hook", "Received hub challenge from {$source} for userid {$username} ({$user_id}) when trying to {$hub_mode}", ['GET' => $_GET, 'POST' => $_POST, 'HEADERS' => $headers, 'user_id' => $user_id]);
            }

            // todo: use some kind of memcache for this instead
            $hc = TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . "hubchallenge_{$user_id}";
            if (file_exists($hc) && time() < (int)file_get_contents($hc) + 30) {
                TwitchHelper::logAdvanced(TwitchHelper::LOG_SUCCESS, "hook", "Successfully {$hub_mode}d to userid {$user_id} ({$username}) on {$source}", ['GET' => $_GET, 'POST' => $_POST, 'HEADERS' => $headers, 'user_id' => $user_id]);
                unlink($hc);
            }

            // just write the response back without checking anything
            $response->getBody()->write($challenge_token);

            return $response;
        }

        /*
        $hub_secret = isset($headers['X-Hub-Signature']) ? $headers['X-Hub-Signature'] : null;
        if($hub_secret){
            $is_secret = hash('sha256', TwitchConfig::cfg('sub_secret');
        */


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
            $data_xml = simplexml_load_string(file_get_contents('php://input'), "SimpleXMLElement", LIBXML_NOCDATA);
            $data_json = json_decode(json_encode($data_xml), true);
            TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "hook", "Hook called YouTube data...", ['xml' => $data_xml, 'json' => $data_json, 'GET' => $_GET, 'POST' => $_POST, 'HEADERS' => $headers]);
            $TwitchAutomator = new TwitchAutomatorYouTube();
            $TwitchAutomator->handle($data_json);
            return $response;
        }

        TwitchHelper::logAdvanced(TwitchHelper::LOG_WARNING, "hook", "Hook called with no data ({$source})...");
        $response->getBody()->write("No data supplied");

        return $response;
    }
}
