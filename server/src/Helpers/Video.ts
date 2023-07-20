import type { FFProbe } from "@common/FFProbe";
import type { AudioMetadata, MediaInfoJSONOutput, VideoMetadata } from "@common/MediaInfo";
import type { MediaInfo } from "@common/mediainfofield";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { BaseConfigCacheFolder, BaseConfigDataFolder } from "@/Core/BaseConfig";
import { Config } from "@/Core/Config";
import { Helper } from "@/Core/Helper";
import { LiveStreamDVR } from "@/Core/LiveStreamDVR";
import { LOGLEVEL, log } from "@/Core/Log";
import type { RemuxReturn } from "../Providers/Twitch";
import { progressOutput } from "./Console";
import { execSimple, startJob } from "./Execute";
import { formatDuration } from "./Format";

/**
 * Remux input to output
 *
 * @param input
 * @param output
 * @param overwrite
 * @param metadata_file
 * @returns
 */
export function remuxFile(input: string, output: string, overwrite = false, metadata_file?: string): Promise<RemuxReturn> {

    return new Promise((resolve, reject) => {

        const ffmpeg_path = Helper.path_ffmpeg();

        if (!ffmpeg_path) {
            reject(new Error("Failed to find ffmpeg"));
            return;
        }

        const emptyFile = fs.existsSync(output) && fs.statSync(output).size == 0;

        if (!overwrite && fs.existsSync(output) && !emptyFile) {
            log(LOGLEVEL.ERROR, "helper", `Output file ${output} already exists`);
            reject(new Error(`Output file ${output} already exists`));
        }

        if (emptyFile) {
            fs.unlinkSync(output);
        }

        // ffmpeg seems to make ts cfr into vfr, don't know why

        const opts: string[] = [];
        // "-r", parseInt(info.video.FrameRate).toString(),
        // "-vsync", "cfr",
        opts.push("-i", input);

        // write metadata to file
        if (metadata_file) {
            if (fs.existsSync(metadata_file)) {
                opts.push("-i", metadata_file);
                opts.push("-map_metadata", "1");
            } else {
                log(LOGLEVEL.ERROR, "helper", `Metadata file ${metadata_file} does not exist for remuxing ${input}`);
            }
        }

        // "-map", "0",
        // "-analyzeduration", 

        opts.push("-c", "copy"); // copy all streams

        if (!output.endsWith(Config.AudioContainer)) {
            opts.push("-bsf:a", "aac_adtstoasc"); // audio bitstream filter?
        }

        if (output.endsWith(".mp4")) {
            opts.push("-movflags", "faststart"); // make streaming possible, not sure if this is a good idea
        }

        // "-r", parseInt(info.video.FrameRate).toString(),
        // "-vsync", "cfr",
        // ...ffmpeg_options,
        // output,

        if (overwrite || emptyFile) {
            opts.push("-y");
        }

        if (Config.getInstance().cfg("app_verbose")) {
            opts.push("-loglevel", "repeat+level+verbose");
        }

        if (Config.getInstance().cfg("debug")) {
            // opts.push("-report"); // can't set output file
            opts.push("-progress", path.join(BaseConfigDataFolder.logs_software, "ffmpeg_progress.log"));
            opts.push("-vstats");
            opts.push("-vstats_file", path.join(BaseConfigDataFolder.logs_software, "ffmpeg_vstats.log"));
        }

        opts.push(output);

        log(LOGLEVEL.INFO, "helper", `Remuxing ${input} to ${output}`);

        const job = startJob(`remux_${path.basename(input)}`, ffmpeg_path, opts);

        if (!job || !job.process) {
            reject(new Error(`Failed to start job for remuxing ${input} to ${output}`));
            return;
        }

        let currentSeconds = 0;
        let totalSeconds = 0;
        job.on("log", (stream: string, data: string) => {
            const totalDurationMatch = data.match(/Duration: (\d+):(\d+):(\d+)/);
            if (totalDurationMatch && !totalSeconds) {
                totalSeconds = parseInt(totalDurationMatch[1]) * 3600 + parseInt(totalDurationMatch[2]) * 60 + parseInt(totalDurationMatch[3]);
                console.log(`Remux total duration for ${path.basename(input)}: ${totalSeconds}`);
            }
            const currentTimeMatch = data.match(/time=(\d+):(\d+):(\d+)/);
            if (currentTimeMatch && totalSeconds > 0) {
                currentSeconds = parseInt(currentTimeMatch[1]) * 3600 + parseInt(currentTimeMatch[2]) * 60 + parseInt(currentTimeMatch[3]);
                job.setProgress(currentSeconds / totalSeconds);
                // console.debug(`Remux current time: ${currentSeconds}/${totalSeconds}`);
                progressOutput(
                    `🎞 Remuxing ${path.basename(input)} - ${currentSeconds}/${totalSeconds} seconds (${Math.round((currentSeconds / totalSeconds) * 100)}%)`
                );
            }
            if (data.match(/moving the moov atom/)) {
                console.log(`Create MOOV atom for ${path.basename(input)} (this usually takes a while)`);
            }
        });

        job.process.on("error", (err) => {
            log(LOGLEVEL.ERROR, "helper", `Process ${process.pid} error: ${err}`);
            // reject({ code: -1, success: false, stdout: job.stdout, stderr: job.stderr });
            reject(new Error(`Process ${process.pid} error: ${err}`));
        });

        job.process.on("close", (code) => {
            if (job) {
                job.clear();
            }
            LiveStreamDVR.getInstance().updateFreeStorageDiskSpace();
            // const out_log = ffmpeg.stdout.read();
            const success = fs.existsSync(output) && fs.statSync(output).size > 0;
            if (success) {
                log(LOGLEVEL.SUCCESS, "helper", `Remuxed ${input} to ${output}`);
                resolve({ code: code || -1, success, stdout: job.stdout, stderr: job.stderr });
            } else {
                log(LOGLEVEL.ERROR, "helper", `Failed to remux '${input}' to '${output}'`);
                // reject({ code, success, stdout: job.stdout, stderr: job.stderr });

                let message = "Unknown error";
                const errorSearch = job.stderr.join("").match(/\[error\] (.*)/g);
                if (errorSearch && errorSearch.length > 0) {
                    message = errorSearch.slice(1).join(", ");
                }

                if (fs.existsSync(output) && fs.statSync(output).size == 0) {
                    fs.unlinkSync(output);
                }

                // for (const err of errorSearch) {
                //    message = err[1];
                reject(new Error(`Failed to remux '${input}' to '${output}': ${message}`));
            }
        });

    });

}

