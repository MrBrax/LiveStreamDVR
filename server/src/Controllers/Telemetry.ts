import type express from "express";
import fs from "node:fs";
import path from "node:path";
import type { ApiResponse } from "@common/Api/Api";
import { BaseConfigFolder } from "@/Core/BaseConfig";
import { ClientBroker } from "@/Core/ClientBroker";
import { Config } from "@/Core/Config";
import { LiveStreamDVR } from "@/Core/LiveStreamDVR";
import { generateStreamerList } from "@/Helpers/StreamerList";
import { Helper } from "@/Core/Helper";
import { is_docker, is_windows } from "@/Helpers/System";

/**
 * I don't like telemetry myself, but I do get curious sometimes.
 * I will NOT make it send any data by itself, it will only send it when the user explicitly tells it to.
 * You can view the telemetry in the /api/v0/telemetry/show endpoint.
 * To help me get some data, you can press the button on the about page, but do remind yourself that you'll be sending (anonymous) data to me.
 */

function GetTelemetry() {
    const { total_size } = generateStreamerList();
    const data = {
        uid: 0, // TODO: make an unique uid for telemetry, is this ok to do?
        channel_amount: LiveStreamDVR.getInstance().getChannels().length,
        vods_amount: LiveStreamDVR.getInstance().getChannels().map(c => c.getVods().length),
        uses_proxy: Config.getInstance().cfg("trust_proxy"),
        notifications: ClientBroker.notificationSettings,
        windows: is_windows(),
        docker: is_docker(),
        node_version: process.version,
        has_basepath: Config.getInstance().cfg("basepath") !== "",
        has_password: Config.getInstance().cfg("password") !== "",
        guest_mode: Config.getInstance().cfg("guest_mode"),
        websockets: Config.getInstance().cfg("websocket_enabled"),
        channel_folders: Config.getInstance().cfg("channel_folders"),
        vod_container: Config.getInstance().cfg("vod_container"),
        file_permissions: Config.getInstance().cfg("file_permissions"),
        create_video_chapters: Config.getInstance().cfg("create_video_chapters"),
        total_size: total_size,
        server_version: process.env.npm_package_version,
        server_mode: process.env.NODE_ENV,
        server_ts: process.env.npm_lifecycle_script?.includes("index.ts"),
        client_version: JSON.parse(fs.readFileSync(path.join(BaseConfigFolder.client, "..", "package.json"), "utf8")).version,
    };
    return data;
}

export function ShowTelemetry(req: express.Request, res: express.Response): void {
    res.send({
        data: GetTelemetry(),
        status: "OK",
    } as ApiResponse);
}

// there is no send method implemented yet, don't worry
export function SendTelemetry(req: express.Request, res: express.Response): void {
    res.status(501).send({
        status: "ERROR",
        message: "Not implemented",
    });
}