import { BaseExporter } from "./Base";

export class YouTubeExporter extends BaseExporter {

    public type = "YouTube";

    async export(): Promise<boolean> {
        if (!this.vod) throw new Error("No VOD loaded");
        if (!this.filename) throw new Error("No filename");
        if (!this.template_filename) throw new Error("No template filename");
        if (!this.extension) throw new Error("No extension");
        if (!this.vod.started_at) throw new Error("No started_at");
        if (!this.vod.video_metadata) throw new Error("No video_metadata");

        const final_title = this.getFormattedTitle();


    }
}