import { SettingField, TwitchConfig } from "../TwitchConfig";
import express from 'express';
import fs from 'fs';
import { TwitchHelper } from "../TwitchHelper";

export function ListChannels(req: express.Request, res: express.Response): void {
    res.send({
        data: {
            streamer_list: TwitchConfig.channels,
            total_size: -1,
            free_size: fs.statSync(TwitchHelper.vodFolder()).size,
        },
        status: "OK",
    });
};