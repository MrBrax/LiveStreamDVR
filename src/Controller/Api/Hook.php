<?php
declare(strict_types=1);
namespace App\Controller\Api;

use App\TwitchAutomator;
use Slim\Psr7\Request;
use Slim\Psr7\Response;

use App\TwitchConfig;
use App\TwitchHelper;
use App\TwitchChannel;

class Hook
{
    private function verifySignature($request)
    {
        // calculate signature
        /*
            hmac_message = headers['Twitch-Eventsub-Message-Id'] + headers['Twitch-Eventsub-Message-Timestamp'] + request.body
            signature = hmac_sha256(webhook_secret, hmac_message)
            expected_signature_header = 'sha256=' + signature.hex()

            if headers['Twitch-Eventsub-Message-Signature'] != expected_signature_header:
                return 403
        */

        if (!TwitchConfig::cfg("eventsub_secret")) {
            TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "hook", "No eventsub secret in config.", ['GET' => $_GET, 'POST' => $_POST]);
            return false;
        }

        $twitch_message_id = $request->getHeader("Twitch-Eventsub-Message-Id")[0];
        $twitch_message_timestamp = $request->getHeader("Twitch-Eventsub-Message-Timestamp")[0];
        $twitch_message_signature = $request->getHeader("Twitch-Eventsub-Message-Signature")[0];

        $hmac_message =
            $twitch_message_id .
            $twitch_message_timestamp .
            $request->getBody()->getContents();

        $signature = hash_hmac("sha256", $hmac_message, TwitchConfig::cfg("eventsub_secret"));

        // $signature = hash_hmac("sha256", TwitchConfig::cfg("eventsub_secret"), $hmac_message);
        $expected_signature_header = "sha256=${signature}";

        // check signature
        return $twitch_message_signature === $expected_signature_header;
    }

    public function hook(Request $request, Response $response, $args)
    {

        set_time_limit(0);

        $source = isset($_GET['source']) ? $_GET['source'] : 'twitch';

        try {
            $data_json = json_decode(file_get_contents('php://input'), true);
        } catch (\Throwable $th) {
            TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "hook", "Hook called with invalid JSON.", ['GET' => $_GET, 'POST' => $_POST]);
            $response->getBody()->write("No data supplied");
            return $response;
        }

        $data_headers = $request->getHeaders();
        $post_json = isset($_POST['json']) ? $_POST['json'] : null;

        TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "hook", "Hook called", ['GET' => $_GET, 'POST' => $_POST, 'HEADERS' => $data_headers, 'DATA' => $data_json]);

        if (TwitchConfig::cfg('instance_id')) {
            if (!isset($_GET['instance']) || $_GET['instance'] != TwitchConfig::cfg('instance_id')) {
                TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "hook", "Hook called with the wrong instance (" . $_GET['instance'] . ")");
                $response->getBody()->write("Invalid instance");
                return $response;
            }
        }

        // handle regular hook
        if ($source == 'twitch') {

            if ($post_json) {
                TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "hook", "Custom payload received...");
                $data_json = json_decode($post_json, true);
            }

            if ($data_json) {

                if ($request->getHeader("Twitch-Notification-Id")) {
                    $response->getBody()->write("Outdated format");
                    TwitchHelper::logAdvanced(
                        TwitchHelper::LOG_ERROR,
                        "hook",
                        "Hook got data with old webhook format."
                    );
                    return $response->withStatus(200);
                }

                if (isset($data_json["challenge"]) && $data_json["challenge"] !== null) {

                    $challenge = $data_json["challenge"];
                    $subscription = $data_json["subscription"];

                    $sub_type = $subscription["type"];

                    $channel_id = $subscription["condition"]["broadcaster_user_id"];
                    $channel_login = TwitchChannel::channelLoginFromId($subscription["condition"]["broadcaster_user_id"]);

                    // $username = TwitchHelper::getChannelUsername($subscription["condition"]["broadcaster_user_id"]);

                    // $signature = $response->getHeader("Twitch-Eventsub-Message-Signature");

                    TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "hook", "Challenge received for {$channel_id}:{$sub_type} ({$channel_login}) ({$subscription["id"]})", ['GET' => $_GET, 'POST' => $_POST, 'HEADERS' => $data_headers]);

                    if (!$this->verifySignature($request)) {
                        $response->getBody()->write("Invalid signature check");
                        TwitchHelper::logAdvanced(
                            TwitchHelper::LOG_FATAL,
                            "hook",
                            "Invalid signature check for challenge!"
                        );
                        TwitchConfig::setCache("{$channel_id}.substatus.${sub_type}", TwitchHelper::SUBSTATUS_FAILED);
                        return $response->withStatus(400);
                    }

                    TwitchHelper::logAdvanced(TwitchHelper::LOG_SUCCESS, "hook", "Challenge completed, subscription active for {$channel_id}:{$sub_type} ({$channel_login}) ({$subscription["id"]}).", ['GET' => $_GET, 'POST' => $_POST, 'HEADERS' => $data_headers]);

                    TwitchConfig::setCache("{$channel_id}.substatus.${sub_type}", TwitchHelper::SUBSTATUS_SUBSCRIBED);

                    // return the challenge string to twitch if signature matches
                    $response->getBody()->write($challenge);
                    return $response->withStatus(202);
                }

                if (TwitchConfig::cfg('debug')) {
                    $payload_file = __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . 'payloads' . DIRECTORY_SEPARATOR . date("Y-m-d.h_i_s") . '.json';
                    TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "hook", "Dumping debug hook payload to {$payload_file}");
                    file_put_contents($payload_file, json_encode($data_json));
                }

                // verify message
                if (!$this->verifySignature($request)) {
                    $response->getBody()->write("Invalid signature check");
                    TwitchHelper::logAdvanced(
                        TwitchHelper::LOG_FATAL,
                        "hook",
                        "Invalid signature check for message!"
                    );
                    return $response->withStatus(400);
                }

                TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "hook", "Signature checked, no challenge. Run handle...");
                $TwitchAutomator = new TwitchAutomator();
                $TwitchAutomator->handle($data_json, $data_headers);
                return $response;
            }
        }

        TwitchHelper::logAdvanced(TwitchHelper::LOG_WARNING, "hook", "Hook called with no data ({$source})...", ['GET' => $_GET, 'POST' => $_POST, 'HEADERS' => $data_headers]);
        $response->getBody()->write("No data supplied");

        return $response;
    }
}
