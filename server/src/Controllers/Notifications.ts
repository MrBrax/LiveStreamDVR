import { ClientBroker } from "@/Core/ClientBroker";
import type { ApiResponse } from "@common/Api/Api";
import type { NotificationCategory } from "@common/Defs";
import type express from "express";

export function GetNotificationSettings(
    req: express.Request,
    res: express.Response
) {
    res.api<ApiResponse>(200, {
        data: ClientBroker.notificationSettings,
        status: "OK",
    });
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

    res.api(200, {
        status: "OK",
        message: "Notification settings saved",
    });
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

    res.api(200, {
        status: "OK",
        message: "Test notification sent",
    });
}
