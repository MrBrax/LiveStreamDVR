import { BaseExporter } from "./Base";
import { google } from "googleapis";
import { YouTubeHelper } from "../Providers/YouTube";
import fs from "fs";
import { Log, LOGLEVEL } from "Core/Log";

export class YouTubeExporter extends BaseExporter {

    public type = "YouTube";

    public video_id = "";

    public description = "";
    public tags: string[] = [];
    public category = "";

    setDescription(description: string): void {
        this.description = description;
    }

    setTags(tags: string[]): void {
        this.tags = tags;
    }

    setCategory(category: string): void {
        this.category = category;
    }

    export(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            if (!this.vod) throw new Error("No VOD loaded");
            if (!this.filename) throw new Error("No filename");
            if (!this.template_filename) throw new Error("No template filename");
            if (!this.extension) throw new Error("No extension");
            if (!this.vod.started_at) throw new Error("No started_at");
            if (!this.vod.video_metadata) throw new Error("No video_metadata");
            if (!YouTubeHelper.oAuth2Client) throw new Error("No YouTube client");

            const final_title = this.getFormattedTitle();

            const service = google.youtube("v3");

            Log.logAdvanced(LOGLEVEL.INFO, "YouTubeExporter", `Uploading ${this.filename} to YouTube...`);

            service.videos.insert({
                auth: YouTubeHelper.oAuth2Client,
                part: ["snippet", "status"],
                requestBody: {
                    snippet: {
                        title: final_title,
                        description: this.description,
                        tags: this.tags,
                        categoryId: this.category,
                    },
                    status: {
                        privacyStatus: "private",
                    },
                },
                media: {
                    body: fs.createReadStream(this.filename),
                    // body: fs.createReadStream("C:\\temp\\test.mp4"),
                },
            }, (err, response): void => {
                if (err) {
                    Log.logAdvanced(LOGLEVEL.ERROR, "YouTube", `Could not upload video: ${err}`);
                    reject(err);
                    return;
                } else if (response) {
                    Log.logAdvanced(LOGLEVEL.SUCCESS, "YouTube", `Video uploaded: ${response.data.id}`);
                    this.video_id = response.data.id || "";
                    resolve(true);
                }
            });

        });

    }

    verify(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            if (!this.vod) throw new Error("No VOD loaded");
            if (!this.filename) throw new Error("No filename");
            if (!this.template_filename) throw new Error("No template filename");
            if (!this.extension) throw new Error("No extension");
            if (!this.vod.started_at) throw new Error("No started_at");
            if (!this.vod.video_metadata) throw new Error("No video_metadata");
            if (!YouTubeHelper.oAuth2Client) throw new Error("No YouTube client");

            const service = google.youtube("v3");

            Log.logAdvanced(LOGLEVEL.INFO, "YouTubeExporter", `Verifying ${this.filename} on YouTube...`);

            service.videos.list({
                auth: YouTubeHelper.oAuth2Client,
                part: ["snippet"],
                id: [this.video_id],
            }, (err, response): void => {
                if (err) {
                    Log.logAdvanced(LOGLEVEL.ERROR, "YouTube", `Could not verify video: ${err}`);
                    reject(err);
                    return;
                } else if (response) {
                    Log.logAdvanced(LOGLEVEL.SUCCESS, "YouTube", "Video verified", response.data.items);
                    resolve(true);
                }
            });

        });
    }
}