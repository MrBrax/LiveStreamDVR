import express from "express";
import { ApiErrorResponse } from "../../../common/Api/Api";
import { SubStatus } from "../../../common/Defs";
import { KeyValue } from "../Core/KeyValue";
import { TwitchChannel } from "../Core/TwitchChannel";
import { TwitchConfig } from "../Core/TwitchConfig";
import { TwitchHelper } from "../Core/TwitchHelper";
import { LOGLEVEL, TwitchLog } from "../Core/TwitchLog";

interface ChannelSub {
    type: string;
    id: string;
    username: string;
    user_id: string;
    callback: string;
    instance_match: boolean;
    status: string;
    created_at: string;
}

export async function ListSubscriptions(req: express.Request, res: express.Response): Promise<void> {

    const subs = await TwitchHelper.getSubs();

    if (subs && subs.total > 0) {

        const payload_data: { channels: ChannelSub[]; total: number; all_usernames: Set<string>; } = {
            channels: [],
            total: subs.total,
            all_usernames: new Set(),
        };

        /*
        const payload_data = {
            channels: subs.data.map(async sub => {
                const username = await TwitchChannel.channelLoginFromId(sub.condition.broadcaster_user_id);
                return {
                    type: sub.type,
                    id: sub.id,
                    username: username,
                    user_id: sub.condition.broadcaster_user_id,
                    callback: sub.transport.callback,
                    instance_match:
                        sub.transport.callback ==
                        TwitchConfig.cfg("app_url") + "/hook" +
                        (TwitchConfig.cfg("instance_id") ? "?instance=" + TwitchConfig.cfg("instance_id") : ""
                        ),
                    status: sub.status,
                    created_at: sub.created_at,
                };
            }),
            total: subs.total,
            all_usernames: [...new Set(subs.data.map(async sub => await TwitchChannel.channelLoginFromId(sub.condition.broadcaster_user_id)))],
        };
        */

        let callback = `${TwitchConfig.cfg("app_url")}/api/v0/hook`;
        if(TwitchConfig.cfg("instance_id")) callback += "?instance=" + TwitchConfig.cfg("instance_id");

        for (const sub of subs.data) {

            const username = await TwitchChannel.channelLoginFromId(sub.condition.broadcaster_user_id);

            if (!username) {
                TwitchLog.logAdvanced(LOGLEVEL.WARNING, "ListSubscriptions", `Could not find username for channel ${sub.condition.broadcaster_user_id}`);
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

            if (!KeyValue.get(`${entry.user_id}.sub.${entry.type}`)) {
                KeyValue.set(`${entry.user_id}.sub.${entry.type}`, entry.id);
                KeyValue.set(`${entry.user_id}.substatus.${entry.type}`, entry.status == "enabled" ? SubStatus.SUBSCRIBED : SubStatus.NONE);
                TwitchLog.logAdvanced(LOGLEVEL.INFO, "route.subscriptions.list", `Added missing keyvalue subs for ${entry.user_id}`);
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

    const sub = await TwitchHelper.eventSubUnsubscribe(sub_id);

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