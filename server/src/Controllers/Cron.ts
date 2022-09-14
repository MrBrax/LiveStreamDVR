import { TwitchChannel } from "../Core/TwitchChannel";
import express from "express";
import { MuteStatus } from "../../../common/Defs";
import { ClientBroker } from "../Core/ClientBroker";
import { LOGLEVEL, Log } from "../Core/Log";
import { generateStreamerList } from "../Helpers/StreamerList";

export async function fCheckDeletedVods(): Promise<string> {

    const streamerList = generateStreamerList();

    let output = "";

    for (const channel of streamerList.channels) {

        if (!(channel instanceof TwitchChannel)) continue;
        if (!channel.vods_list) continue;

        for (const vod of channel.vods_list) {

            if (!vod.is_finalized) continue;

            // if (!force && isInNotifyCache(`deleted_${vod.basename}`)) {
            // 
            // }

            const check = await vod.checkValidVod(true);

            if (vod.twitch_vod_id && check === false) {
                // notify
                // $this->sendNotify("{$vod->basename} deleted");
                output += `${vod.basename} deleted<br>\n`;

                ClientBroker.notify(`${vod.basename} deleted`, "", "", "vodDeleted");

                // $this->addToNotifyCache("deleted_{$vod->basename}");
                Log.logAdvanced(LOGLEVEL.INFO, "cron", `Cronjob deleted check: ${vod.basename} deleted`);
            }

        }

    }

    return output;
}

export async function CheckDeletedVods(req: express.Request, res: express.Response): Promise<void> {
    // const force = req.query.force;
    const output = await fCheckDeletedVods();
    res.send(output || "No deleted vods found");
}

export async function fCheckMutedVods(force = false): Promise<string> {

    const streamerList = generateStreamerList();

    let output = "";

    for (const channel of streamerList.channels) {

        if (!(channel instanceof TwitchChannel)) continue;
        if (!channel.vods_list) continue;

        for (const vod of channel.vods_list) {

            if (!vod.is_finalized) continue;

            // if (!$force && $this->isInNotifyCache("mute_{$vod->basename}")) {
            //     TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "cron", "Cronjob mute check for {$vod->basename} skipped, already notified");
            //     res.send("Skip checking {$vod->basename}, previously muted<br />\n");
            //     continue;
            // }

            if (vod.twitch_vod_muted === MuteStatus.MUTED && !force) {
                // muted forever unless twitch implements unmuting somehow
                output += `${vod.basename} forever muted<br>\n`;
                continue;
            }

            const current_status = vod.twitch_vod_muted;

            let check;

            try {
                check = await vod.checkMutedVod(true);
            } catch (th) {
                output += `${vod.basename} error: ${(th as Error).message}<br>\n`;
                Log.logAdvanced(LOGLEVEL.ERROR, "cron", `Cronjob mute check: ${vod.basename} error: ${(th as Error).message}`);
                continue;
            }

            if (check == MuteStatus.MUTED) {
                // notify
                // $this->sendNotify("{$vod->basename} muted");
                output += `${vod.basename} muted<br>\n`;

                ClientBroker.notify(`${vod.basename} muted`, "", "", "vodMuted");

                // $this->addToNotifyCache("mute_{$vod->basename}");
                Log.logAdvanced(LOGLEVEL.INFO, "cron", `Cronjob mute check: ${vod.basename} muted`);
            } else if (check == MuteStatus.UNMUTED) {
                output += `${vod.basename} unmuted<br>\n`;
            } else {
                output += `${vod.basename} unknown<br>\n`;
            }

        }

    }

    return output;

}

export async function CheckMutedVods(req: express.Request, res: express.Response): Promise<void> {
    const force = req.query.force !== undefined;
    const output = await fCheckMutedVods(force);
    res.send(output || "No muted vods found");
}

export async function fMatchVods(force = false): Promise<string> {

    const streamerList = generateStreamerList();

    let output = "";

    for (const channel of streamerList.channels) {

        if (!(channel instanceof TwitchChannel)) continue;

        if (!channel.vods_list) continue;

        for (const vod of channel.vods_list) {

            if (!vod.is_finalized) continue;

            // if (!$force && $this->isInNotifyCache("match_{$vod->basename}")) {
            //     TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "cron", "Cronjob match check for {$vod->basename} skipped, already notified");
            //     res.send("Skip checking {$vod->basename}, previously matched<br />\n");
            //     continue;
            // }

            if (vod.twitch_vod_id) continue;

            let status;

            try {
                status = await vod.matchProviderVod(force);
            } catch (th) {
                output += `${vod.basename} error: ${(th as Error).message}<br>\n`;
                Log.logAdvanced(LOGLEVEL.ERROR, "cron", `Cronjob match check: ${vod.basename} error: ${(th as Error).message}`);
                continue;
            }

            if (status) {
                output += `${vod.basename} matched<br>\n`;
                Log.logAdvanced(LOGLEVEL.SUCCESS, "cron", `Cronjob match check: ${vod.basename} matched`);
            } else {
                output += `${vod.basename} not matched<br>\n`;
                Log.logAdvanced(LOGLEVEL.WARNING, "cron", `Cronjob match check: ${vod.basename} not matched`);
            }

        }

    }

    return output;

}

export async function MatchVods(req: express.Request, res: express.Response): Promise<void> {
    const force = req.query.force !== undefined;
    const output = await fMatchVods(force);
    res.send(output || "Nothing to match");
}