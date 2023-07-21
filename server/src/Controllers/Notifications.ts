import { ClientBroker } from "@/Core/ClientBroker";
import type express from "express";
import type { ApiResponse } from "@common/Api/Api";
import type { NotificationCategory } from "@common/Defs";

export function GetNotificationSettings(
    req: express.Request,
    res: express.Response
) {
    res.send({
        data: ClientBroker.notificationSettings,
        status: "OK",
    } as ApiResponse);
}

export function SaveNotificationSettings(
    req: express.Request,
    res: express.Response
) {
    const data = req.body;

    ClientBroker.resetNotificationSettings();
    for (const category in data) {
        ClientBroker.setNotificationSettingForProvider(
            category as NotificationCategory,
            data[category],
            true
        );
    }
    ClientBroker.saveNotificationSettings();

    res.send({
        status: "OK",
        message: "Notification settings saved",
    } as ApiResponse);
}

export function TestNotificationSettings(
    req: express.Request,
    res: express.Response
) {
    const provider = req.body.provider;
    const category = req.body.category;

    ClientBroker.notify(
        "Test notification",
        "This is a test notification",
        "",
        category as NotificationCategory
    );

    res.send({
        status: "OK",
        message: "Test notification sent",
    } as ApiResponse);
}
