import express from "express";
import { ApiErrorResponse } from "../../../common/Api/Api";
import { SubStatus } from "../../../common/Defs";
import { KeyValue } from "../Core/KeyValue";
import { TwitchChannel } from "../Core/TwitchChannel";
import { Config } from "../Core/Config";
import { Helper } from "../Core/Helper";
import { LOGLEVEL, Log } from "../Core/Log";
import { EventSubTypes } from "../../../common/TwitchAPI/Shared";

interface ChannelSub {
    type: EventSubTypes;
    id: string;
    username: string;
    user_id: string;
    callback: string;
    instance_match: boolean;
    status: string;
    created_at: string;
}

export async function ListSubscriptions(req: express.Request, res: express.Response): Promise<void> {

    const subs = await Helper.getSubsList();

    if (subs && subs.length > 0) {

        const payload_data: { channels: ChannelSub[]; total: number; all_usernames: Set<string>; } = {
            channels: [],
            total: subs.length,
            all_usernames: new Set(),
        };

        let callback = `${Config.getInstance().cfg("app_url")}/api/v0/hook`;
        if (Config.getInstance().cfg("instance_id")) callback += "?instance=" + Config.getInstance().cfg("instance_id");

        for (const sub of subs) {

            let username: boolean | string = "";

            try {
                username = await TwitchChannel.channelLoginFromId(sub.condition.broadcaster_user_id);
            } catch (e) {
                Log.logAdvanced(LOGLEVEL.ERROR, "ListSubscriptions", "Failed to get username for channel " + sub.condition.broadcaster_user_id, e);
                continue;
            }

            if (!username) {
                Log.logAdvanced(LOGLEVEL.WARNING, "ListSubscriptions", `Could not find username for channel ${sub.condition.broadcaster_user_id}`);
                continue;
            }

            const entry: ChannelSub = {
                type: sub.type,
                id: sub.id,
                username: username || "",
                user_id: sub.condition.broadcaster_user_id,
                callback: sub.transport.callback,
                instance_match: sub.transport.callback == callback,
                status: sub.status,
                created_at: sub.created_at,
            };

            if (!KeyValue.getInstance().has(`${entry.user_id}.sub.${entry.type}`) || !KeyValue.getInstance().has(`${entry.user_id}.substatus.${entry.type}`)) {
                KeyValue.getInstance().set(`${entry.user_id}.sub.${entry.type}`, entry.id);
                KeyValue.getInstance().set(`${entry.user_id}.substatus.${entry.type}`, entry.status == "enabled" ? SubStatus.SUBSCRIBED : SubStatus.NONE);
                Log.logAdvanced(LOGLEVEL.INFO, "route.subscriptions.list", `Added missing keyvalue subs for ${entry.user_id}`);
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

    const all_channels = TwitchChannel.getChannels();

    const payload_data: { channels: { login: string; status: string; }[] } = {
        channels: [],
    };

    for (const channel of all_channels) {
        if (!channel.userid || !channel.login) continue;
        const sub = await TwitchChannel.subscribe(channel.userid);
        const entry = {
            login: channel.login,
            status: sub === true ? "Subscription request sent, check logs for details" : "ERROR",
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

    const sub = await Helper.eventSubUnsubscribe(sub_id);

    if (sub === true) {
        res.send({
            status: "OK",
            message: `Could not unsubscribe from ${sub_id}.`,
        });
    } else {
        res.status(400).send({
            status: "ERROR",
            message: `Could not unsubscribe from ${sub_id}.`,
        } as ApiErrorResponse);
    }

}