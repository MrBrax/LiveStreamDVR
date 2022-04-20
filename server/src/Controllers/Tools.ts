import express from "express";
import { Config } from "Core/Config";

export async function ResetChannels(req: express.Request, res: express.Response): Promise<void> {

    await Config.resetChannels();

    res.send({
        status: "OK",
        message: "Reset channels.",
    });

}