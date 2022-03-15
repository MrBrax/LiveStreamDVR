import { TwitchLog, LOGLEVEL } from "../Core/TwitchLog";
import { MUTE_STATUS } from "../Core/TwitchVOD";
import { generateStreamerList } from "../StreamerList";
import express from "express";

export async function CheckDeletedVods(req: express.Request, res: express.Response): Promise<void> {

    const force = req.query.force;

    const streamerList = generateStreamerList();

    for(const channel of streamerList.channels) {

        if (!channel.vods_list) continue;

        for(const vod of channel.vods_list) {

            if (!vod.is_finalized) continue;

            // if (!force && isInNotifyCache(`deleted_${vod.basename}`)) {
            // 
            // }

            const check = await vod.checkValidVod(true, false);

            if (vod.twitch_vod_id && check === false) {
                // notify
                // $this->sendNotify("{$vod->basename} deleted");
                res.send(`${vod.basename} deleted<br>\n`);
                // $this->addToNotifyCache("deleted_{$vod->basename}");
                TwitchLog.logAdvanced(LOGLEVEL.INFO, "cron", "Cronjob deleted check: {$vod->basename} deleted");
            }

        }

    }

}

export async function CheckMutedVods(req: express.Request, res: express.Response): Promise<void> {

    const streamerList = generateStreamerList();

    for(const channel of streamerList.channels) {

        if (!channel.vods_list) continue;

        for(const vod of channel.vods_list) {

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
                res.send(`${vod.basename} error: ${th}<br>\n`);
                TwitchLog.logAdvanced(LOGLEVEL.ERROR, "cron", "Cronjob mute check: {$vod->basename} error: {$th->getMessage()}");
                continue;
            }

            if (check == MUTE_STATUS.MUTED) {
                // notify
                // $this->sendNotify("{$vod->basename} muted");
                res.send(`${vod.basename} muted<br>\n`);
                // $this->addToNotifyCache("mute_{$vod->basename}");
                TwitchLog.logAdvanced(LOGLEVEL.INFO, "cron", `Cronjob mute check: ${vod.basename} muted`);
            } else if (check == MUTE_STATUS.UNMUTED) {
                res.send(`${vod.basename} unmuted<br>\n`);
            } else {
                res.send(`${vod.basename} unknown<br>\n`);
            }

        }

    }

}