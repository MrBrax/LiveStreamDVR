import type { BinaryStatus } from "@common/Api/About";
import { ApiAboutResponse } from "@common/Api/Api";
import express from "express";
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
            // keyvalue: KeyValue.getInstance().data,
        },
        status: "OK",
    } as ApiAboutResponse);

}