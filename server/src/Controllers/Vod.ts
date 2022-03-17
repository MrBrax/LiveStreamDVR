import { TwitchVOD } from "../Core/TwitchVOD";
import express from "express";
import { ApiVodResponse } from "../../../common/Api/Api";

export async function GetVod(req: express.Request, res: express.Response): Promise<void> {
    
    const vod = TwitchVOD.getVod(req.params.basename);

    if (!vod) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod not found",
        });
        return;
    }

    res.send({
        data: await vod.toAPI(),
        status: "OK",
    } as ApiVodResponse);
    
}

export function ArchiveVod(req: express.Request, res: express.Response): void {
    
    const vod = TwitchVOD.getVod(req.params.basename);

    if (!vod) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod not found",
        });
        return;
    }

    vod.archive();

    res.send({
        status: "OK",
    });
    
}

export function DeleteVod(req: express.Request, res: express.Response): void {
    
    const vod = TwitchVOD.getVod(req.params.basename);

    if (!vod) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod not found",
        });
        return;
    }

    vod.delete();

    res.send({
        status: "OK",
    });
    
}

export async function DownloadVod(req: express.Request, res: express.Response): Promise<void> {
    
    const vod = TwitchVOD.getVod(req.params.basename);

    if (!vod) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod not found",
        });
        return;
    }

    const success = await vod.downloadVod();

    res.send({
        status: success ? "OK" : "ERROR",
    });
    
}