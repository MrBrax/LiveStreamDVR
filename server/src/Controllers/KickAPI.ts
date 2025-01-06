import type { ApiErrorResponse } from "@common/Api/Api";
import type express from "express";
import { GetChannel } from "../Providers/Kick";

/* export async function KickAPIUser(
    req: express.Request,
    res: express.Response
): Promise<void> {
    const slug = req.params.slug;

    if (!slug) {
        res.api(400, { status: "ERROR", message: "Invalid slug" });
        return;
    }

    let user;

    try {
        user = await GetUser(slug);
    } catch (error) {
        res.api(400, {
            status: "ERROR",
            message: `Error while fetching user data: ${
                (error as Error).message
            }`,
        } as ApiErrorResponse);
        return;
    }

    if (!user) {
        res.api(400, {
            status: "ERROR",
            message: "User not found",
        } as ApiErrorResponse);
        return;
    }

    res.api(200, {
        data: user,
        status: "OK",
    });
} */

export async function KickAPIChannel(
    req: express.Request,
    res: express.Response
): Promise<void> {
    const slug = req.params.slug;

    if (!slug) {
        res.api(400, { status: "ERROR", message: "Invalid slug" });
        return;
    }

    let channel;

    try {
        channel = await GetChannel(slug);
    } catch (error) {
        res.api(400, {
            status: "ERROR",
            message: `Error while fetching channel data: ${
                (error as Error).message
            }`,
        } as ApiErrorResponse);
        return;
    }

    if (!channel) {
        res.api(400, {
            status: "ERROR",
            message: "Channel not found",
        } as ApiErrorResponse);
        return;
    }

    res.api(200, {
        data: channel,
        status: "OK",
    });
}
