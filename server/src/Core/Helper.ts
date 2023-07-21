import { execSimple } from "@/Helpers/Execute";
import { executable_name, is_windows } from "@/Helpers/System";
import fs from "node:fs";
import path from "node:path";
import type { ExecReturn } from "../Providers/Twitch";
import { BaseConfigDataFolder } from "./BaseConfig";
import { Config } from "./Config";
import { LOGLEVEL, log } from "./Log";

export class Helper {
    public static vodFolder(username = "") {
        return (
            BaseConfigDataFolder.vod +
            (Config.getInstance().cfg("channel_folders") && username !== ""
                ? path.sep + username
                : "")
        );
    }

    public static path_node(): string | false {
        if (Config.getInstance().hasValue("node_path"))
            return Config.getInstance().cfg<string>("node_path");

        if (is_windows()) {
            return "C:\\Program Files\\nodejs\\node.exe";
        } else {
            return "/usr/local/bin/node";
        }
    }

    public static path_mediainfo(): string | false {
        if (Config.getInstance().hasValue("mediainfo_path"))
            return Config.getInstance().cfg<string>("mediainfo_path");
        return false;
    }

    /**
     * ffmpeg is a tool for video transcoding
     * @returns
     */
    public static path_ffmpeg(): string | false {
        if (Config.getInstance().hasValue("ffmpeg_path"))
            return Config.getInstance().cfg<string>("ffmpeg_path");
        return false;
    }

    public static path_python(): string | false {
        if (
            Config.getInstance().cfg<boolean>("python.enable_pipenv") &&
            Config.getInstance().hasValue("python.virtualenv_path")
        ) {
            return path.join(
                Config.getInstance().cfg<string>("python.virtualenv_path"),
                this.python_scripts_dir_name(),
                executable_name("python")
            );
        }

        if (Config.getInstance().hasValue("bin_path.python"))
            return Config.getInstance().cfg<string>("bin_path.python");
        return false;
    }

    /**
     * Get the path to the pipenv virtualenv, if it exists. Executes `pipenv --venv` to get the path.
     * @returns
     */
    public static async path_venv(): Promise<string | false> {
        const bin = this.path_pipenv();

        if (!bin) return false;

        let out;

        try {
            out = await execSimple(bin, ["--venv"], "pipenv --venv");
        } catch (error) {
            log(
                LOGLEVEL.ERROR,
                "helper",
                `Failed to get pipenv path: ${(error as ExecReturn).stderr}`,
                error
            );
            return false;
        }

        if (out.code !== 0) {
            log(
                LOGLEVEL.ERROR,
                "helper",
                `Failed to get pipenv path: ${out.stderr.join("\n")}`
            );
            return false;
        }

        const path = out.stdout.join("\n").trim();

        if (!fs.existsSync(path)) {
            log(
                LOGLEVEL.ERROR,
                "helper",
                `Returned pipenv path does not exist: ${path}`
            );
            return false;
        }

        return path;
    }

    public static async path_python_venv(): Promise<string | false> {
        if (Config.getInstance().hasValue("python.virtualenv_path"))
            return Config.getInstance().cfg<string>("python.virtualenv_path");

        const pipenv_path = await this.path_venv();

        if (!pipenv_path) return false;

        const python_venv = path.join(
            pipenv_path,
            this.python_scripts_dir_name(),
            executable_name("python")
        );

        if (!fs.existsSync(python_venv)) {
            log(
                LOGLEVEL.ERROR,
                "helper",
                `Python venv not found at: ${python_venv}`
            );
            return false;
        }

        return python_venv;
    }

    public static async get_pip_package_distinfo(
        package_name: string
    ): Promise<string | false> {
        let output;

        package_name = package_name.toLowerCase().trim().replaceAll("-", "_");

        try {
            output = await execSimple(
                "pip",
                ["show", package_name],
                `pip show ${package_name}`
            );
        } catch (error) {
            log(
                LOGLEVEL.ERROR,
                "helper",
                `Failed to get pip package info for ${package_name}: ${
                    (error as ExecReturn).stderr
                }`,
                error
            );
            return false;
        }

        if (output.code !== 0) {
            log(
                LOGLEVEL.ERROR,
                "helper",
                `Failed to get pip package info for ${package_name}: ${output.stderr.join(
                    "\n"
                )}`
            );
            return false;
        }

        const lines = output.stdout.join("\n").split("\n");

        const kv: Record<string, string> = lines.reduce(
            (acc, line) => {
                if (!line.includes(": ")) return acc;
                const [key, value] = line.split(": ");
                if (!key || !value) return acc;
                acc[key.trim()] = value.trim();
                return acc;
            },
            {} as Record<string, string>
        );

        if (!kv["Location"]) {
            log(
                LOGLEVEL.ERROR,
                "helper",
                `Failed to get pip package info for ${package_name}: Location not found`
            );
            return false;
        }

        const distinfo_path = path.join(
            kv["Location"],
            `${package_name}-${kv["Version"]}.dist-info`
        );

        if (!fs.existsSync(distinfo_path)) {
            log(
                LOGLEVEL.ERROR,
                "helper",
                `Failed to get pip package info for ${package_name}: dist-info not found at '${distinfo_path}'`
            );
            return false;
        }

        return distinfo_path;
    }

