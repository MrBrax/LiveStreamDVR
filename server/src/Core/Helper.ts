import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execSimple } from "@/Helpers/Execute";
import { ExecReturn } from "../Providers/Twitch";
import { BaseConfigCacheFolder, BaseConfigDataFolder } from "./BaseConfig";
import { Config } from "./Config";
import { LOGLEVEL, log } from "./Log";

export class Helper {
    public static vodFolder(username = "") {
        return BaseConfigDataFolder.vod + (Config.getInstance().cfg("channel_folders") && username !== "" ? path.sep + username : "");
    }

    public static is_windows() {
        return process.platform === "win32";
    }

    public static is_docker() {
        return process.env.TCD_DOCKER !== undefined;
    }

    public static executable_name(basename: string): string {
        return basename + (this.is_windows() ? ".exe" : "");
    }

    public static path_node(): string | false {
        if (Config.getInstance().hasValue("node_path")) return Config.getInstance().cfg<string>("node_path");

        if (this.is_windows()) {
            return "C:\\Program Files\\nodejs\\node.exe";
        } else {
            return "/usr/local/bin/node";
        }
    }

    public static path_mediainfo(): string | false {
        if (Config.getInstance().hasValue("mediainfo_path")) return Config.getInstance().cfg<string>("mediainfo_path");
        return false;
    }

    public static path_ffmpeg(): string | false {
        if (Config.getInstance().hasValue("ffmpeg_path")) return Config.getInstance().cfg<string>("ffmpeg_path");
        return false;
    }

    public static path_python(): string | false {

        if (
            Config.getInstance().cfg<boolean>("python.enable_pipenv") &&
            Config.getInstance().hasValue("python.virtualenv_path")
        ) {
            return path.join(Config.getInstance().cfg<string>("python.virtualenv_path"), this.python_scripts_dir_name(), this.executable_name("python"));
        }

        if (Config.getInstance().hasValue("bin_path.python")) return Config.getInstance().cfg<string>("bin_path.python");
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
            log(LOGLEVEL.ERROR, "helper", `Failed to get pipenv path: ${(error as ExecReturn).stderr}`, error);
            return false;
        }

        if (out.code !== 0) {
            log(LOGLEVEL.ERROR, "helper", `Failed to get pipenv path: ${out.stderr.join("\n")}`);
            return false;
        }

        const path = out.stdout.join("\n").trim();

        if (!fs.existsSync(path)) {
            log(LOGLEVEL.ERROR, "helper", `Returned pipenv path does not exist: ${path}`);
            return false;
        }

