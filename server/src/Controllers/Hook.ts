import { BaseConfigDataFolder } from "@/Core/BaseConfig";
import { Config } from "@/Core/Config";
import { KeyValue } from "@/Core/KeyValue";
import { log, LOGLEVEL } from "@/Core/Log";
import type { AutomatorMetadata } from "@/Core/Providers/Twitch/TwitchAutomator";
import { TwitchAutomator } from "@/Core/Providers/Twitch/TwitchAutomator";
import { TwitchChannel } from "@/Core/Providers/Twitch/TwitchChannel";
import { SubStatus } from "@common/Defs";
import type { ChallengeResponse } from "@common/TwitchAPI/Challenge";
import type { EventSubResponse } from "@common/TwitchAPI/EventSub";
import type express from "express";
import { XMLParser } from "fast-xml-parser";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const verifyTwitchSignature = (request: express.Request): boolean => {
    // calculate signature
    /*
            hmac_message = headers['Twitch-Eventsub-Message-Id'] + headers['Twitch-Eventsub-Message-Timestamp'] + request.body
            signature = hmac_sha256(webhook_secret, hmac_message)
            expected_signature_header = 'sha256=' + signature.hex()

            if headers['Twitch-Eventsub-Message-Signature'] != expected_signature_header:
                return 403
        */

    if (!Config.getInstance().hasValue("eventsub_secret")) {
        log(
            LOGLEVEL.ERROR,
            "hook.verifyTwitchSignature",
            "No eventsub secret in config."
        );
        return false;
    }

    const twitch_message_id = request.header("Twitch-Eventsub-Message-Id");
    const twitch_message_timestamp = request.header(
        "Twitch-Eventsub-Message-Timestamp"
    );
    const twitch_message_signature = request.header(
        "Twitch-Eventsub-Message-Signature"
    );

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

    if (
        !twitch_message_id ||
        !twitch_message_timestamp ||
        !twitch_message_signature
    ) {
        log(
            LOGLEVEL.ERROR,
            "hook.verifyTwitchSignature",
            "Missing twitch headers for signature check."
        );
        return false;
    }

    // const body = JSON.stringify(request.body); // needs raw body
    const body = (request as any).rawBody.toString();

    const hmac_message = twitch_message_id + twitch_message_timestamp + body;

    const signature = crypto
        .createHmac("sha256", Config.getInstance().cfg("eventsub_secret"))
        .update(hmac_message)
        .digest("hex");

    const expected_signature_header = "sha256=" + signature;

    if (twitch_message_signature !== expected_signature_header) {
        console.log(
            `Signature mismatch: ${twitch_message_signature} != ${expected_signature_header}`
        );
    }

    return twitch_message_signature === expected_signature_header;
};