    public static async get_pip_package_license(
        package_name: string
    ): Promise<string | false> {
        const distinfo_path = await this.get_pip_package_distinfo(package_name);

        if (!distinfo_path) return false;

        const license_path = path.join(distinfo_path, "LICENSE");

        if (!fs.existsSync(license_path)) {
            log(
                LOGLEVEL.ERROR,
                "helper",
                `Failed to get pip package license for ${package_name}: LICENSE not found at ${license_path}`
            );
            return false;
        }

        return license_path;
    }

    public static get_bin_license(bin_name: string): string | false {
        if (is_windows()) {
            return false; // TODO: how the hell do we do this on windows?
        }

        // hardcoded bin name changes
        if (bin_name === "python") bin_name = "python3";

        const doc_path = path.join("/usr/share/doc", bin_name);

        if (!fs.existsSync(doc_path)) {
            log(
                LOGLEVEL.ERROR,
                "helper",
                `Failed to get bin license for ${bin_name}: doc path not found at ${doc_path}`
            );
            return false;
        }

        const license_path = path.join(doc_path, "LICENSE");
        const copyright_path = path.join(doc_path, "copyright");

        if (fs.existsSync(license_path)) {
            return license_path;
        }

        if (fs.existsSync(copyright_path)) {
            return copyright_path;
        }

        log(
            LOGLEVEL.ERROR,
            "helper",
            `Failed to get bin license for ${bin_name}: LICENSE or COPYRIGHT not found at ${doc_path}`
        );

        return false;
    }

    // very bad
    /**
     * ffprobe is used to get info about media files
     * @returns
     */
    public static path_ffprobe(): string | false {
        const f = this.path_ffmpeg();
        if (!f) return false;
        return f.replace("ffmpeg.exe", "ffprobe.exe");
    }

    public static python_scripts_dir_name(): string {
        return is_windows() ? "Scripts" : "bin";
    }

    public static bin_dir(): string {
        if (
            Config.getInstance().cfg<boolean>("python.enable_pipenv") &&
            Config.getInstance().hasValue("python.virtualenv_path")
        ) {
            return path.join(
                Config.getInstance().cfg<string>("python.virtualenv_path"),
                this.python_scripts_dir_name()
            );
        }

        if (Config.getInstance().hasValue("bin_dir"))
            return Config.getInstance().cfg<string>("bin_dir");
        return "";
    }

    /**
     * streamlink is used to download streams from providers
     * @returns
     */
    public static path_streamlink(): string | false {
        if (!this.bin_dir()) return false;
        const full_path = path.join(
            this.bin_dir(),
            executable_name("streamlink")
        );
        const exists = fs.existsSync(full_path);

        if (!exists) {
            log(
                LOGLEVEL.ERROR,
                "helper",
                `Streamlink binary not found at: ${full_path}`
            );
            return false;
        }

        return exists ? full_path : false;
    }

    /**
     * yt-dlp is a fork of youtube-dl with more features and bugfixes, but is currently not used
     * @returns
     */
    public static path_youtubedl(): string | false {
        if (!this.bin_dir()) return false;
        const full_path = path.join(this.bin_dir(), executable_name("yt-dlp"));
        const exists = fs.existsSync(full_path);

        if (!exists) {
            log(
                LOGLEVEL.ERROR,
                "helper",
                `yt-dlp binary not found at: ${full_path}`
            );
            return false;
        }

        return exists ? full_path : false;
    }

    /**
     * tcd is a tool for downloading twitch chats
     * @returns
     */
    public static path_tcd(): string | false {
        if (!this.bin_dir()) return false;
        const full_path = path.join(this.bin_dir(), executable_name("tcd"));
        const exists = fs.existsSync(full_path);

        if (!exists) {
            log(
                LOGLEVEL.ERROR,
                "helper",
                `tcd binary not found at: ${full_path}`
            );
            return false;
        }

        return exists ? full_path : false;
    }

    /**
     * pipenv is a tool for managing python virtual environments
     * @returns
     */
    public static path_pipenv(): string | false {
        if (!Config.getInstance().hasValue("bin_dir")) return false;
        const full_path = path.join(
            Config.getInstance().cfg("bin_dir"),
            executable_name("pipenv")
        );
        const exists = fs.existsSync(full_path);

        if (!exists) {
            log(
                LOGLEVEL.ERROR,
                "helper",
                `pipenv binary not found at: ${full_path}`
            );
            return false;
        }

        return exists ? full_path : false;
    }

    /**
     * TwitchDownloader is a tool for downloading twitch vods, clips, and chats
     * @returns
     */
    public static path_twitchdownloader(): string | false {
        if (Config.getInstance().hasValue("twitchdownloader_path"))
            return Config.getInstance().cfg<string>("twitchdownloader_path");
        return false;
    }

    /**
     * vcsi is a tool for creating video contact sheets
     * @returns
     */
    public static path_vcsi(): string | false {
        if (!this.bin_dir()) return false;
        const full_path = path.join(this.bin_dir(), executable_name("vcsi"));
        const exists = fs.existsSync(full_path);

        if (!exists) {
            log(
                LOGLEVEL.ERROR,
                "helper",
                `vcsi binary not found at: ${full_path}`
            );
            return false;
        }

        return exists ? full_path : false;
    }
}
