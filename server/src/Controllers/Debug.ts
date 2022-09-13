import express from "express";
import { VideoQuality } from "../../../common/Config";
import { ClientBroker } from "../Core/ClientBroker";
import { LiveStreamDVR } from "../Core/LiveStreamDVR";
import { TwitchChannel } from "../Core/TwitchChannel";
import { TwitchVOD } from "../Core/TwitchVOD";

export function ListVodsInMemory(req: express.Request, res: express.Response): void {
    res.send({
        status: "OK",
        data: LiveStreamDVR.getInstance().vods,
    });
}

export function ListChannelsInMemory(req: express.Request, res: express.Response): void {
    res.send({
        status: "OK",
        data: TwitchChannel.channels,
    });
}

export function NotifyTest(req: express.Request, res: express.Response): void {
    ClientBroker.notify(req.query.title as string, req.query.body as string, "", "debug");
    res.send("OK");
}

export async function VodDownloadAtEnd(req: express.Request, res: express.Response): Promise<void> {
    const login = req.query.login as string;
    const quality = req.query.quality as VideoQuality;
    const channel = TwitchChannel.getChannelByLogin(login);

    let status;
    try {
        status = await channel?.downloadLatestVod(quality);
    } catch (error) {
        res.status(500).send((error as Error).message);
        return;
    }

    res.send(status);
}

export async function ReencodeVod(req: express.Request, res: express.Response): Promise<void> {
    const basename = req.params.basename as string;

    const vod = LiveStreamDVR.getInstance().vods.find((v) => v.basename === basename);

    if (!vod) {
        res.status(500).send(LiveStreamDVR.getInstance().vods.map((v) => v.basename));
        return;
    }

    let status;
    try {
        status = await vod.reencodeSegments();
    } catch (error) {
        res.status(500).send((error as Error).message);
        return;
    }

    res.send(status);
}