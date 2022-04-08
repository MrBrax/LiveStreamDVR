import express from "express";
import { MuteStatus } from "../../../common/Defs";
import { ClientBroker } from "../Core/ClientBroker";
import { LOGLEVEL, TwitchLog } from "../Core/TwitchLog";
import { generateStreamerList } from "../Helpers/StreamerList";

export async function CheckDeletedVods(req: express.Request, res: express.Response): Promise<void> {

    const force = req.query.force;

    const streamerList = generateStreamerList();

    let output = "";

    for (const channel of streamerList.channels) {

        if (!channel.vods_list) continue;

        for (const vod of channel.vods_list) {

            if (!vod.is_finalized) continue;

            // if (!force && isInNotifyCache(`deleted_${vod.basename}`)) {
            // 
            // }

            const check = await vod.checkValidVod(true, false);

            if (vod.twitch_vod_id && check === false) {
                // notify
                // $this->sendNotify("{$vod->basename} deleted");
                output += `${vod.basename} deleted<br>\n`;

                ClientBroker.notify(`${vod.basename} deleted`, "", "", "vodDeleted");

                // $this->addToNotifyCache("deleted_{$vod->basename}");
                TwitchLog.logAdvanced(LOGLEVEL.INFO, "cron", `Cronjob deleted check: ${vod.basename} deleted`);
            }

        }

    }

    res.send(output || "No deleted vods found");

}

export async function CheckMutedVods(req: express.Request, res: express.Response): Promise<void> {

    const streamerList = generateStreamerList();

    let output = "";

    for (const channel of streamerList.channels) {

        if (!channel.vods_list) continue;

        for (const vod of channel.vods_list) {

            if (!vod.is_finalized) continue;

            // if (!$force && $this->isInNotifyCache("mute_{$vod->basename}")) {
            //     TwitchLog.logAdvanced(LOGLEVEL.DEBUG, "cron", "Cronjob mute check for {$vod->basename} skipped, already notified");
            //     res.send("Skip checking {$vod->basename}, previously muted<br />\n");
            //     continue;
            // }

            // if ($vod->twitch_vod_muted === true) {
            //     // muted forever unless twitch implements unmuting somehow
            //     res.send("{$vod->basename} is muted<br />\n");
            //     continue;
            // }

            const current_status = vod.twitch_vod_muted;

            let check;

            try {
                check = await vod.checkMutedVod(true, false);
            } catch (th) {
                output += `${vod.basename} error: ${(th as Error).message}<br>\n`;
                TwitchLog.logAdvanced(LOGLEVEL.ERROR, "cron", `Cronjob mute check: ${vod.basename} error: ${(th as Error).message}`);
                continue;
            }

            if (check == MuteStatus.MUTED) {
                // notify
                // $this->sendNotify("{$vod->basename} muted");
                output += `${vod.basename} muted<br>\n`;

                ClientBroker.notify(`${vod.basename} muted`, "", "", "vodMuted");

                // $this->addToNotifyCache("mute_{$vod->basename}");
                TwitchLog.logAdvanced(LOGLEVEL.INFO, "cron", `Cronjob mute check: ${vod.basename} muted`);
            } else if (check == MuteStatus.UNMUTED) {
                output += `${vod.basename} unmuted<br>\n`;
            } else {
                output += `${vod.basename} unknown<br>\n`;
            }

        }

    }

    res.send(output || "No muted vods found");

}