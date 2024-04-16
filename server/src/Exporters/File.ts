import { Config } from "@/Core/Config";
import { Job } from "@/Core/Job";
import { log, LOGLEVEL } from "@/Core/Log";
import { xClearInterval, xInterval } from "@/Helpers/Timeout";
import { isTwitchVOD } from "@/Helpers/Types";
import { formatString } from "@common/Format";
import type { ExporterFilenameTemplate } from "@common/Replacements";
import { format } from "date-fns";
import fs from "node:fs";
import path from "node:path";
import sanitize from "sanitize-filename";
import { BaseExporter } from "./Base";

/**
 * Basic file exporter to copy the VOD to a directory on the local filesystem.
 */
export class FileExporter extends BaseExporter {
    public type = "File";
    public directory = "";
    public supportsDirectories = true;
    private final_path = "";

    public setDirectory(directory: string): void {
        if (!directory) throw new Error("No directory");
        this.directory = directory;
    }

    public override async export(): Promise<boolean | string> {
        if (!this.filename) throw new Error("No filename");
        if (!this.extension) throw new Error("No extension");
        if (!this.getFormattedTitle()) throw new Error("No title");

        const finalFilename =
            sanitize(this.getFormattedTitle()) + "." + this.extension;

        this.final_path = path.join(
            this.getFormattedDirectory(),
            finalFilename
        );

        if (fs.existsSync(this.final_path)) {
            throw new Error(`File already exists: ${this.final_path}`);
        }

        log(
            LOGLEVEL.INFO,
            "FileExporter.export",
            `Exporting ${this.filename} to ${this.final_path}...`
        );

        const job = Job.create(
            `FileExporter_${path.basename(this.final_path)}`
        );
        job.dummy = true;
        job.save();

        const filesize = fs.statSync(this.filename).size;

        const ticker = xInterval(() => {
            if (!fs.existsSync(this.final_path)) return;
            if (!job) {
                xClearInterval(ticker);
                return;
            }
            job.setProgress(fs.statSync(this.final_path).size / filesize);
            // hope there won't be any leaks...
        }, 5000);

        await fs.promises.copyFile(this.filename, this.final_path);

        job.clear();

        xClearInterval(ticker);

        return fs.existsSync(this.final_path) ? this.final_path : false;
    }

    public override async verify(): Promise<boolean> {
        return await new Promise<boolean>((resolve, reject) => {
            // resolve(fs.existsSync(this.final_path));
            fs.access(this.final_path, fs.constants.F_OK, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(true);
                }
            });
        });
    }

    public getFormattedDirectory() {
        if (!this.vod) {
            return this.directory; // no vod loaded, return directory instead
        }
        if (!this.vod.video_metadata) throw new Error("No video_metadata");
        if (!this.vod.started_at) throw new Error("No started_at");

        let title = "Title";
        // TODO: why is this done here?
        if (isTwitchVOD(this.vod) && this.vod.external_vod_title)
            title = this.vod.external_vod_title;
        if (this.vod.chapters[0]) title = this.vod.chapters[0].title;

        const replacements: ExporterFilenameTemplate = {
            login: this.vod.getChannel().internalName,
            internalName: this.vod.getChannel().internalName,
            displayName: this.vod.getChannel().displayName,
            title: title,
            date: format(this.vod.started_at, Config.getInstance().dateFormat),
            year: this.vod.started_at
                ? format(this.vod.started_at, "yyyy")
                : "",
            month: this.vod.started_at ? format(this.vod.started_at, "MM") : "",
            day: this.vod.started_at ? format(this.vod.started_at, "dd") : "",
            comment: this.vod.comment || "",

            stream_number: this.vod.stream_number
                ? this.vod.stream_number.toString()
                : "", // deprecated
            episode: this.vod.stream_number?.toString() || "",
            absolute_episode: this.vod.stream_absolute_number?.toString() || "",
            season: this.vod.stream_season?.toString() || "",
            absolute_season: this.vod.stream_absolute_season?.toString() || "",

            resolution: "",
            id: this.vod.capture_id,
        };

        for (const literal in replacements) {
            if (
                replacements[literal] === undefined ||
                replacements[literal] === null ||
                replacements[literal] === ""
            ) {
                log(
                    LOGLEVEL.WARNING,
                    "BaseExporter.getFormattedTitle",
                    `No value for replacement literal '${literal}', using template '${this.template_filename}'`
                );
            }
        }

        if (this.vod.video_metadata.type == "video") {
            replacements.resolution = `${this.vod.video_metadata.height}p`;
        }

        return formatString(this.directory, replacements);
    }
}
