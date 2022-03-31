import express from "express";
import { ApiErrorResponse, ApiResponse, ApiVodResponse } from "../../../common/Api/Api";
import { VideoQuality } from "../../../common/Config";
import { VideoQualityArray } from "../../../common/Defs";
import { LOGLEVEL, TwitchLog } from "../Core/TwitchLog";
import { TwitchVOD } from "../Core/TwitchVOD";

export async function GetVod(req: express.Request, res: express.Response): Promise<void> {

    const vod = TwitchVOD.getVod(req.params.basename);

    if (!vod) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod not found",
        } as ApiErrorResponse);
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
        } as ApiErrorResponse);
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
        } as ApiErrorResponse);
        return;
    }

    vod.delete();

    res.send({
        status: "OK",
    });

}

export async function DownloadVod(req: express.Request, res: express.Response): Promise<void> {

    const vod = TwitchVOD.getVod(req.params.basename);

    const quality = req.query.quality && VideoQualityArray.includes(req.query.quality as string) ? req.query.quality as VideoQuality : "best";

    if (!vod) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod not found",
        } as ApiErrorResponse);
        return;
    }

    const success = await vod.downloadVod(quality);

    res.send({
        status: success ? "OK" : "ERROR",
    });

}

export async function DownloadChat(req: express.Request, res: express.Response): Promise<void> {

    const vod = TwitchVOD.getVod(req.params.basename);

    if (!vod) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod not found",
        } as ApiErrorResponse);
        return;
    }

    const success = await vod.downloadChat();

    res.send({
        status: success ? "OK" : "ERROR",
    });

}

export async function RenderWizard(req: express.Request, res: express.Response): Promise<void> {

    const vod = TwitchVOD.getVod(req.params.basename);

    if (!vod) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod not found",
        } as ApiErrorResponse);
        return;
    }

    const data = req.body;
    const chat_width = data.chatWidth;
    const chat_height = data.chatHeight;
    const render_chat = data.renderChat;
    const burn_chat = data.burnChat;
    const vod_source = data.vodSource;
    const chat_source = data.chatSource;
    const chat_font = data.chatFont;
    const chat_font_size = data.chatFontSize;
    const burn_horizontal = data.burnHorizontal;
    const burn_vertical = data.burnVertical;
    const ffmpeg_preset = data.ffmpegPreset;
    const ffmpeg_crf = data.ffmpegCrf;

    let status_renderchat = false;
    let status_burnchat = false;

    TwitchLog.logAdvanced(LOGLEVEL.INFO, "vodclass", `Start render wizard for vod ${vod}`);
    TwitchLog.logAdvanced(LOGLEVEL.INFO, "vodclass", `chat_width: ${chat_width}`);
    TwitchLog.logAdvanced(LOGLEVEL.INFO, "vodclass", `chat_height: ${chat_height}`);
    TwitchLog.logAdvanced(LOGLEVEL.INFO, "vodclass", `render_chat: ${render_chat}`);
    TwitchLog.logAdvanced(LOGLEVEL.INFO, "vodclass", `burn_chat: ${burn_chat}`);
    TwitchLog.logAdvanced(LOGLEVEL.INFO, "vodclass", `vod_source: ${vod_source}`);
    TwitchLog.logAdvanced(LOGLEVEL.INFO, "vodclass", `chat_source: ${chat_source}`);

    if (render_chat) {
        try {
            status_renderchat = await vod.renderChat(chat_width, chat_height, chat_font, chat_font_size, chat_source == "downloaded", true);
        } catch (error) {
            res.status(400).send({
                status: "ERROR",
                message: (error as Error).message || "Unknown error occurred while rendering chat",
            } as ApiErrorResponse);
            return;
        }
    }

    if (burn_chat) {
        try {
            status_burnchat = await vod.burnChat(burn_horizontal, burn_vertical, ffmpeg_preset, ffmpeg_crf, vod_source == "downloaded", true);
        } catch (error) {
            res.status(400).send({
                status: "ERROR",
                message: (error as Error).message || "Unknown error occurred while burning chat",
            } as ApiErrorResponse);
            return;
        }
    }

    res.status(200).send({
        status: "OK",
        data: {
            status_renderchat: status_renderchat,
            status_burnchat: status_burnchat,
        },
    } as ApiResponse);

}

export async function CheckMute(req: express.Request, res: express.Response): Promise<void> {

    const vod = TwitchVOD.getVod(req.params.basename);

    if (!vod) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod not found",
        } as ApiErrorResponse);
        return;
    }

    let is_muted;
    try {
        is_muted = await vod.checkMutedVod(true);
    } catch (error) {
        res.status(400).send({
            status: "ERROR",
            message: (error as Error).message || "Unknown error occurred while checking mute",
        } as ApiErrorResponse);
        return;
    }

    res.send({
        status: "OK",
        data: {
            vod: vod,
            muted: is_muted,
        },
    } as ApiResponse);

}