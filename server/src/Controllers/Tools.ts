import express from "express";
import { TwitchConfig } from "Core/TwitchConfig";

export async function ResetChannels(req: express.Request, res: express.Response): Promise<void> {

    await TwitchConfig.resetChannels();

    res.send({
        status: "OK",
        message: "Reset channels.",
    });

}