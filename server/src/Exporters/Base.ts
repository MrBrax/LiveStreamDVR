
import { format } from "date-fns";
import fs from "node:fs";
import path from "node:path";
import { formatString } from "@common/Format";
import { ExporterFilenameTemplate } from "@common/Replacements";
import { VODTypes } from "../Core/LiveStreamDVR";
import { log, LOGLEVEL } from "../Core/Log";
import { isTwitchVOD } from "../Helpers/Types";
import { Config } from "../Core/Config";

export class BaseExporter {

    public type = "Base";

    public vod?: VODTypes;
    public filename = "";
    public template_filename = "";
    public output_filename = "";
    public extension = "";

    public supportsDirectories = false;
    public directoryMode = false;

    setDirectoryMode(state: boolean) {
        if (!this.supportsDirectories) return;
        this.directoryMode = state;
    }

    loadVOD(vod: VODTypes): boolean {
        if (!vod.filename) throw new Error("No filename");
        if (!vod.segments || vod.segments.length == 0) throw new Error("No segments");
        if (vod.segments[0].filename) {
            if (!fs.existsSync(vod.segments[0].filename)) throw new Error("Segment file does not exist");
            this.filename = vod.segments[0].filename;
            this.extension = path.extname(this.filename).substring(1);
            this.vod = vod;
            return true;
        } else {
            throw new Error("No segment filename");
        }
    }

    loadFile(filename: string): boolean {
        if (!filename) throw new Error("No filename");
        if (!fs.existsSync(filename)) throw new Error("File does not exist");
        this.filename = filename;
        this.extension = path.extname(this.filename).substring(1);
        return true;
    }

    setTemplate(template_filename: string): void {
        this.template_filename = template_filename;
    }

    setOutputFilename(filename: string): void {
        this.output_filename = filename;
    }

    setSource(source: "segment" | "downloaded" | "burned"): void {
        if (!this.vod) throw new Error("No vod loaded for setSource");
        if (source == "segment") {
            if (!this.vod.segments || this.vod.segments.length == 0 || !this.vod.segments[0].filename) throw new Error("No segments loaded");
            this.filename = this.vod.segments[0].filename;
        } else if (source == "downloaded") {
            if (!this.vod.is_vod_downloaded) throw new Error("VOD not downloaded");
            this.filename = this.vod.path_downloaded_vod;
        } else if (source == "burned") {
            if (!this.vod.is_chat_burned) throw new Error("VOD not burned");
            this.filename = this.vod.path_chatburn;
        } else {
            throw new Error("Invalid source");
        }
    }

    getFormattedTitle() {
        if (this.output_filename !== "") {
            return this.output_filename; // override
        }
        if (!this.vod) {
            return this.template_filename; // no vod loaded, return template filename instead
        }
        if (!this.vod.video_metadata) throw new Error("No video_metadata");
        if (!this.vod.started_at) throw new Error("No started_at");

        let title = "Title";
        if (isTwitchVOD(this.vod) && this.vod.twitch_vod_title) title = this.vod.twitch_vod_title;
        if (this.vod.chapters[0]) title = this.vod.chapters[0].title;

        const replacements: ExporterFilenameTemplate = {
            login: this.vod.getChannel().internalName,
            internalName: this.vod.getChannel().internalName,
            displayName: this.vod.getChannel().displayName,
            title: title,
            date: format(this.vod.started_at, Config.getInstance().dateFormat),
            year: this.vod.started_at ? format(this.vod.started_at, "yyyy") : "",
            month: this.vod.started_at ? format(this.vod.started_at, "MM") : "", 
            day: this.vod.started_at ? format(this.vod.started_at, "dd") : "", 
            comment: this.vod.comment || "",
            
            stream_number: this.vod.stream_number ? this.vod.stream_number.toString() : "", // deprecated
            episode: this.vod.stream_number?.toString() || "",
            absolute_episode: this.vod.stream_absolute_number?.toString() || "",
            season: this.vod.stream_season?.toString() || "",
            absolute_season: this.vod.stream_absolute_season?.toString() || "",
            
            resolution: "",
            id: this.vod.capture_id,
        };

        for (const literal in replacements) {
            if (replacements[literal] === undefined || replacements[literal] === null || replacements[literal] === "") {
                log(LOGLEVEL.WARNING, "BaseExporter", `No value for replacement literal '${literal}', using template '${this.template_filename}'`);
            }
        }

        if (this.vod.video_metadata.type == "video") {
            replacements.resolution = `${this.vod.video_metadata.height}p`;
        }

        return formatString(this.template_filename, replacements);
    }

    async export(): Promise<boolean | string> {
        throw new Error("Export not implemented");
    }

    async verify(): Promise<boolean> {
        throw new Error("Verification not implemented");
    }

}