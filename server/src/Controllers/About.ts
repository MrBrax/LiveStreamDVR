import type { BinaryStatus } from "@common/Api/About";
import { ApiAboutResponse } from "@common/Api/Api";
import express from "express";
import fs from "node:fs";
import process from "node:process";
import { Helper } from "../Core/Helper";
import { LiveStreamDVR } from "../Core/LiveStreamDVR";
import { DVRBinaries, DVRPipPackages, getBinaryVersion, PipRequirements } from "../Helpers/Software";

export async function About(req: express.Request, res: express.Response): Promise<void> {

    const bins: Record<string, BinaryStatus> = {};

    const b = DVRBinaries();
    for (const bin_name in b) {
        if (LiveStreamDVR.binaryVersions[bin_name]) {
            bins[bin_name] = LiveStreamDVR.binaryVersions[bin_name];
            continue;
        }
        const ret = await getBinaryVersion("bin", bin_name);
        if (ret) {
            bins[bin_name] = ret;
            LiveStreamDVR.binaryVersions[bin_name] = ret;
        } else {
            bins[bin_name] = {
                path: "not found",
                status: "not found",
            };
        }
    }

    const p = DVRPipPackages();
    for (const pkg_name in p) {
        if (LiveStreamDVR.binaryVersions[pkg_name]) {
            bins[pkg_name] = LiveStreamDVR.binaryVersions[pkg_name];
            continue;
        }
        const ret = await getBinaryVersion("pip", pkg_name);
        if (ret) {
            bins[pkg_name] = ret;
            LiveStreamDVR.binaryVersions[pkg_name] = ret;
        } else {
            bins[pkg_name] = {
                path: "not found",
                status: "not found",
            };
        }
    }

    res.send({
        data: {
            bins: bins,
            pip: PipRequirements,
            is_docker: Helper.is_docker(),
            memory: process.memoryUsage(),
            // keyvalue: KeyValue.getInstance().data,
        },
        status: "OK",
    } as ApiAboutResponse);

}

export async function License(req: express.Request, res: express.Response): Promise<void> {

    const package_name = req.query.package_name as string;

    if (!package_name) {
        res.status(400).send({
            status: "ERROR",
            error: "Missing package_name",
        });
        return;
    }

    const license_path = await Helper.get_pip_package_license(package_name);

    if (!license_path) {
        res.status(404).send({
            status: "ERROR",
            error: "Package not found",
        });
        return;
    }

    const contents = fs.readFileSync(license_path, "utf-8").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

    res.send(`
        <title>${package_name} LICENSE</title>
        <h1>${package_name} LICENSE</h1>
        <pre>${contents}</pre>
        <style>
            pre {
                white-space: pre-wrap;
                word-wrap: break-word;
            }
            body {
                font-family: monospace;
                background-color: #d4d4d4;
                color: #1e1e1e;
            }
        </style>
    `);

}