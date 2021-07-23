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

        $headers = $request->getHeaders();

        TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "hook", "Hook called", ['GET' => $_GET, 'POST' => $_POST, 'HEADERS' => $headers]);

        // for use with multiple instances, not very common i think
        if (TwitchConfig::cfg('instance_id')) {
            if (!isset($_GET['instance']) || $_GET['instance'] != TwitchConfig::cfg('instance_id')) {
                TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "hook", "Hook called with the wrong instance (" . $_GET['instance'] . ")");
                $response->getBody()->write("Invalid instance");
                return $response;
            }
        }

        $data_json = json_decode(file_get_contents('php://input'), true);
        $data_headers = $request->getHeaders();

        if($data_json["challenge"]){
            $challenge = $data_json["challenge"];
            $subscription = $data_json["subscription"];
            $username = TwitchHelper::getChannelUsername($subscription["condition"]["broadcaster_user_id"]);
            // $signature = $response->getHeader("Twitch-Eventsub-Message-Signature");
            
            TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "hook", "Challenge received: ${challenge}", ['GET' => $_GET, 'POST' => $_POST, 'HEADERS' => $headers]);

            // calculate signature
            /*
                hmac_message = headers['Twitch-Eventsub-Message-Id'] + headers['Twitch-Eventsub-Message-Timestamp'] + request.body
                signature = hmac_sha256(webhook_secret, hmac_message)
                expected_signature_header = 'sha256=' + signature.hex()

                if headers['Twitch-Eventsub-Message-Signature'] != expected_signature_header:
                    return 403
            */
            $hmac_message = $response->getHeader("Twitch-Eventsub-Message-Id") . $response->getHeader("Twitch-Eventsub-Message-Timestamp") . $response->getBody();
            $signature = hash_hmac("sha256", $hmac_message, TwitchConfig::cfg("eventsub_secret"));
            $expected_signature_header = "sha256=${signature}";
                
            // check signature
            if ($response->getHeader("Twitch-Eventsub-Message-Signature") !== $expected_signature_header){
                $response->getBody()->write("Invalid signature check");
                TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "hook", "Invalid signature check.", ['GET' => $_GET, 'POST' => $_POST, 'HEADERS' => $headers]);
                return $response;
            }

            TwitchHelper::logAdvanced(TwitchHelper::LOG_SUCCESS, "hook", "Challenge completed, subscription active for ${username}.", ['GET' => $_GET, 'POST' => $_POST, 'HEADERS' => $headers]);

            // return the challenge string to twitch if signature matches
            $response->getBody()->write($challenge);
            return $response;

        }

        /*
        // handle hub challenge after subscribing !!!! DEPRECATED !!!!
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

        */

        /*
        $hub_secret = isset($headers['X-Hub-Signature']) ? $headers['X-Hub-Signature'] : null;
        if($hub_secret){
            $is_secret = hash('sha256', TwitchConfig::cfg('sub_secret');
        */


        // handle regular hook

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
            $TwitchAutomator->handle($data_json, $data_headers);
            return $response->withStatus(200);
        }
        

        TwitchHelper::logAdvanced(TwitchHelper::LOG_WARNING, "hook", "Hook called with no data...");
        $response->getBody()->write("No data supplied");

        return $response;
    }
}
