import { KeyValue } from "Core/KeyValue";
import express from "express";
import { ApiErrorResponse } from "../../../common/Api/Api";

export function GetKeyValue(req: express.Request, res: express.Response): void {

    if (!KeyValue.has(req.params.key)){
        res.status(404).send({
            status: "ERROR",
            message: "Key not found.",
        } as ApiErrorResponse);
        return;
    }
    
    res.send({
        status: "OK",
        data: KeyValue.get(req.params.key),
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

    KeyValue.set(req.params.key, req.body.value);

    res.send({
        status: "OK",
    });

}

export function DeleteKeyValue(req: express.Request, res: express.Response): void {

    if (!KeyValue.has(req.params.key)){
        res.status(404).send({
            status: "ERROR",
            message: "Key not found.",
        } as ApiErrorResponse);
        return;
    }

    KeyValue.delete(req.params.key);

    res.send({
        status: "OK",
    });

}