export async function HookTwitch(
    req: express.Request,
    res: express.Response
): Promise<void> {
    // console.log("Body", req.body, req.body.toString(), JSON.stringify(req.body));

    const data_json: EventSubResponse | ChallengeResponse = req.body;

    const debugMeta = {
        GET: req.query,
        POST: req.body,
        HEADERS: req.headers,
        DATA: data_json,
    };

    const messageId = req.header("Twitch-Eventsub-Message-Id");
    const messageRetry = req.header("Twitch-Eventsub-Message-Retry");
    const messageType = req.header("Twitch-Eventsub-Message-Type");
    const messageSignature = req.header("Twitch-Eventsub-Message-Signature");
    const messageTimestamp = req.header("Twitch-Eventsub-Message-Timestamp");
    const subscriptionType = req.header("Twitch-Eventsub-Subscription-Type");
    const subscriptionVersion = req.header(
        "Twitch-Eventsub-Subscription-Version"
    );
    const subscriptionBatching = req.header(
        "Twitch-Eventsub-Subscription-Is-Batching-Enabled"
    );

    log(
        LOGLEVEL.INFO,
        "hook.HookTwitch",
        `Hook called with message ID ${messageId}, s-version ${subscriptionVersion}, s-type ${subscriptionType}, b ${subscriptionBatching} (m-retry ${messageRetry}, m-type ${messageType}, m-date ${messageTimestamp})`,
        debugMeta
    );

    if (Config.getInstance().hasValue("instance_id")) {
        if (
            !req.query.instance ||
            req.query.instance != Config.getInstance().cfg("instance_id")
        ) {
            log(
                LOGLEVEL.ERROR,
                "hook.HookTwitch",
                `Hook called with the wrong instance (${
                    req.query.instance
                } != ${Config.getInstance().cfg("instance_id")})`,
                debugMeta
            );
            res.send("Invalid instance");
            return;
        }
    }

    // handle regular hook
    if (data_json && Object.keys(data_json).length > 0) {
        if (req.header("Twitch-Notification-Id")) {
            log(
                LOGLEVEL.ERROR,
                "hook.HookTwitch",
                "Hook got data with old webhook format."
            );
            res.status(400).send("Outdated format");
            return;
        }

        // handle challenge, return challenge string
        if ("challenge" in data_json && data_json.challenge !== null) {
            const challenge = data_json.challenge;
            const subscription = data_json.subscription;

            const sub_type = subscription.type;

            const channel_id = subscription["condition"]["broadcaster_user_id"];
            const channel_login = await TwitchChannel.channelLoginFromId(
                subscription.condition.broadcaster_user_id
            );

            // $username = TwitchHelper::getChannelUsername($subscription["condition"]["broadcaster_user_id"]);

            // $signature = $response->getHeader("Twitch-Eventsub-Message-Signature");

            log(
                LOGLEVEL.INFO,
                "hook.HookTwitch",
                `Challenge received for ${channel_id}:${sub_type} (${channel_login}) (${subscription["id"]}), retry ${messageRetry}`,
                debugMeta
            );

            if (!verifyTwitchSignature(req)) {
                log(
                    LOGLEVEL.FATAL,
                    "hook.HookTwitch",
                    "Invalid signature check for challenge!"
                );
                KeyValue.getInstance().set(
                    `${channel_id}.substatus.${sub_type}`,
                    SubStatus.FAILED
                );
                res.status(400).send("Invalid signature check for challenge");
            }

            log(
                LOGLEVEL.SUCCESS,
                "hook.HookTwitch",
                `Challenge completed, subscription active for ${channel_id}:${sub_type} (${channel_login}) (${subscription["id"]}), retry ${messageRetry}.`,
                debugMeta
            );

            KeyValue.getInstance().set(
                `${channel_id}.substatus.${sub_type}`,
                SubStatus.SUBSCRIBED
            );

            // return the challenge string to twitch if signature matches
            res.status(202).send(challenge);
            return;
        }

        // dump payload
        if (
            Config.debug ||
            Config.getInstance().cfg<boolean>("dump_payloads")
        ) {
            let payload_filename = `tw_${new Date()
                .toISOString()
                .replaceAll(/[-:.]/g, "_")}`;
            if (data_json.subscription.type)
                payload_filename += `_${data_json.subscription.type}`;
            payload_filename += ".json";
            const payload_filepath = path.join(
                BaseConfigDataFolder.payloads,
                payload_filename
            );
            log(
                LOGLEVEL.INFO,
                "hook.HookTwitch",
                `Dumping debug hook payload to ${payload_filepath}`
            );
            try {
                fs.writeFileSync(
                    payload_filepath,
                    JSON.stringify(
                        {
                            headers: req.headers,
                            body: data_json,
                            query: req.query,
                            ip: req.ip,
                        },
                        null,
                        4
                    )
                );
            } catch (error) {
                log(
                    LOGLEVEL.ERROR,
                    "hook.HookTwitch",
                    `Failed to dump payload to ${payload_filepath}`,
                    error
                );
            }
        }

        // verify message
        if (!verifyTwitchSignature(req)) {
            log(
                LOGLEVEL.FATAL,
                "hook.HookTwitch",
                "Invalid signature check for message!",
                debugMeta
            );
            res.status(400).send("Invalid signature check");
            return;
        }

        // handle message with automator
        if ("event" in data_json) {
            log(
                LOGLEVEL.DEBUG,
                "hook.HookTwitch",
                `Signature checked, no challenge, retry ${messageRetry}. Run handle...`
            );

            if (messageType !== "notification") {
                log(
                    LOGLEVEL.ERROR,
                    "hook.HookTwitch",
                    `Invalid message type ${messageType}!`,
                    debugMeta
                );
            }

            const metadata_proxy: AutomatorMetadata = {
                message_id: messageId as string,
                message_retry: parseInt((messageRetry as string) || "0"),
                message_type: "notification",
                message_signature: messageSignature as string,
                message_timestamp: messageTimestamp as string,
                subscription_type: subscriptionType as string,
                subscription_version: subscriptionVersion as string,
            };

            const TA = new TwitchAutomator();
            /* await */ TA.handle(data_json, metadata_proxy).catch((error) => {
                log(
                    LOGLEVEL.FATAL,
                    "hook.HookTwitch",
                    `Automator returned error: ${error.message}`
                );
            });
            res.status(200).send("");
            return;
        } else {
            log(LOGLEVEL.ERROR, "hook.HookTwitch", "No event in message!");
            res.status(400).send("No event in message");
            return;
        }
    } else {
        log(
            LOGLEVEL.ERROR,
            "hook.HookTwitch",
            "Hook called with invalid JSON."
        );
        res.status(400).send("No data supplied");
        return;
    }

    log(
        LOGLEVEL.WARNING,
        "hook.HookTwitch",
        "Hook called with no data...",
        debugMeta
    );

    res.status(400).send("No data supplied");
    return;
}

