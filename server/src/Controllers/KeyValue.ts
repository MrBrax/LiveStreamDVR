import { KeyValue } from "@/Core/KeyValue";
import type { ApiErrorResponse } from "@common/Api/Api";
import type express from "express";

export function GetAllKeyValues(req: express.Request, res: express.Response) {
    res.api(200, {
        status: "OK",
        data: KeyValue.getInstance().getAllRaw(),
    });
}

export function GetKeyValue(req: express.Request, res: express.Response): void {
    if (!KeyValue.getInstance().has(req.params.key)) {
        res.api(404, {
            status: "ERROR",
            message: "Key not found.",
        } as ApiErrorResponse);
        return;
    }

    res.api(200, {
        status: "OK",
        data: KeyValue.getInstance().getRaw(req.params.key),
    });
}

export function SetKeyValue(req: express.Request, res: express.Response): void {
    const value = req.body.value as string;

    if (!value) {
        res.api(400, {
            status: "ERROR",
            message: "No value provided.",
        } as ApiErrorResponse);
        return;
    }

    KeyValue.getInstance().set(req.params.key, value);

    res.api(200, {
        status: "OK",
    });
}

export function DeleteKeyValue(
    req: express.Request,
    res: express.Response
): void {
    if (!KeyValue.getInstance().has(req.params.key)) {
        res.api(404, {
            status: "ERROR",
            message: "Key not found.",
        } as ApiErrorResponse);
        return;
    }

    KeyValue.getInstance().delete(req.params.key);

    res.api(200, {
        status: "OK",
    });
}

export function DeleteAllKeyValues(
    req: express.Request,
    res: express.Response
): void {
    KeyValue.getInstance().deleteAll();

    res.api(200, {
        status: "OK",
    });
}
