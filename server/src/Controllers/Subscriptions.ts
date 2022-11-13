import express from "express";
import { ApiErrorResponse } from "@common/Api/Api";
import { SubStatus } from "@common/Defs";
import { KeyValue } from "../Core/KeyValue";
import { TwitchChannel } from "../Core/Providers/Twitch/TwitchChannel";
import { Config } from "../Core/Config";
import { TwitchHelper } from "../Providers/Twitch";
import {  Log } from "../Core/Log";
import { EventSubTypes, TransportWebsocket } from "@common/TwitchAPI/Shared";
import { LiveStreamDVR } from "../Core/LiveStreamDVR";

interface ChannelSub {
    type: EventSubTypes;
    id: string;
    username: string;
    user_id: string;
    callback: string;
    instance_match: boolean;
    status: string;
    created_at: string;
    transport_method: string;
}

export async function ListSubscriptions(req: express.Request, res: express.Response): Promise<void> {

    const subs = await TwitchHelper.getSubsList();

    if (subs && subs.length > 0) {

        let callback = `${Config.getInstance().cfg("app_url")}/api/v0/hook/twitch`;
        if (Config.getInstance().cfg("instance_id")) callback += "?instance=" + Config.getInstance().cfg("instance_id");

        const payload_data: { channels: ChannelSub[]; total: number; all_usernames: Set<string>; callback: string; } = {
            channels: [],
            total: subs.length,
            all_usernames: new Set(),
            callback: callback,
        };

        for (const sub of subs) {

            let username: boolean | string = "";

            try {
                username = await TwitchChannel.channelLoginFromId(sub.condition.broadcaster_user_id);
            } catch (e) {
                Log.logAdvanced(Log.Level.ERROR, "ListSubscriptions", "Failed to get username for channel " + sub.condition.broadcaster_user_id, e);
                continue;
            }

            if (!username) {
                Log.logAdvanced(Log.Level.WARNING, "ListSubscriptions", `Could not find username for channel ${sub.condition.broadcaster_user_id}`);
                continue;
            }

            let entry: ChannelSub;

            // if (Config.getInstance().cfg("twitchapi.eventsub_type") === "websocket") {
            if (sub.transport.method === "websocket") {

                const wsFound = TwitchHelper.eventWebsockets.some((w) => w.sessionId === (sub.transport as TransportWebsocket).session_id);

                entry = {
                    type: sub.type,
                    id: sub.id,
                    username: username || "",
                    user_id: sub.condition.broadcaster_user_id,
                    callback: sub.transport.session_id,
                    instance_match: wsFound,
                    status: sub.status,
                    created_at: sub.created_at,
                    transport_method: sub.transport.method,
                };

            } else {
                entry = {
                    type: sub.type,
                    id: sub.id,
                    username: username || "",
                    user_id: sub.condition.broadcaster_user_id,
                    callback: sub.transport.callback,
                    instance_match: sub.transport.callback == callback,
                    status: sub.status,
                    created_at: sub.created_at,
                    transport_method: sub.transport.method,
                };
            }

            if (!KeyValue.getInstance().has(`${entry.user_id}.sub.${entry.type}`) || !KeyValue.getInstance().has(`${entry.user_id}.substatus.${entry.type}`)) {
                KeyValue.getInstance().set(`${entry.user_id}.sub.${entry.type}`, entry.id);
                KeyValue.getInstance().set(`${entry.user_id}.substatus.${entry.type}`, entry.status == "enabled" ? SubStatus.SUBSCRIBED : SubStatus.NONE);
                Log.logAdvanced(Log.Level.INFO, "route.subscriptions.list", `Added missing keyvalue subs for ${entry.user_id}`);
            }

            payload_data.channels.push(entry);
            payload_data.all_usernames.add(username);

        }

        res.send({
            data: payload_data,
            status: "OK",
        });

    } else {
        res.send({
            status: "ERROR",
            message: "No subscriptions found",
        } as ApiErrorResponse);
    }

}

export async function SubscribeToAllChannels(req: express.Request, res: express.Response): Promise<void> {

    const all_channels = LiveStreamDVR.getInstance().getChannels();

    const payload_data: { channels: { login: string; status: string; }[] } = {
        channels: [],
    };

    for (const channel of all_channels) {
        // if (!channel.userid || !channel.login) continue;
        const sub = await channel.subscribe();
        const entry = {
            login: channel.internalName,
            status: sub ? "Subscription request sent, check logs for details" : "ERROR",
        };
        payload_data.channels.push(entry);
    }

    if (payload_data.channels.length == 0) {
        res.status(500).send({
            status: "ERROR",
            message: "No channels to subscribe to.",
        } as ApiErrorResponse);
        return;
    }

    res.send({
        data: payload_data,
        status: "OK",
    });

}

export async function UnsubscribeFromId(req: express.Request, res: express.Response): Promise<void> {

    const sub_id = req.params.sub_id;

    const sub = await TwitchHelper.getSubscription(sub_id);

    if (!sub) {
        res.status(404).send({
            status: "ERROR",
            message: "Subscription not found",
        } as ApiErrorResponse);
        return;
    }

    const status = await TwitchHelper.eventSubUnsubscribe(sub_id);

    if (status) {
        res.send({
            status: "OK",
            message: `Unsubscribed from ${sub_id}.`,
        });

        // clean up after unsubscribe
        if (sub.condition && sub.condition.broadcaster_user_id) {
            const userid = sub.condition.broadcaster_user_id;
            const type = sub.type;
            KeyValue.getInstance().delete(`${userid}.sub.${type}`);
            // KeyValue.getInstance().delete(`${userid}.substatus.${sub.type}`);
        }
    } else {
        res.status(400).send({
            status: "ERROR",
            message: `Could not unsubscribe from ${sub_id}.`,
        } as ApiErrorResponse);
    }

}