export function cutFile(input: string, output: string, start_second: number, end_second: number, overwrite = false): Promise<RemuxReturn> {

    return new Promise((resolve, reject) => {

        const ffmpeg_path = Helper.path_ffmpeg();

        if (!ffmpeg_path) {
            reject(new Error("Failed to find ffmpeg"));
            return;
        }

        const emptyFile = fs.existsSync(output) && fs.statSync(output).size == 0;

        if (!overwrite && fs.existsSync(output) && !emptyFile) {
            log(LOGLEVEL.ERROR, "helper", `Output file ${output} already exists`);
            reject(new Error(`Output file ${output} already exists`));
            return;
        }

        if (emptyFile) {
            fs.unlinkSync(output);
        }

        const opts: string[] = [];
        opts.push("-i", input);
        opts.push("-ss", start_second.toString());
        opts.push("-t", (end_second - start_second).toString());
        opts.push("-c", "copy");
        // opts.push("-bsf:a", "aac_adtstoasc");
        // ...ffmpeg_options,
        // output,

        if (Config.debug || Config.getInstance().cfg("app_verbose")) {
            opts.push("-loglevel", "repeat+level+verbose");
        }

        opts.push(output);

        log(LOGLEVEL.INFO, "helper", `Cutting ${input} to ${output}`);

        const job = startJob(`cut_${path.basename(input)}`, ffmpeg_path, opts);

        if (!job || !job.process) {
            reject(new Error(`Failed to start job for cutting ${input} to ${output}`));
            return;
        }

        job.process.on("error", (err) => {
            log(LOGLEVEL.ERROR, "helper", `Process ${process.pid} error: ${err}`);
            // reject({ code: -1, success: false, stdout: job.stdout, stderr: job.stderr });
            reject(new Error(`Process ${process.pid} error: ${err}`));
        });

        job.process.on("close", (code) => {
            if (job) {
                job.clear();
            }
            // const out_log = ffmpeg.stdout.read();
            const success = fs.existsSync(output) && fs.statSync(output).size > 0;
            if (success) {
                log(LOGLEVEL.SUCCESS, "helper", `Cut ${input} to ${output} success`);
                resolve({ code: code || -1, success, stdout: job.stdout, stderr: job.stderr });
            } else {
                log(LOGLEVEL.ERROR, "helper", `Failed to cut ${path.basename(input)} to ${path.basename(output)}`);
                // reject({ code, success, stdout: job.stdout, stderr: job.stderr });

                let message = "Unknown error";
                const errorSearch = job.stderr.join("").match(/\[error\] (.*)/g);
                if (errorSearch && errorSearch.length > 0) {
                    message = errorSearch.slice(1).join(", ");
                }

                if (fs.existsSync(output) && fs.statSync(output).size == 0) {
                    fs.unlinkSync(output);
                }

                // for (const err of errorSearch) {
                //    message = err[1];
                reject(new Error(`Failed to cut ${path.basename(input)} to ${path.basename(output)}: ${message}`));
            }
        });

        let currentSeconds = 0;
        let totalSeconds = 0;
        job.on("log", (stream: string, data: string) => {
            const totalDurationMatch = data.match(/Duration: (\d+):(\d+):(\d+)/);
            if (totalDurationMatch && !totalSeconds) {
                totalSeconds = parseInt(totalDurationMatch[1]) * 3600 + parseInt(totalDurationMatch[2]) * 60 + parseInt(totalDurationMatch[3]);
                console.debug(`Cut total duration: ${totalSeconds}`);
            }
            const currentTimeMatch = data.match(/time=(\d+):(\d+):(\d+)/);
            if (currentTimeMatch && totalSeconds > 0) {
                currentSeconds = parseInt(currentTimeMatch[1]) * 3600 + parseInt(currentTimeMatch[2]) * 60 + parseInt(currentTimeMatch[3]);
                job.setProgress(currentSeconds / totalSeconds);
                console.debug(`Cut current time: ${currentSeconds}`);
            }
            if (data.match(/moving the moov atom/)) {
                console.debug("Cut moov atom move");
            }
        });

    });

}

