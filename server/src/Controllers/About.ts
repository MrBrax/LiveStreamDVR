import type { BinaryStatus } from "@common/Api/About";
import type { ApiAboutResponse } from "@common/Api/Api";
import type express from "express";
import readdirRecursive from "fs-readdir-recursive";
import fs from "node:fs";
import process from "node:process";
import { BaseConfigCacheFolder, BaseConfigDataFolder } from "@/Core/BaseConfig";
import { Config } from "@/Core/Config";
import { Helper } from "@/Core/Helper";
import { KeyValue } from "@/Core/KeyValue";
import { LiveStreamDVR } from "@/Core/LiveStreamDVR";
import { GetRunningProcesses } from "@/Helpers/Execute";
import { DVRBinaries, DVRPipPackages, PipRequirements, getBinaryVersion } from "@/Helpers/Software";
import { is_docker } from "@/Helpers/System";
import { getLogLines } from "@/Core/Log";

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

    const watcher_amount = LiveStreamDVR.getInstance().getChannels().reduce((a, b) => {
        return a + (b.fileWatcher ? 1 : 0);
    }, 0);

    const storage_data_file_count = readdirRecursive(BaseConfigDataFolder.storage).length;
    const cache_data_file_count = readdirRecursive(BaseConfigCacheFolder.cache).length;

    const debug = Config.debug ? {
        watcher_amount,
        channel_amount: LiveStreamDVR.getInstance().getChannels().length,
        vod_amount: LiveStreamDVR.getInstance().getChannels().reduce((a, b) => {
            return a + b.vods_list.length;
        }, 0),
        keyvalue_amount: KeyValue.getInstance().count(),
        storage_data_file_count,
        cache_data_file_count,
        free_disk_space: LiveStreamDVR.getInstance().freeStorageDiskSpace,
        arch: process.arch,
        platform: process.platform,
        cpu_usage: process.cpuUsage(),
        date: new Date(),
        uptime: process.uptime(),
        child_processes: GetRunningProcesses().length,
        log_lines: getLogLines().length,
        keyvalues: Object.keys(KeyValue.getInstance().getData()).length,
    } : undefined;

    res.send({
        data: {
            bins: bins,
            pip: PipRequirements,
            is_docker: is_docker(),
            memory: process.memoryUsage(),
            debug: debug,
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

    let license_path = await Helper.get_pip_package_license(package_name);

    if (!license_path) {
        license_path = Helper.get_bin_license(package_name);
        if (!license_path) {
            res.status(404).send({
                status: "ERROR",
                error: "License not found for either pip or bin package",
            });
            return;
        }
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