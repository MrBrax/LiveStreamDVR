import { SettingField, TwitchConfig } from "../Core/TwitchConfig";
import express from 'express';
import { version } from '../../package.json';

export function GetSettings(req: express.Request, res: express.Response): void {

    // flatten settings fields to key value pairs
    const fields = TwitchConfig.settingsFields.reduce((acc: Record<string, SettingField>, cur) => {
        acc[cur.key] = cur;
        return acc;
    }, {});

    res.send({
        data: {
            config: TwitchConfig.config,
            channels: TwitchConfig.channels_config,
            fields: fields,
            version: version,
        },
        status: "OK",
    });
};