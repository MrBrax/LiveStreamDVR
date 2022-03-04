import { SettingField, TwitchConfig } from "../Core/TwitchConfig";
import express from 'express';
import fs from 'fs';
import { TwitchHelper } from "../Core/TwitchHelper";
import { generateStreamerList } from "../StreamerList";

export function ListChannels(req: express.Request, res: express.Response): void {

    let { channels, total_size } = generateStreamerList();

    res.send({
        data: {
            streamer_list: channels,
            total_size: total_size,
            // free_size: fs.statSync(TwitchHelper.vodFolder()).size,
            free_size: -1, // broken until further notice
        },
        status: "OK",
    });
};