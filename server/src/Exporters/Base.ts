import { formatString } from "../Helpers/Format";
import path from "path";
import { TwitchVOD } from "../Core/TwitchVOD";
import { format } from "date-fns";

export class BaseExporter {

    public type = "Base";

    public vod?: TwitchVOD;
    public filename = "";
    public template_filename = "";
    public extension = "";

    load(vod: TwitchVOD): boolean {
        if (!vod.filename) return false;
        if (!vod.segments || vod.segments.length == 0) return false;
        if (vod.segments[0].filename) {
            this.filename = vod.segments[0].filename;
            this.extension = path.extname(this.filename).substring(1);
            this.vod = vod;
            return true;
        } else {
            return false;
        }
    }

    setTemplate(template_filename: string): void {
        this.template_filename = template_filename;
    }

    getFormattedTitle() {
        if (!this.vod) throw new Error("No VOD loaded");
        if (!this.vod.video_metadata) throw new Error("No video_metadata");
        if (!this.vod.started_at) throw new Error("No started_at");
        let title = "Title";
        if (this.vod.twitch_vod_title) title = this.vod.twitch_vod_title;
        if (this.vod.chapters[0]) title = this.vod.chapters[0].title;

        const replacements: Record<string, string> = {
            login: this.vod.streamer_login,
            title: title,
            date: format(this.vod.started_at, "yyyy-MM-dd"),
            comment: this.vod.comment || "",
            stream_number: this.vod.stream_number?.toString() || "",
        };

        if (this.vod.video_metadata.type == "video") {
            replacements.resolution = `${this.vod.video_metadata.height}p`;
        }

        return formatString(this.template_filename, replacements);
    }

    async export(): Promise<boolean> {
        throw new Error("Export not implemented");
    }

    async verify(): Promise<boolean> {
        throw new Error("Verification not implemented");
    }

}