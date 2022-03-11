import { TwitchHelper } from "../Core/TwitchHelper";
import express from "express";
import { TwitchChannel } from "../Core/TwitchChannel";
import { TwitchConfig } from "../Core/TwitchConfig";
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
                instance_match: sub.transport.callback == TwitchConfig.cfg("app_url") + "/hook" + (TwitchConfig.cfg("instance_id") ? "?instance=" + TwitchConfig.cfg("instance_id") : ""),
                status: sub.status,
                created_at: sub.created_at,
            };

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
        });
    }

}

export async function SubscribeToAllChannels(req: express.Request, res: express.Response): Promise<void> {

    const all_channels = TwitchChannel.getChannels();

    // const payload_data: { channels: ChannelSub[]; total: number; all_usernames: Set<string>; } = {

    for (const channel of all_channels) {
        if (!channel.userid) continue;
        const sub = await TwitchChannel.subscribe(channel.userid);
    }

}