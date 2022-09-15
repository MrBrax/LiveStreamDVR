import { YouTubeVOD } from "Core/Providers/YouTube/YouTubeVOD";
import express from "express";
import { ApiErrorResponse } from "../../../common/Api/Api";
export async function YouTubeAPIVideos(req: express.Request, res: express.Response): Promise<void> {

    const channel_id = req.params.channel_id;

    if (!channel_id) {
        res.status(400).send({ status: "ERROR", message: "Invalid channel login" });
        return;
    }

    const videos = await YouTubeVOD.getVideosProxy(channel_id);

    if (videos === false) {
        res.status(400).send({
            status: "ERROR",
            message: "No response from API",
        } as ApiErrorResponse);
        return;
    }

    res.send({
        data: videos,
        status: "OK",
    });

}