        return path;

    }


    public static async path_python_venv(): Promise<string | false> {
        if (Config.getInstance().hasValue("python.virtualenv_path")) return Config.getInstance().cfg<string>("python.virtualenv_path");

        const pipenv_path = await this.path_venv();

        if (!pipenv_path) return false;

        const python_venv = path.join(pipenv_path, this.python_scripts_dir_name(), this.executable_name("python"));

        if (!fs.existsSync(python_venv)) {
            log(LOGLEVEL.ERROR, "helper", `Python venv not found at: ${python_venv}`);
            return false;
        }

        return python_venv;

    }

    public static async get_pip_package_distinfo(package_name: string): Promise<string | false> {

        let output;

        package_name = package_name.toLowerCase().trim().replaceAll("-", "_");

        try {
            output = await execSimple("pip", ["show", package_name], `pip show ${package_name}`);
        } catch (error) {
            log(LOGLEVEL.ERROR, "helper", `Failed to get pip package info for ${package_name}: ${(error as ExecReturn).stderr}`, error);
            return false;
        }

        if (output.code !== 0) {
            log(LOGLEVEL.ERROR, "helper", `Failed to get pip package info for ${package_name}: ${output.stderr.join("\n")}`);
            return false;
        }

        const lines = output.stdout.join("\n").split("\n");

        const kv: Record<string, string> = lines.reduce((acc, line) => {
            if (!line.includes(": ")) return acc;
            const [key, value] = line.split(": ");
            if (!key || !value) return acc;
            acc[key.trim()] = value.trim();
            return acc;
        }, {} as Record<string, string>);

        if (!kv["Location"]) {
            log(LOGLEVEL.ERROR, "helper", `Failed to get pip package info for ${package_name}: Location not found`);
            return false;
        }

        const distinfo_path = path.join(kv["Location"], `${package_name}-${kv["Version"]}.dist-info`);

        if (!fs.existsSync(distinfo_path)) {
            log(LOGLEVEL.ERROR, "helper", `Failed to get pip package info for ${package_name}: dist-info not found at '${distinfo_path}'`);
            return false;
        }

        return distinfo_path;

    }

    public static async get_pip_package_license(package_name: string): Promise<string | false> {

        const distinfo_path = await this.get_pip_package_distinfo(package_name);

        if (!distinfo_path) return false;

        const license_path = path.join(distinfo_path, "LICENSE");

        if (!fs.existsSync(license_path)) {
            log(LOGLEVEL.ERROR, "helper", `Failed to get pip package license for ${package_name}: LICENSE not found at ${license_path}`);
            return false;
        }

        return license_path;

    }

    public static get_bin_license(bin_name: string): string | false {

        if (this.is_windows()) {
            return false; // TODO: how the hell do we do this on windows?
        }

        // hardcoded bin name changes
        if (bin_name === "python") bin_name = "python3";

        const doc_path = path.join("/usr/share/doc", bin_name);

        if (!fs.existsSync(doc_path)) {
            log(LOGLEVEL.ERROR, "helper", `Failed to get bin license for ${bin_name}: doc path not found at ${doc_path}`);
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

        log(LOGLEVEL.ERROR, "helper", `Failed to get bin license for ${bin_name}: LICENSE or COPYRIGHT not found at ${doc_path}`);

        return false;

    }

    // very bad
    public static path_ffprobe(): string | false {
        const f = this.path_ffmpeg();
        if (!f) return false;
        return f.replace("ffmpeg.exe", "ffprobe.exe");
    }

    public static python_scripts_dir_name(): string {
        return this.is_windows() ? "Scripts" : "bin";
    }

    public static bin_dir(): string {

        if (
            Config.getInstance().cfg<boolean>("python.enable_pipenv") &&
            Config.getInstance().hasValue("python.virtualenv_path")
        ) {
            return path.join(Config.getInstance().cfg<string>("python.virtualenv_path"), this.python_scripts_dir_name());
        }

        if (Config.getInstance().hasValue("bin_dir")) return Config.getInstance().cfg<string>("bin_dir");
        return "";
    }

    public static path_streamlink(): string | false {
        if (!this.bin_dir()) return false;
        const full_path = path.join(this.bin_dir(), this.executable_name("streamlink"));
        const exists = fs.existsSync(full_path);

        if (!exists) {
            log(LOGLEVEL.ERROR, "helper", `Streamlink binary not found at: ${full_path}`);
            return false;
        }

        return exists ? full_path : false;
    }

    public static path_youtubedl(): string | false {
        if (!this.bin_dir()) return false;
        const full_path = path.join(this.bin_dir(), this.executable_name("yt-dlp"));
        const exists = fs.existsSync(full_path);

        if (!exists) {
            log(LOGLEVEL.ERROR, "helper", `yt-dlp binary not found at: ${full_path}`);
            return false;
        }

        return exists ? full_path : false;
    }

    public static path_tcd(): string | false {
        if (!this.bin_dir()) return false;
        const full_path = path.join(this.bin_dir(), this.executable_name("tcd"));
        const exists = fs.existsSync(full_path);

        if (!exists) {
            log(LOGLEVEL.ERROR, "helper", `tcd binary not found at: ${full_path}`);
            return false;
        }

        return exists ? full_path : false;
    }

    public static path_pipenv(): string | false {
        if (!Config.getInstance().hasValue("bin_dir")) return false;
        const full_path = path.join(Config.getInstance().cfg("bin_dir"), this.executable_name("pipenv"));
        const exists = fs.existsSync(full_path);

        if (!exists) {
            log(LOGLEVEL.ERROR, "helper", `pipenv binary not found at: ${full_path}`);
            return false;
        }

        return exists ? full_path : false;
    }

    public static path_twitchdownloader(): string | false {
        if (Config.getInstance().hasValue("twitchdownloader_path")) return Config.getInstance().cfg<string>("twitchdownloader_path");
        return false;
    }

    

    public static async imageThumbnail(filename: string, width: number): Promise<string> {

        log(LOGLEVEL.INFO, "helper.imageThumbnail", `Run thumbnail on ${filename}`);

        if (!filename) {
            throw new Error("No filename supplied for thumbnail");
        }

        if (!fs.existsSync(filename)) {
            log(LOGLEVEL.ERROR, "helper.imageThumbnail", `File not found for image thumbnail: ${filename}`);
            throw new Error(`File not found for image thumbnail: ${filename}`);
        }

        if (fs.statSync(filename).size == 0) {
            log(LOGLEVEL.ERROR, "helper.imageThumbnail", `Filesize is 0 for image thumbnail: ${filename}`);
            throw new Error(`Filesize is 0 for image thumbnail: ${filename}`);
        }

        // const filenameHash = createHash("md5").update(filename + width).digest("hex");
        const fileHash = createHash("md5").update(fs.readFileSync(filename)).digest("hex");

        const thumbnail_format = Config.getInstance().cfg<string>("thumbnail_format", "jpg");

        const output_image = path.join(BaseConfigCacheFolder.public_cache_thumbs, `${fileHash}.${thumbnail_format}`);

        if (fs.existsSync(output_image) && fs.statSync(output_image).size > 0) {
            log(LOGLEVEL.DEBUG, "helper.imageThumbnail", `Found existing thumbnail for ${filename}`);
            return path.basename(output_image);
        }

        if (fs.existsSync(output_image) && fs.statSync(output_image).size === 0) {
            // console.debug("Existing thumbnail filesize is 0, removing file");
            log(LOGLEVEL.DEBUG, "helper.imageThumbnail", `Existing thumbnail filesize is 0, removing file: ${output_image}`);
            fs.unlinkSync(output_image); // remove empty file
        }

        const ffmpeg_path = Helper.path_ffmpeg();
        if (!ffmpeg_path) throw new Error("Failed to find ffmpeg");

        /*
        let codec = "";
        if (thumbnail_format == "jpg") {
            codec = "jpeg";
        } else if (thumbnail_format == "png") {
            codec = "png";
        } else if (thumbnail_format == "webp") {
            codec = "webp";
        } else {
            throw new Error(`Unsupported thumbnail format: ${thumbnail_format}`);
        }
        */

        let output: ExecReturn;

        try {
            output = await execSimple(ffmpeg_path, [
                "-i", filename,
                "-vf", `scale=${width}:-1`,
                // "-codec", codec,
                output_image,
            ], "ffmpeg image thumbnail");
        } catch (error) {
            log(LOGLEVEL.ERROR, "helper.imageThumbnail", `Failed to create thumbnail: ${error}`, error);
            throw error;
        }

        if ((output.stderr.join("") + output.stdout.join("")).includes("Default encoder for format")) {
            throw new Error("Unsupported codec for image thumbnail");
        }

        if (output && fs.existsSync(output_image) && fs.statSync(output_image).size > 0) {
            return path.basename(output_image);
        } else {
            log(LOGLEVEL.ERROR, "helper.imageThumbnail", `Failed to create thumbnail for ${filename}`, output);
            throw new Error("No output from ffmpeg");
        }

    }

}