/**
 * Return mediainfo for a file
 * 
 * @param filename 
 * @throws
 * @returns 
 */
export async function mediainfo(filename: string): Promise<MediaInfo> {

    log(LOGLEVEL.INFO, "helper.mediainfo", `Run mediainfo on ${filename}`);

    if (!filename) {
        throw new Error("No filename supplied for mediainfo");
    }

    if (!fs.existsSync(filename)) {
        throw new Error("File not found for mediainfo");
    }

    if (fs.statSync(filename).size == 0) {
        throw new Error("Filesize is 0 for mediainfo");
    }

    const mediainfo_path = Helper.path_mediainfo();
    if (!mediainfo_path) throw new Error("Failed to find mediainfo");

    const output = await execSimple(mediainfo_path, ["--Full", "--Output=JSON", filename], "mediainfo");

    if (output && output.stdout) {

        const json: MediaInfoJSONOutput = JSON.parse(output.stdout.join(""));

        const data: any = {};

        for (const track of json.media.track) {
            if (track["@type"] == "General") {
                data.general = track;
            } else if (track["@type"] == "Video") {
                data.video = track;
            } else if (track["@type"] == "Audio") {
                data.audio = track;
            }
        }

        return data as MediaInfo;

    } else {
        log(LOGLEVEL.ERROR, "helper.mediainfo", `No output from mediainfo for ${filename}`);
        throw new Error("No output from mediainfo");
    }
}

export async function ffprobe(filename: string): Promise<FFProbe> {

    log(LOGLEVEL.INFO, "helper.ffprobe", `Run ffprobe on ${filename}`);

    if (!filename) {
        throw new Error("No filename supplied for ffprobe");
    }

    if (!fs.existsSync(filename)) {
        throw new Error("File not found for ffprobe");
    }

    if (fs.statSync(filename).size == 0) {
        throw new Error("Filesize is 0 for ffprobe");
    }

    const ffprobe_path = Helper.path_ffprobe();
    if (!ffprobe_path) throw new Error("Failed to find ffprobe");

    const output = await execSimple(ffprobe_path, [
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        // "-show_entries",
        filename,
    ], "ffprobe");

    if (output && output.stdout) {
        const json: FFProbe = JSON.parse(output.stdout.join(""));
        return json;
    } else {
        log(LOGLEVEL.ERROR, "helper.ffprobe", `No output from ffprobe for ${filename}`);
        throw new Error("No output from ffprobe");
    }

}

