import { BaseConfigFolder } from "../Core/BaseConfig";
import express from "express";
import fs from "fs";
import path from "path";
import { ExecReturn, TwitchHelper } from "../Core/TwitchHelper";

interface Bins {
    path?: string;
    status?: string;
    version?: string;
}

export async function About(req: express.Request, res: express.Response) {

    const bins: Record<string, Bins> = {};

    const pip_requirements: Record<string, { comparator: string; version: string; }> = {};
    const requirements_file = path.join(__dirname, "..", "..", "..", "requirements.txt");
    if (fs.existsSync(requirements_file)) {
        const requirements_data = fs.readFileSync(requirements_file, "utf8");
        const lines = requirements_data.split("\n");
        lines.forEach(line => {
            const matches = line.trim().match(/^([a-z_-]+)([=<>]+)([0-9.]+)$/);
            if (matches) {
                pip_requirements[matches[1].trim()] = {
                    comparator: matches[2].trim(),
                    version: matches[3].trim(),
                };
            } else {
                console.log("Failed to parse line:", line);
            }
        });
    } else {
        console.error("requirements.txt not found", requirements_file);
    }

    const bin_args: Record<string, { binary: string | false; version_args: string[]; version_regex: RegExp; }> = {
        ffmpeg: { binary: TwitchHelper.path_ffmpeg(), version_args: ["-version"], version_regex: /ffmpeg version ([\w0-9\-_.]+) Copyright/m },
        mediainfo: { binary: TwitchHelper.path_mediainfo(), version_args: ["--Version"], version_regex: /v(\d+\.\d+)/m },
        twitchdownloader: { binary: TwitchHelper.path_twitchdownloader(), version_args: ["--version", "2>&1"], version_regex: /TwitchDownloader (\d+\.\d+\.\d+)/m },
        python: { binary: "python", version_args: ["--version"], version_regex: /Python ([\d.]+)/m },
        python3: { binary: "python3", version_args: ["--version"], version_regex: /Python ([\d.]+)/m },
        node: { binary: "node", version_args: ["--version"], version_regex: /v([\d.]+)/m },
        php: { binary: "php", version_args: ["-v"], version_regex: /PHP Version ([\d.]+)/m }, // deprecated
    };

    for (const bin_name in bin_args) {
        const bin_data = bin_args[bin_name];
        if (bin_data.binary) {
            
            let exec_out;
            try {
                exec_out = await TwitchHelper.execSimple(bin_data.binary, bin_data.version_args);
            } catch (error: unknown) {
                const e = error as ExecReturn;
                if ("code" in e) {
                    console.error("exec error", error);
                }
            }

            if (exec_out) {
            
                const match_data = exec_out.stdout.join("\n") + "\n" + exec_out.stderr.join("\n");
                const match = match_data.trim().match(bin_data.version_regex);

                if (!match || match.length < 2) {
                    console.error(bin_name, "failed to match", match, match_data.trim());
                }
                
                bins[bin_name] = {
                    path: bin_data.binary,
                    version: match ? match[1] : "",
                    status: match ? match[1] : "No match.", // compare versions
                };

            } else {
                bins[bin_name] = {
                    path: bin_data.binary,
                    status: "No console output.",
                };
            }

        } else {
            bins[bin_name] = {
                status: "Not installed.",
            };
        }
    }


    const pip_pkg: Record<string, { binary: string | false; version_args: string[]; version_regex: RegExp; }> = {
        tcd: { binary: TwitchHelper.path_tcd(), version_args: ["--version", "--settings-file", path.join(BaseConfigFolder.config, "tcd_settings.json")], version_regex: /^Twitch Chat Downloader\s+([0-9.]+)$/ },
        streamlink: { binary: TwitchHelper.path_streamlink(), version_args: ["--version"], version_regex: /^streamlink\s+([0-9.]+)$/gm },
        "youtubedl": { binary: TwitchHelper.path_youtubedl(), version_args: ["--version"], version_regex: /^([0-9.]+)$/gm },
        pipenv: { binary: TwitchHelper.path_pipenv(), version_args: ["--version"], version_regex: /^pipenv, version ([0-9.]+)$/gm },
    };

    for (const pkg_name in pip_pkg) {
        const pkg_data = pip_pkg[pkg_name];
        if (pkg_data.binary){
            const out = await TwitchHelper.execSimple(pkg_data.binary, pkg_data.version_args);
            const match_data = out.stdout.join("\n") + "\n" + out.stderr.join("\n");
            const match = match_data.trim().match(pkg_data.version_regex);
            
            bins[pkg_name] = {
                path: pkg_data.binary,
                version: match ? match[0] : "",
                status: match ? match[0] : "No match.",
            };
        } else {
            bins[pkg_name] = {
                status: "Not installed.",
            };
        }
    }

    /*
    $cron_lastrun = [];
    foreach (['check_deleted_vods', 'check_muted_vods', 'dump_playlists'] as $cron) {
        $fp = TwitchHelper::$cron_folder . DIRECTORY_SEPARATOR . $cron;
        if (file_exists($fp)) {
            $t = (int)file_get_contents($fp);
            $cron_lastrun[$cron] = date("Y-m-d H:i:s", $t);
        } else {
            $cron_lastrun[$cron] = "Never run";
        }
    }
    */

    const cron_lastrun: Record<string, string> = {};
    for (const cron of ["check_deleted_vods", "check_muted_vods", "dump_playlists"]) {
        const fp = path.join(BaseConfigFolder.cron, cron);
        if (fs.existsSync(fp)) {
            const t = fs.readFileSync(fp, "utf8");
            cron_lastrun[cron] = new Date(parseInt(t)).toISOString();
        } else {
            cron_lastrun[cron] = "Never run";
        }
    }

    res.send({
        data: {
            bins: bins,
            pip: pip_requirements,
            cron_lastrun: cron_lastrun,
            is_docker: process.env.TCD_DOCKER == "1",
        },
        status: "OK",
    });

}