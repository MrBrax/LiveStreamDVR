import { KeyValue } from "@/Core/KeyValue";
import type { ApiErrorResponse } from "@common/Api/Api";
import type express from "express";

export function GetAllKeyValues(req: express.Request, res: express.Response) {
    res.send({
        status: "OK",
        data: KeyValue.getInstance().getAllRaw(),
    });
}

export async function GetKeyValue(
    req: express.Request,
    res: express.Response
): Promise<void> {
    if (!(await KeyValue.getInstance().hasAsync(req.params.key))) {
        res.status(404).send({
            status: "ERROR",
            message: "Key not found.",
        } as ApiErrorResponse);
        return;
    }

    res.send({
        status: "OK",
        data: await KeyValue.getInstance().getRawAsync(req.params.key),
    });
}

export async function SetKeyValue(
    req: express.Request,
    res: express.Response
): Promise<void> {
    if (!req.body.value) {
        res.status(400).send({
            status: "ERROR",
            message: "No value provided.",
        } as ApiErrorResponse);
        return;
    }

    await KeyValue.getInstance().setAsync(req.params.key, req.body.value);

    res.send({
        status: "OK",
    });
}

export async function DeleteKeyValue(
    req: express.Request,
    res: express.Response
): Promise<void> {
    if (!(await KeyValue.getInstance().hasAsync(req.params.key))) {
        res.status(404).send({
            status: "ERROR",
            message: "Key not found.",
        } as ApiErrorResponse);
        return;
    }

    await KeyValue.getInstance().deleteAsync(req.params.key);

    res.send({
        status: "OK",
    });
}

export async function DeleteAllKeyValues(
    req: express.Request,
    res: express.Response
): Promise<void> {
    await KeyValue.getInstance().deleteAllAsync();

    res.send({
        status: "OK",
    });
}
