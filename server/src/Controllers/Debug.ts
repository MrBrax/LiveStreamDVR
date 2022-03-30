import { TwitchConfig } from "Core/TwitchConfig";
import express from "express";
import { ClientBroker } from "../Core/ClientBroker";
import { TwitchChannel } from "../Core/TwitchChannel";
import { TwitchVOD } from "../Core/TwitchVOD";

export function ListVodsInMemory(req: express.Request, res: express.Response): void {
    res.send({
        status: "OK",
        data: TwitchVOD.vods,
    });
}

export function ListChannelsInMemory(req: express.Request, res: express.Response): void {
    res.send({
        status: "OK",
        data: TwitchChannel.channels,
    });
}

export function NotifyTest(req: express.Request, res: express.Response): void {
    ClientBroker.notify(req.query.title as string, req.query.body as string, "", TwitchConfig.notificationCategories.debug);
    res.send("OK");
}