export async function videometadata(filename: string, force = false): Promise<VideoMetadata | AudioMetadata> {

    let data: MediaInfo | false = false;

    const filenameHash = createHash("md5").update(filename).digest("hex"); // TODO: do we need it to by dynamic?
    const dataPath = path.join(BaseConfigCacheFolder.cache, "mediainfo", `${filenameHash}.json`);

    if (fs.existsSync(dataPath) && !force) {

        data = JSON.parse(fs.readFileSync(dataPath, { encoding: "utf-8" }));

        if (!data) {
            log(LOGLEVEL.ERROR, "helper.videometadata", `Trying to read cached mediainfo of ${filename} returned nothing`);
            throw new Error("No cached data from mediainfo");
        }

        log(LOGLEVEL.DEBUG, "helper.videometadata", `Read cached mediainfo of ${filename}`);

    } else {

        try {
            data = await mediainfo(filename);
        } catch (th) {
            log(LOGLEVEL.ERROR, "helper.videometadata", `Trying to get mediainfo of ${filename} returned: ${(th as Error).message}`);
            throw th; // rethrow?
        }

        if (!data) {
            log(LOGLEVEL.ERROR, "helper.videometadata", `Trying to get mediainfo of ${filename} returned false`);
            throw new Error("No data from mediainfo");
        }

        if (!fs.existsSync(path.dirname(dataPath))) {
            fs.mkdirSync(path.dirname(dataPath), { recursive: true });
        }

        fs.writeFileSync(dataPath, JSON.stringify(data));

        log(LOGLEVEL.DEBUG, "helper.videometadata", `Wrote cached mediainfo of ${filename}`);

    }

    if (!data.general.Format || !data.general.Duration) {
        log(LOGLEVEL.ERROR, "helper.videometadata", `Invalid mediainfo for ${filename} (missing ${!data.general.Format ? "Format" : ""} ${!data.general.Duration ? "Duration" : ""})`);
        throw new Error("Invalid mediainfo: no format/duration");
    }

    // if (!data.video) {
    //     logAdvanced(LOGLEVEL.ERROR, "helper.videometadata", `Invalid mediainfo for ${filename} (missing video)`);
    //     throw new Error("Invalid mediainfo: no video");
    // }

    if (!data.audio) {
        log(LOGLEVEL.ERROR, "helper.videometadata", `Invalid mediainfo for ${filename} (missing audio)`);
        throw new Error("Invalid mediainfo: no audio");
    }

    const isAudio = data.video === undefined;

    if (isAudio) {

        if (data.audio) {

            const audio_metadata = {

                type: "audio",

                container: data.general.Format,

                size: parseInt(data.general.FileSize),
                // duration: parseInt(data.general.Duration),
                duration: parseFloat(data.audio.Duration || data.general.Duration),
                full_duration: parseFloat(data.general.Duration),
                bitrate: parseInt(data.general.OverallBitRate),

                audio_codec: data.audio.Format,
                audio_bitrate: parseInt(data.audio.BitRate),
                audio_bitrate_mode: data.audio.BitRate_Mode as "VBR" | "CBR",
                audio_sample_rate: parseInt(data.audio.SamplingRate),
                audio_channels: parseInt(data.audio.Channels),

            } as AudioMetadata;

            log(LOGLEVEL.SUCCESS, "helper.videometadata", `${filename} is an audio file ${audio_metadata.duration} long.`);

            return audio_metadata;

        } else {

            throw new Error("Invalid mediainfo: no audio");

        }

    } else {

        if (data.video && data.audio) {

            const video_metadata = {

                type: "video",

                container: data.general.Format,

                size: parseInt(data.general.FileSize),
                // duration: parseInt(data.general.Duration),
                duration: parseInt(data.video.Duration || data.general.Duration),
                full_duration: parseInt(data.general.Duration),
                bitrate: parseInt(data.general.OverallBitRate),

                width: parseInt(data.video.Width),
                height: parseInt(data.video.Height),

                fps: parseInt(data.video.FrameRate), // TODO: check if this is correct, seems to be variable
                fps_mode: data.video.FrameRate_Mode as "VFR" | "CFR",

                audio_codec: data.audio.Format,
                audio_bitrate: parseInt(data.audio.BitRate),
                audio_bitrate_mode: data.audio.BitRate_Mode as "VBR" | "CBR",
                audio_sample_rate: parseInt(data.audio.SamplingRate),
                audio_channels: parseInt(data.audio.Channels),

                video_codec: data.video.Format,
                video_bitrate: parseInt(data.video.BitRate),
                video_bitrate_mode: data.video.BitRate_Mode as "VBR" | "CBR",

            } as VideoMetadata;

            log(LOGLEVEL.SUCCESS, "helper.videometadata", `${filename} is a video file ${formatDuration(video_metadata.duration)} long at ${video_metadata.height}p${video_metadata.fps}.`);

            return video_metadata;

        } else {

            throw new Error("Invalid mediainfo: no video/audio");

        }

    }

}

