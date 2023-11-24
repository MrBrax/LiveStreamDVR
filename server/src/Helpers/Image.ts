import { BaseConfigCacheFolder } from "@/Core/BaseConfig";
import { Config } from "@/Core/Config";
import { Helper } from "@/Core/Helper";
import { LOGLEVEL, log } from "@/Core/Log";
import { createHash } from "crypto";
import fs from "node:fs";
import path from "node:path";
import type { ExecReturn } from "./Execute";
import { execSimple } from "./Execute";

export async function imageThumbnail(
    filename: string,
    width: number
): Promise<string> {
    log(LOGLEVEL.INFO, "helper.imageThumbnail", `Run thumbnail on ${filename}`);

    if (!filename) {
        throw new Error("No filename supplied for thumbnail");
    }

    if (!fs.existsSync(filename)) {
        log(
            LOGLEVEL.ERROR,
            "helper.imageThumbnail",
            `File not found for image thumbnail: ${filename}`
        );
        throw new Error(`File not found for image thumbnail: ${filename}`);
    }

    if (fs.statSync(filename).size == 0) {
        log(
            LOGLEVEL.ERROR,
            "helper.imageThumbnail",
            `Filesize is 0 for image thumbnail: ${filename}`
        );
        throw new Error(`Filesize is 0 for image thumbnail: ${filename}`);
    }

    // const filenameHash = createHash("md5").update(filename + width).digest("hex");
    const fileHash = createHash("md5")
        .update(fs.readFileSync(filename))
        .digest("hex");

    const thumbnailFormat = Config.getInstance().cfg<string>(
        "thumbnail_format",
        "jpg"
    );

    const outputImage = path.join(
        BaseConfigCacheFolder.public_cache_thumbs,
        `${fileHash}.${thumbnailFormat}`
    );

    if (fs.existsSync(outputImage) && fs.statSync(outputImage).size > 0) {
        log(
            LOGLEVEL.DEBUG,
            "helper.imageThumbnail",
            `Found existing thumbnail for ${filename}`
        );
        return path.basename(outputImage);
    }

    if (fs.existsSync(outputImage) && fs.statSync(outputImage).size === 0) {
        // console.debug("Existing thumbnail filesize is 0, removing file");
        log(
            LOGLEVEL.DEBUG,
            "helper.imageThumbnail",
            `Existing thumbnail filesize is 0, removing file: ${outputImage}`
        );
        fs.unlinkSync(outputImage); // remove empty file
    }

    const ffmpegPath = Helper.path_ffmpeg();
    if (!ffmpegPath) throw new Error("Failed to find ffmpeg");

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
        output = await execSimple(
            ffmpegPath,
            [
                "-i",
                filename,
                "-vf",
                `scale=${width}:-1`,
                // "-codec", codec,
                outputImage,
            ],
            "ffmpeg image thumbnail"
        );
    } catch (error) {
        log(
            LOGLEVEL.ERROR,
            "helper.imageThumbnail",
            `Failed to create thumbnail: ${(error as Error).message}`,
            error
        );
        throw error;
    }

    if (
        (output.stderr.join("") + output.stdout.join("")).includes(
            "Default encoder for format"
        )
    ) {
        throw new Error("Unsupported codec for image thumbnail");
    }

    if (
        output &&
        fs.existsSync(outputImage) &&
        fs.statSync(outputImage).size > 0
    ) {
        return path.basename(outputImage);
    } else {
        log(
            LOGLEVEL.ERROR,
            "helper.imageThumbnail",
            `Failed to create thumbnail for ${filename}`,
            output
        );
        throw new Error("No output from ffmpeg");
    }
}
