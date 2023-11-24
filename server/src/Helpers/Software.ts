import { AppRoot } from "@/Core/BaseConfig";
import { Helper } from "@/Core/Helper";
import type { BinaryStatus } from "@common/Api/About";
import { compareVersions } from "compare-versions";
import fs from "node:fs";
import path from "node:path";
import { execSimple, isExecError } from "./Execute";

interface BinaryDef {
    binary: string | false;
    version_args: string[];
    version_regex: RegExp;
    on_boot?: boolean;
}

export function DVRBinaries(): Record<string, BinaryDef> {
    return {
        ffmpeg: {
            binary: Helper.path_ffmpeg(),
            version_args: ["-version"],
            version_regex: /ffmpeg version ([\w0-9\-_.+]+) Copyright/m,
        },
        mediainfo: {
            binary: Helper.path_mediainfo(),
            version_args: ["--Version"],
            version_regex: /v(\d+\.\d+)/m,
        },
        twitchdownloader: {
            binary: Helper.path_twitchdownloader(),
            version_args: ["--version", "2>&1"],
            version_regex: /TwitchDownloaderCLI (\d+\.\d+\.\d+)/m,
        },
        python: {
            binary: Helper.path_python(),
            version_args: ["--version"],
            version_regex: /Python ([\d.]+)/m,
        },
        // python3: { binary: Helper.path_python3(), version_args: ["--version"], version_regex: /Python ([\d.]+)/m },
        node: {
            binary: Helper.path_node(),
            version_args: ["--version"],
            version_regex: /v([\d.]+)/m,
        },
        // php: { binary: "php", version_args: ["-v"], version_regex: /PHP Version ([\d.]+)/m }, // deprecated
    };
}

export function DVRPipPackages(): Record<string, BinaryDef> {
    return {
        // tcd: {
        //     binary: Helper.path_tcd(),
        //     version_args: [
        //         "--version",
        //         "--settings-file",
        //         path.join(BaseConfigDataFolder.config, "tcd_settings.json"),
        //     ],
        //     version_regex: /^Twitch Chat Downloader\s+([0-9.]+)$/m,
        // },
        streamlink: {
            binary: Helper.path_streamlink(),
            version_args: ["--version"],
            version_regex: /^streamlink\s+([0-9.]+)$/m,
            on_boot: true,
        },
        "yt-dlp": {
            binary: Helper.path_youtubedl(),
            version_args: ["--version"],
            version_regex: /^([0-9.]+)$/m,
        },
        pipenv: {
            binary: Helper.path_pipenv(),
            version_args: ["--version"],
            version_regex: /^pipenv, version ([0-9.]+)$/m,
        },
        vcsi: {
            binary: Helper.path_vcsi(),
            version_args: ["--version"],
            version_regex: /^vcsi version ([0-9.]+)$/m,
        },
    };
}

export const PipRequirements: Record<
    string,
    { comparator: string; version: string }
> = {};
export const BinaryRequirements: Record<
    string,
    { comparator: string; version: string }
> = {};

export function loadPipRequirements() {
    if (Object.keys(PipRequirements).length > 0) return;
    const requirementsFile = path.join(AppRoot, "requirements.txt");
    if (fs.existsSync(requirementsFile)) {
        const requirementsData = fs.readFileSync(requirementsFile, "utf8");
        const lines = requirementsData.split("\n");
        lines.forEach((line) => {
            const matches = line.trim().match(/^([a-z_-]+)([=<>]+)([0-9.]+)$/);
            if (matches) {
                PipRequirements[matches[1].trim()] = {
                    comparator: matches[2].trim(),
                    version: matches[3].trim(),
                };
            } else {
                console.log("Failed to parse line:", line);
            }
        });
        // console.debug("PipRequirements:", PipRequirements);
    } else {
        console.error("requirements.txt not found", requirementsFile);
    }
}

export function loadBinaryRequirements() {
    if (Object.keys(BinaryRequirements).length > 0) return;
    const requirementsFile = path.join(AppRoot, "binaries.txt");
    if (fs.existsSync(requirementsFile)) {
        const requirementsData = fs.readFileSync(requirementsFile, "utf8");
        const lines = requirementsData.split("\n");
        lines.forEach((line) => {
            const matches = line.trim().match(/^([a-z_-]+)([=<>]+)([0-9.]+)$/);
            if (matches) {
                BinaryRequirements[matches[1].trim()] = {
                    comparator: matches[2].trim(),
                    version: matches[3].trim(),
                };
            } else {
                console.log("Failed to parse line:", line);
            }
        });
        // console.debug("PipRequirements:", PipRequirements);
    } else {
        console.error("binaries.txt not found", requirementsFile);
    }
}

export async function getBinaryVersion(
    type: "pip" | "bin",
    bin_name: string
): Promise<BinaryStatus | undefined> {
    loadPipRequirements();
    loadBinaryRequirements();

    const binData =
        type == "bin" ? DVRBinaries()[bin_name] : DVRPipPackages()[bin_name];
    if (binData.binary) {
        let outString = "";

        let outExec;
        try {
            outExec = await execSimple(
                binData.binary,
                binData.version_args,
                "about binary check"
            );
        } catch (error) {
            if (isExecError(error)) {
                console.error("exec error", error);
                outString += error.stdout.map((line) => line.trim()).join("\n");
                outString += error.stderr.map((line) => line.trim()).join("\n");
            } else {
                console.error("exec error", error);
            }
        }

        if (outExec) {
            outString += outExec.stdout.map((line) => line.trim()).join("\n");
        }

        if (outString !== "") {
            const match = outString.trim().match(binData.version_regex);

            if (!match || match.length < 2) {
                console.error(
                    bin_name,
                    "failed to match",
                    match,
                    outString.trim()
                );
                return undefined;
            }

            const version = match[1];
            const minVersion =
                PipRequirements[bin_name]?.version ??
                BinaryRequirements[bin_name]?.version;

            let status = "ok";

            if (minVersion) {
                const comparator =
                    PipRequirements[bin_name]?.comparator ??
                    BinaryRequirements[bin_name]?.comparator;
                // if (comparator == "=") {
                //     if (match[1] != min_version) status = "outdated";
                let compare;
                try {
                    compare = compareVersions(version, minVersion);
                } catch (error) {
                    console.error(
                        `Could not compare version ${version} to ${minVersion}: ${
                            (error as Error).message
                        }`
                    );
                }
                if (compare) {
                    // if (comparator == "=" && compare != 0) status = "outdated";
                    // if (comparator == "<" && compare >= 0) status = "outdated";
                    // if (comparator == ">" && compare <= 0) status = "outdated";
                    if (comparator == "<=" && compare > 0) status = "outdated";
                    if (comparator == ">=" && compare < 0) status = "outdated";
                }
            }

            return match
                ? {
                      path: binData.binary,
                      status: status,
                      version: version,
                      min_version: minVersion,
                  }
                : undefined;
        } else {
            return {
                path: binData.binary,
                status: "missing",
            };
        }
    } else {
        return undefined;
    }
}
