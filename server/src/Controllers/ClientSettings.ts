import { BaseConfigPath } from "@/Core/BaseConfig";
import { log, LOGLEVEL } from "@/Core/Log";
import type { ClientSettings } from "@common/ClientSettings";
import { defaultConfigFields } from "@common/ClientSettings";
import type express from "express";
import fs from "fs";

export function GetClientSettings(
    req: express.Request,
    res: express.Response
): void {
    let clientSettings = {};
    if (fs.existsSync(BaseConfigPath.clientSettings)) {
        clientSettings = JSON.parse(
            fs.readFileSync(BaseConfigPath.clientSettings, "utf8")
        );
    }

    res.send({
        data: clientSettings,
        status: "OK",
    });
}

export function SaveClientSettings(
    req: express.Request,
    res: express.Response
): void {
    const clientSettings = req.body;

    for (const setting in defaultConfigFields) {
        if (!(setting in defaultConfigFields)) {
            res.status(400).send({
                status: "ERROR",
                message: `Unknown setting: ${setting}`,
            });
            return;
        }
        const correctType =
            defaultConfigFields[setting as keyof ClientSettings].type;
        const valueType = typeof clientSettings[setting];

        switch (correctType) {
            case "string":
            case "choice":
                if (valueType !== "string") {
                    res.status(400).send({
                        status: "ERROR",
                        message: `Setting ${setting} is not of type ${correctType}`,
                    });
                    return;
                }
                break;
            case "number":
                if (valueType !== "number") {
                    res.status(400).send({
                        status: "ERROR",
                        message: `Setting ${setting} is not of type ${correctType}`,
                    });
                    return;
                }
                break;
            case "boolean":
                if (valueType !== "boolean") {
                    res.status(400).send({
                        status: "ERROR",
                        message: `Setting ${setting} is not of type ${correctType}`,
                    });
                    return;
                }
                break;
            default:
                res.status(400).send({
                    status: "ERROR",
                    message: `Unknown type ${correctType} for setting ${setting}`,
                });
                return;
        }
    }

    log(
        LOGLEVEL.INFO,
        "route.clientSettings",
        "Saving client settings",
        clientSettings
    );

    fs.writeFileSync(
        BaseConfigPath.clientSettings,
        JSON.stringify(clientSettings, null, 4),
        "utf8"
    );

    res.send({
        status: "OK",
        message: "Client settings saved",
    });
}
