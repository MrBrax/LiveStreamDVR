import express from "express";
import { ApiErrorResponse } from "@common/Api/Api";
import { KeyValue } from "../Core/KeyValue";

export function GetAllKeyValues(req: express.Request, res: express.Response) {

    res.send({
        status: "OK",
        data: KeyValue.getInstance().getAllRaw(),
    });

}

export function GetKeyValue(req: express.Request, res: express.Response): void {

    if (!KeyValue.getInstance().has(req.params.key)){
        res.status(404).send({
            status: "ERROR",
            message: "Key not found.",
        } as ApiErrorResponse);
        return;
    }

    res.send({
        status: "OK",
        data: KeyValue.getInstance().getRaw(req.params.key),
    });

}

export function SetKeyValue(req: express.Request, res: express.Response): void {

    if (!req.body.value) {
        res.status(400).send({
            status: "ERROR",
            message: "No value provided.",
        } as ApiErrorResponse);
        return;
    }

    KeyValue.getInstance().set(req.params.key, req.body.value);

    res.send({
        status: "OK",
    });

}

export function DeleteKeyValue(req: express.Request, res: express.Response): void {

    if (!KeyValue.getInstance().has(req.params.key)){
        res.status(404).send({
            status: "ERROR",
            message: "Key not found.",
        } as ApiErrorResponse);
        return;
    }

    KeyValue.getInstance().delete(req.params.key);

    res.send({
        status: "OK",
    });

}

export function DeleteAllKeyValues(req: express.Request, res: express.Response): void {

    KeyValue.getInstance().deleteAll();

    res.send({
        status: "OK",
    });

}