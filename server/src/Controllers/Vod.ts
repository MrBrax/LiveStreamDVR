import { TwitchVOD } from "../Core/TwitchVOD";
import express from "express";

export function GetVod(req: express.Request, res: express.Response): void {
    
    const vod = TwitchVOD.getVod(req.params.basename);

    if (!vod) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod not found",
        });
        return;
    }

    res.send({
        data: vod,
        status: "OK",
    });
    
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

export function DownloadVod(req: express.Request, res: express.Response): void {
    
    const vod = TwitchVOD.getVod(req.params.basename);

    if (!vod) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod not found",
        });
        return;
    }

    vod.downloadVod();

    res.send({
        status: "OK",
    });
    
}