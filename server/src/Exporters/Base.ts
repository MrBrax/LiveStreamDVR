import { Config } from "@/Core/Config";
import type { VODTypes } from "@/Core/LiveStreamDVR";
import { log, LOGLEVEL } from "@/Core/Log";
import { isTwitchVOD } from "@/Helpers/Types";
import { formatString } from "@common/Format";
import type { ExporterFilenameTemplate } from "@common/Replacements";
import { format } from "date-fns";
import fs from "node:fs";
import path from "node:path";

export class BaseExporter {
    public type = "Base";

    public vod?: VODTypes;
    public filename = "";
    public template_filename = "";
    public output_filename = "";
    public extension = "";

    public supportsDirectories = false;
    public directoryMode = false;

    public setDirectoryMode(state: boolean) {
        if (!this.supportsDirectories) return;
        this.directoryMode = state;
    }

    /**
     * Loads a VOD and sets the filename, extension, and vod properties.
     * @param vod - The VOD object to load.
     * @param segment - The index of the segment to load (default is 0).
     * @returns True if the VOD is successfully loaded, false otherwise.
     * @throws Error if the VOD has no filename, no segments, the segment file does not exist, or no segment filename.
     */
    public loadVOD(vod: VODTypes, segment = 0): boolean {
        if (!vod.filename) throw new Error("No filename");
        if (!vod.segments || vod.segments.length == 0)
            throw new Error("No segments");
        const seg = vod.segments[segment];
        if (seg.filename) {
            if (!fs.existsSync(seg.filename))
                throw new Error("Segment file does not exist");
            this.filename = seg.filename;
            this.extension = path.extname(this.filename).substring(1);
            this.vod = vod;
            return true;
        } else {
            throw new Error("No segment filename");
        }
    }

    /**
     * Loads a file with the specified filename.
     * @param filename - The name of the file to load.
     * @returns True if the file was successfully loaded, false otherwise.
     * @throws Error if no filename is provided or if the file does not exist.
     */
    public loadFile(filename: string): boolean {
        if (!filename) throw new Error("No filename");
        if (!fs.existsSync(filename)) throw new Error("File does not exist");
        this.filename = filename;
        this.extension = path.extname(this.filename).substring(1);
        return true;
    }

    /**
     * Sets the template filename for the exporter.
     * @param template_filename - The filename of the template.
     * @returns void
     */
    public setTemplate(template_filename: string): void {
        this.template_filename = template_filename;
    }

    public setOutputFilename(filename: string): void {
        this.output_filename = filename;
    }

    public setSource(source: "segment" | "downloaded" | "burned"): void {
        if (!this.vod) throw new Error("No vod loaded for setSource");
        if (source == "segment") {
            if (
                !this.vod.segments ||
                this.vod.segments.length == 0 ||
                !this.vod.segments[0].filename
            )
                throw new Error("No segments loaded");
            this.filename = this.vod.segments[0].filename;
        } else if (source == "downloaded") {
            if (!this.vod.is_vod_downloaded)
                throw new Error("VOD not downloaded");
            this.filename = this.vod.path_downloaded_vod;
        } else if (source == "burned") {
            if (!this.vod.is_chat_burned) throw new Error("VOD not burned");
            this.filename = this.vod.path_chatburn;
        } else {
            throw new Error("Invalid source");
        }
    }

    public getFormattedTitle() {
        if (this.output_filename !== "") {
            return this.output_filename; // override
        }
        if (!this.vod) {
            return this.template_filename; // no vod loaded, return template filename instead
        }
        if (!this.vod.video_metadata) throw new Error("No video_metadata");
        if (!this.vod.started_at) throw new Error("No started_at");

        let title = "Title";
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

        return formatString(this.template_filename, replacements);
    }

    /**
     * Exports the VOD.
     * @returns A promise that resolves to a boolean or a string.
     */
    public async export(): Promise<boolean | string> {
        return await Promise.reject(new Error("Export not implemented"));
    }

    /**
     * Verifies the status of the exported file. This is called after the export is complete.
     * @returns A promise that resolves to a boolean.
     */
    public async verify(): Promise<boolean> {
        return await Promise.reject(new Error("Verification not implemented"));
    }
}
