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