/**
 * TODO: implement, currently youtube does not broadcast events related to live streams
 * @param req
 * @param res
 * @returns
 */
export async function HookYouTube(
    req: express.Request,
    res: express.Response
): Promise<void> {
    // console.log("Body", req.body, req.body.toString(), JSON.stringify(req.body));

    // const data_json: EventSubResponse | ChallengeResponse = req.body;

    const debugMeta = {
        GET: req.query,
        POST: req.body,
        HEADERS: req.headers,
        DATA: req.body,
    };

    log(LOGLEVEL.INFO, "hook.YouTube", "YouTube hook called", debugMeta);

    if (Config.getInstance().hasValue("instance_id")) {
        if (
            !req.query.instance ||
            req.query.instance != Config.getInstance().cfg("instance_id")
        ) {
            log(
                LOGLEVEL.ERROR,
                "hook.YouTube",
                `Hook called with the wrong instance (${req.query.instance})`
            );
            res.send("Invalid instance");
            return;
        }
    }

    const hub_topic = req.query["hub.topic"];
    const hub_challenge = req.query["hub.challenge"];
    const hub_mode = req.query["hub.mode"];
    const hub_lease_seconds = req.query["hub.lease_seconds"];

    // TODO: verify
    if (hub_challenge) {
        log(
            LOGLEVEL.INFO,
            "hook.youtube",
            `Got challenge ${hub_challenge}, responding.`
        );
        res.status(200).send(hub_challenge);
        return;
    }

    console.log("body", req.body);

    if (req.body) {
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "@_",
        });
        const obj = parser.parse(req.body);

        if (
            Config.debug ||
            Config.getInstance().cfg<boolean>("dump_payloads")
        ) {
            let payload_filename = `yt_${new Date()
                .toISOString()
                .replaceAll(/[-:.]/g, "_")}`;
            // if (data_json.subscription.type) payload_filename += `_${data_json.subscription.type}`;
            payload_filename += ".json";
            const payload_filepath = path.join(
                BaseConfigDataFolder.payloads,
                payload_filename
            );
            log(
                LOGLEVEL.INFO,
                "hook.YouTube",
                `Dumping debug hook payload to ${payload_filepath}`
            );
            try {
                fs.writeFileSync(
                    payload_filepath,
                    JSON.stringify(
                        {
                            headers: req.headers,
                            body: req.body,
                            obj: obj,
                            query: req.query,
                            ip: req.ip,
                            status: req.statusCode,
                            message: req.statusMessage,
                        },
                        null,
                        4
                    )
                );
            } catch (error) {
                log(
                    LOGLEVEL.ERROR,
                    "hook.YouTube",
                    `Failed to dump payload to ${payload_filepath}`,
                    error
                );
            }
        }

        // const entry: PubsubVideo = obj.feed.entry;

        // console.log(entry["yt:channelId"], entry["yt:videoId"], entry.title);

        log(
            LOGLEVEL.INFO,
            "hook.YouTube",
            "YouTube hook not finished.",
            debugMeta
        );

        /*

        const YA = new YouTubeAutomator();
        YA.handle(entry, req).catch(error => {
            logAdvanced(LOGLEVEL.FATAL, "hook", `Automator returned error: ${error.message}`);
        });

        */

        res.status(200).end("");
    } else {
        log(LOGLEVEL.ERROR, "hook.YouTube", "YouTube hook no body.", debugMeta);
    }

    // logAdvanced(LOGLEVEL.WARNING, "hook", "Hook called with no data...", debugMeta);

    // res.status(400).send("No data supplied");
    // return;
}
