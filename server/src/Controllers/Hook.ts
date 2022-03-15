import { TwitchChannel } from "../Core/TwitchChannel";
import { TwitchConfig } from "../Core/TwitchConfig";
import { TwitchHelper } from "../Core/TwitchHelper";
import express from "express";
import crypto from "crypto";
import path from "path";
import { AppRoot } from "../Core/BaseConfig";
import fs from "fs";
import { TwitchAutomator } from "../Core/TwitchAutomator";
import { EventSubResponse } from "../TwitchAPI/EventSub";
import { ChallengeResponse } from "../TwitchAPI/Challenge";
import { LOGLEVEL, TwitchLog } from "../Core/TwitchLog";
import { KeyValue } from "../Core/KeyValue";

export class Hook {

    private verifySignature(request: express.Request): boolean {

        // calculate signature
        /*
            hmac_message = headers['Twitch-Eventsub-Message-Id'] + headers['Twitch-Eventsub-Message-Timestamp'] + request.body
            signature = hmac_sha256(webhook_secret, hmac_message)
            expected_signature_header = 'sha256=' + signature.hex()

            if headers['Twitch-Eventsub-Message-Signature'] != expected_signature_header:
                return 403
        */

        if (!TwitchConfig.cfg("eventsub_secret")) {
            TwitchLog.logAdvanced(LOGLEVEL.ERROR, "hook", "No eventsub secret in config.");
            return false;
        }

        const twitch_message_id = request.header("Twitch-Eventsub-Message-Id");
        const twitch_message_timestamp = request.header("Twitch-Eventsub-Message-Timestamp");
        const twitch_message_signature = request.header("Twitch-Eventsub-Message-Signature");

        /*
        $hmac_message =
            $twitch_message_id .
            $twitch_message_timestamp .
            $request->getBody()->getContents();

        $signature = hash_hmac("sha256", $hmac_message, TwitchConfig::cfg("eventsub_secret"));

        $expected_signature_header = "sha256=${signature}";

        // check signature
        return $twitch_message_signature === $expected_signature_header;
        */

        if (!twitch_message_id || !twitch_message_timestamp || !twitch_message_signature) {
            TwitchLog.logAdvanced(LOGLEVEL.ERROR, "hook", "Missing twitch headers.");
            return false;
        }

        const hmac_message = twitch_message_id + twitch_message_timestamp + request.body;

        const signature = crypto.createHmac("sha256", TwitchConfig.cfg("eventsub_secret"))
            .update(hmac_message)
            .digest("hex");

        const expected_signature_header = "sha256=" + signature;

        return twitch_message_signature === expected_signature_header;

    }

    Hook(req: express.Request, res: express.Response): void
    {

        const source = req.query.source ?? "twitch";

        /*
        try {
            $data_json = json_decode(file_get_contents('php://input'), true);
        } catch (\Throwable $th) {
            TwitchLog.logAdvanced(LOGLEVEL.ERROR, "hook", "Hook called with invalid JSON.", ['GET' => $_GET, 'POST' => $_POST]);
            $response->getBody()->write("No data supplied");
            return $response;
        }
        */

        const data_json: EventSubResponse | ChallengeResponse = req.body;

        // $data_headers = $request->getHeaders();
        // $post_json = isset($_POST['json']) ? $_POST['json'] : null;

        const debugMeta = {"GET": req.query, "POST": req.body, "HEADERS": req.headers, "DATA": data_json};

        TwitchLog.logAdvanced(LOGLEVEL.INFO, "hook", "Hook called", debugMeta);

        if (TwitchConfig.cfg("instance_id")) {
            if (!req.query.instance || req.query.instance != TwitchConfig.cfg("instance_id")) {
                TwitchLog.logAdvanced(LOGLEVEL.ERROR, "hook", `Hook called with the wrong instance (${req.query.instance})`);
                res.send("Invalid instance");
                return;
            }
        }

        // handle regular hook
        if (source == "twitch") {

            // if (post_json) {
            //     TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "hook", "Custom payload received...");
            //     $data_json = json_decode($post_json, true);
            // }

            if (data_json) {

                if (req.header("Twitch-Notification-Id")) {
                    
                    TwitchLog.logAdvanced(
                        LOGLEVEL.ERROR,
                        "hook",
                        "Hook got data with old webhook format."
                    );
                    res.status(400).send("Outdated format");
                }

                if ("challenge" in data_json && data_json.challenge !== null) {

                    const challenge = data_json.challenge;
                    const subscription = data_json.subscription;

                    const sub_type = subscription.type;

                    const channel_id = subscription["condition"]["broadcaster_user_id"];
                    const channel_login = TwitchChannel.channelLoginFromId(subscription.condition.broadcaster_user_id);

                    // $username = TwitchHelper::getChannelUsername($subscription["condition"]["broadcaster_user_id"]);

                    // $signature = $response->getHeader("Twitch-Eventsub-Message-Signature");

                    TwitchLog.logAdvanced(LOGLEVEL.INFO, "hook", `Challenge received for ${channel_id}:${sub_type} (${channel_login}) (${subscription["id"]})`, debugMeta);

                    if (!this.verifySignature(req)) {
                        
                        TwitchLog.logAdvanced(
                            LOGLEVEL.FATAL,
                            "hook",
                            "Invalid signature check for challenge!"
                        );
                        KeyValue.set(`${channel_id}.substatus.${sub_type}`, TwitchHelper.SUBSTATUS.FAILED);
                        res.status(400).send("Invalid signature check");
                    }

                    TwitchLog.logAdvanced(LOGLEVEL.SUCCESS, "hook", `Challenge completed, subscription active for ${channel_id}:${sub_type} (${channel_login}) (${subscription["id"]}).`, debugMeta);

                    KeyValue.set(`${channel_id}.substatus.${sub_type}`, TwitchHelper.SUBSTATUS.SUBSCRIBED);

                    // return the challenge string to twitch if signature matches
                    res.status(202).send(challenge);
                    return;
                }

                if (TwitchConfig.cfg("debug")) {
                    // $payload_file = __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . 'payloads' . DIRECTORY_SEPARATOR . date("Y-m-d.h_i_s") . '.json';
                    const payload_file = path.join(AppRoot, "payloads", new Date().toISOString().replace(/[-:.]/g, "_") + ".json");
                    TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "hook", `Dumping debug hook payload to ${payload_file}`);
                    fs.writeFileSync(payload_file, JSON.stringify(data_json));
                }

                // verify message
                if (!this.verifySignature(req)) {
                    TwitchLog.logAdvanced(
                        LOGLEVEL.FATAL,
                        "hook",
                        "Invalid signature check for message!"
                    );
                    res.status(400).send("Invalid signature check");
                }

                if ("event" in data_json) {
                    TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "hook", "Signature checked, no challenge. Run handle...");
                    const TA = new TwitchAutomator();
                    TA.handle(data_json, req.headers);
                    res.status(200).send("");
                    return;
                } else {
                    TwitchLog.logAdvanced(LOGLEVEL.ERROR, "hook", "No event in message!");
                    res.status(400).send("No event in message");
                    return;
                }
            }
        }

        TwitchLog.logAdvanced(LOGLEVEL.WARNING, "hook", `Hook called with no data (${source})...`, debugMeta);

        res.status(400).send("No data supplied");
        return;
    }
}
