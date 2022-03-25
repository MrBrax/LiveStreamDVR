import express from "express";
import { ApiErrorResponse, ApiResponse, ApiVodResponse } from "../../../common/Api/Api";
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

    if (!vod) {
        res.status(400).send({
            status: "ERROR",
            message: "Vod not found",
        } as ApiErrorResponse);
        return;
    }

    const success = await vod.downloadVod();

    res.send({
        status: success ? "OK" : "ERROR",
    });

}

/*
public function vod_renderwizard(Request $request, Response $response, $args)
{

    $vod = $args['vod'];
    $username = explode("_", $vod)[0];
    $vodclass = TwitchVOD::load(TwitchHelper::vodFolder($username) . DIRECTORY_SEPARATOR . $vod . '.json');

    $data = $request->getParsedBody();
    $chat_width = isset($data['chatWidth']) ? (int)$data['chatWidth'] : 300;
    $chat_height = isset($data['chatHeight']) ? (int)$data['chatHeight'] : 1080;
    $render_chat = isset($data['renderChat']) && $data['renderChat'];
    $burn_chat = isset($data['burnChat']) && $data['burnChat'];
    $vod_source = isset($data['vodSource']) ? $data['vodSource'] : 'captured';
    $chat_source = isset($data['chatSource']) ? $data['chatSource'] : 'captured';
    $chat_font = isset($data['chatFont']) ? $data['chatFont'] : 'Inter';
    $chat_font_size = isset($data['chatFontSize']) ? (int)$data['chatFontSize'] : 12;
    $burn_horizontal = isset($data['burnHorizontal']) ? $data['burnHorizontal'] : 'left';
    $burn_vertical = isset($data['burnVertical']) ? $data['burnVertical'] : 'top';
    $ffmpeg_preset = isset($data['ffmpegPreset']) ? $data['ffmpegPreset'] : 'slow';
    $ffmpeg_crf = isset($data['ffmpegCrf']) ? (int)$data['ffmpegCrf'] : 26;

    $status_renderchat = false;
    $status_burnchat = false;

    TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "vodclass", "Start render wizard for vod {$vod}");
    TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "vodclass", "chat_width: {$chat_width}");
    TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "vodclass", "chat_height: {$chat_height}");
    TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "vodclass", "render_chat: {$render_chat}");
    TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "vodclass", "burn_chat: {$burn_chat}");
    TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "vodclass", "vod_source: {$vod_source}");
    TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "vodclass", "chat_source: {$chat_source}");

    if ($render_chat) {
        try {
            $status_renderchat = $vodclass->renderChat($chat_width, $chat_height, $chat_font, $chat_font_size, $chat_source == "downloaded", true);
        } catch (\Throwable $th) {
            $response->getBody()->write(json_encode([
                "message" => $th->getMessage(),
                "status" => "ERROR"
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }
    }

    if ($burn_chat) {
        try {
            $status_burnchat = $vodclass->burnChat($burn_horizontal, $burn_vertical, $ffmpeg_preset, $ffmpeg_crf, $vod_source == "downloaded", true);
        } catch (\Throwable $th) {
            $response->getBody()->write(json_encode([
                "message" => $th->getMessage(),
                "status" => "ERROR"
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }
    }

    $response->getBody()->write(json_encode([
        "data" => [
            "status_renderchat" => $status_renderchat,
            "status_burnchat" => $status_burnchat,
        ],
        "status" => "OK"
    ]));
    return $response->withStatus(200)->withHeader('Content-Type', 'application/json');
}
*/

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
                message: (error as Error).message,
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
                message: (error as Error).message,
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