export function ffmpeg_time(ms: number): string {
    // format as 00:00:00.000
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor(((ms % 3600000) % 60000) / 1000);
    const milliseconds = Math.floor(((ms % 3600000) % 60000) % 1000);
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
}

export async function videoThumbnail(filename: string, width: number, offset = 5000): Promise<string> {

    log(LOGLEVEL.INFO, "helper.videoThumbnail", `Requested video thumbnail of ${filename}`);

    if (!filename) {
        throw new Error("No filename supplied for thumbnail");
    }

    if (!fs.existsSync(filename)) {
        throw new Error(`File not found for video thumbnail: ${filename}`);
    }

    if (fs.statSync(filename).size == 0) {
        throw new Error(`Filesize is 0 for video thumbnail: ${filename}`);
    }

    const filenameHash = createHash("md5").update(filename + width + offset).digest("hex");

    const output_image = path.join(BaseConfigCacheFolder.public_cache_thumbs, `${filenameHash}.${Config.getInstance().cfg<string>("thumbnail_format", "jpg")}`);

    if (fs.existsSync(output_image)) {
        log(LOGLEVEL.DEBUG, "helper.videoThumbnail", `Thumbnail already exists for ${filename}, returning cached version`);
        return path.basename(output_image);
    }

    const ffmpeg_path = Helper.path_ffmpeg();
    if (!ffmpeg_path) throw new Error("Failed to find ffmpeg");

    const output = await execSimple(ffmpeg_path, [
        "-ss", ffmpeg_time(offset),
        "-i", filename,
        "-vf", `thumbnail,scale=${width}:-1`,
        "-frames:v", "1",
        output_image,
    ], "ffmpeg video thumbnail");

    if (output && fs.existsSync(output_image) && fs.statSync(output_image).size > 0) {
        log(LOGLEVEL.SUCCESS, "helper.videoThumbnail", `Created video thumbnail for ${filename}`);
        return path.basename(output_image);
    } else {
        log(LOGLEVEL.ERROR, "helper.videoThumbnail", `Failed to create video thumbnail for ${filename}`);
        throw new Error("No output from ffmpeg");
    }

}

export async function videoContactSheet(video_filename: string, output_image: string, {
    width,
    grid,
}: { width?: number, grid?: string } = {}): Promise<boolean> {

    if (!video_filename) {
        throw new Error("No filename supplied for contact sheet");
    }

    if (!fs.existsSync(video_filename)) {
        throw new Error(`File not found for video contact sheet: ${video_filename}`);
    }

    if (fs.statSync(video_filename).size == 0) {
        throw new Error(`Filesize is 0 for video contact sheet: ${video_filename}`);
    }

    if (fs.existsSync(output_image)) {
        log(LOGLEVEL.DEBUG, "helper.videoContactSheet", `Contact sheet already exists for ${video_filename}, returning cached version`);
        return true;
    }

    log(LOGLEVEL.INFO, "helper.videoContactSheet", `Requested video contact sheet of ${video_filename} with width ${width} and grid ${grid}, output to ${output_image}`);

    const vcsi_path = Helper.path_vcsi();

    if (!vcsi_path) throw new Error("Failed to find vcsi");

    const output = await execSimple(vcsi_path, [
        video_filename,
        "-t", // show timestamp for each frame
        "-w", (width || 1920).toString(),
        "-g", grid || "3x5",
        "-o", output_image,
    ], "vcsi video contact sheet");

    if (output && fs.existsSync(output_image) && fs.statSync(output_image).size > 0) {
        log(LOGLEVEL.SUCCESS, "helper.videoContactSheet", `Created video contact sheet for ${video_filename}`);
        return true;
    }

    log(LOGLEVEL.ERROR, "helper.videoContactSheet", `Failed to create video contact sheet for ${video_filename}`);

    throw new Error("No output from vcsi");

}