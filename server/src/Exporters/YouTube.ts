import { BaseExporter } from "./Base";
// import { google } from "googleapis"; // FIXME: don't import the whole module
import { youtube_v3 } from "@googleapis/youtube";
import { YouTubeHelper } from "../Providers/YouTube";
import fs from "node:fs";
import { LOGLEVEL, log } from "../Core/Log";
import { Job } from "../Core/Job";
import { Config } from "../Core/Config";
import path from "node:path";
import { xTimeout } from "../Helpers/Timeout";

export class YouTubeExporter extends BaseExporter {

    public type = "YouTube";

    public video_id = "";

    public description = "";
    public tags: string[] = [];
    public category = "";
    public privacy: "private" | "unlisted" | "public" = "private";

    public playlist_id = "";

    setDescription(description: string): void {
        this.description = description;
    }

    setTags(tags: string[]): void {
        this.tags = tags;
    }

    setCategory(category: string): void {
        this.category = category;
    }

    setPrivacy(value: "private" | "unlisted" | "public"): void {
        this.privacy = value;
    }

    setPlaylist(playlist_id: string): void {
        this.playlist_id = playlist_id;
    }

    async export(): Promise<boolean | string> {
        // if (!this.vod) throw new Error("No VOD loaded for export");
        if (!this.filename) throw new Error("No filename");
        if (!this.template_filename) throw new Error("No template filename");
        if (!this.extension) throw new Error("No extension");
        // if (!this.vod.started_at) throw new Error("No started_at");
        // if (!this.vod.video_metadata) throw new Error("No video_metadata");
        if (!YouTubeHelper.oAuth2Client) throw new Error("No YouTube client");

        const final_title = this.getFormattedTitle();

        // const service = google.youtube("v3");
        const service = new youtube_v3.Youtube({
            auth: YouTubeHelper.oAuth2Client,
        });

        log(LOGLEVEL.INFO, "YouTubeExporter", `Uploading ${this.filename} to YouTube...`);

        const job = Job.create(`YouTubeExporter_${path.basename(this.filename)}`);
        job.dummy = true;
        job.save();
        job.broadcastUpdate(); // manual send

        const totalSize = fs.statSync(this.filename).size;
        let uploadSupportCheck = false;

        xTimeout(() => {
            if (!uploadSupportCheck) {
                log(LOGLEVEL.WARNING, "YouTubeExporter", "Upload support check timed out, progress will not be shown.");
            }
        }, 5000);

        let response;
        try {
            response = await service.videos.insert({
                // auth: YouTubeHelper.oAuth2Client,
                part: ["snippet", "status"],
                requestBody: {
                    snippet: {
                        title: final_title,
                        description: this.description,
                        tags: this.tags,
                        categoryId: this.category,
                    },
                    status: {
                        privacyStatus: this.privacy,
                    },
                },
                media: {
                    body: fs.createReadStream(this.filename),
                    // body: fs.createReadStream("C:\\temp\\test.mp4"),
                },
            },
            {
                // this is apparently deprecated
                onUploadProgress: (event) => {
                    job.setProgress(event.bytesRead / totalSize);
                    uploadSupportCheck = true;
                },
            });
        } catch (error) {
            log(LOGLEVEL.ERROR, "YouTube", `Could not upload video: ${(error as Error).message}`, error);
            job.clear();
            throw error;
        }

        if (response) {
            log(LOGLEVEL.SUCCESS, "YouTube", `Video uploaded: ${response.data.id}`);
            this.video_id = response.data.id || "";
            if (response.data.id) {
                if (this.vod) this.vod.exportData.youtube_id = response.data.id;

                let playlist_success;
                try {
                    playlist_success = await this.addToPlaylist(response.data.id, this.playlist_id);
                } catch (error) {
                    log(LOGLEVEL.ERROR, "YouTube", `Could not add video to playlist: ${(error as Error).message}`, error);
                    job.clear();
                    throw error;
                }

                if (this.vod) this.vod.exportData.youtube_playlist_id = this.playlist_id;

                if (playlist_success) {
                    log(LOGLEVEL.SUCCESS, "YouTube", `Video '${this.video_id}' added to playlist '${this.playlist_id}'.`);
                } else {
                    log(LOGLEVEL.WARNING, "YouTube", `Video '${this.video_id}' not added to playlist.`);
                }

                job.clear();
                return this.video_id;
            } else {
                job.clear();
                log(LOGLEVEL.ERROR, "YouTube", "Could not upload video, no ID gotten.", response);
                throw new Error("Could not upload video");
            }
        }

        log(LOGLEVEL.ERROR, "YouTube", "Could not upload video, no response gotten.");

        return false;

    }

    async verify(): Promise<boolean> {
        // if (!this.vod) throw new Error("No VOD loaded for verify");
        if (!this.filename) throw new Error("No filename");
        if (!this.template_filename) throw new Error("No template filename");
        if (!this.extension) throw new Error("No extension");
        // if (!this.vod.started_at) throw new Error("No started_at");
        // if (!this.vod.video_metadata) throw new Error("No video_metadata");
        if (!YouTubeHelper.oAuth2Client) throw new Error("No YouTube client");

        const service = new youtube_v3.Youtube({
            auth: YouTubeHelper.oAuth2Client,
        });

        // const service = google.youtube("v3");

        log(LOGLEVEL.INFO, "YouTubeExporter", `Verifying ${this.filename} on YouTube...`);

        let response;
        try {
            response = await service.videos.list({
                // auth: YouTubeHelper.oAuth2Client,
                part: ["snippet", "status"],
                id: [this.video_id],
            });
        } catch (error) {
            log(LOGLEVEL.ERROR, "YouTube", `Could not verify video: ${(error as Error).message}`, error);
            throw error;
        }

        if (response && response.data && response.data.items && response.data.items.length > 0) {
            const item = response.data.items[0];
            if (item.status?.uploadStatus === "processed" || item.status?.uploadStatus === "uploaded") {
                log(LOGLEVEL.SUCCESS, "YouTube", `Video verified: ${this.video_id}`);
                return true;
            } else if (item.status?.uploadStatus === "rejected") {
                log(LOGLEVEL.ERROR, "YouTube", `Video rejected: ${this.video_id}`);
                return false;
            } else if (item.status?.uploadStatus === "failed") {
                log(LOGLEVEL.ERROR, "YouTube", `Video failed: ${this.video_id}`);
                return false;
            } else {
                log(LOGLEVEL.ERROR, "YouTube", `Video status unknown: ${this.video_id} - ${item.status?.uploadStatus}`);
                return false;
            }
        }

        log(LOGLEVEL.ERROR, "YouTube", "Could not verify video, no response gotten.", response);

        return false;

    }

    async addToPlaylist(video_id: string, playlist_id: string): Promise<boolean> {

        if (!YouTubeHelper.oAuth2Client) throw new Error("No YouTube client");

        const service = new youtube_v3.Youtube({
            auth: YouTubeHelper.oAuth2Client,
        });

        log(LOGLEVEL.INFO, "YouTubeExporter", `Adding ${video_id} to playlist...`);

        if (this.playlist_id == "") {
            const raw_playlist_config = Config.getInstance().cfg<string>("exporter.youtube.playlists");
            if (raw_playlist_config) {
                const raw_playlist_entries = raw_playlist_config.split(";");
                const playlist_entries = raw_playlist_entries.map((entry) => {
                    const parts = entry.split("=");
                    return {
                        channel: parts[0],
                        playlist: parts[1],
                    };
                });

                const playlist_entry = playlist_entries.find((entry) => entry.channel == this.vod?.getChannel().internalName);

                if (playlist_entry) {
                    this.playlist_id = playlist_entry.playlist;
                    log(LOGLEVEL.INFO, "YouTubeExporter", `Found playlist ${this.playlist_id} for channel ${this.vod?.getChannel().internalName}`);
                } else {
                    log(LOGLEVEL.ERROR, "YouTubeExporter", `No playlist configured for channel ${this.vod?.getChannel().internalName}`);
                    return false;
                }
            } else {
                log(LOGLEVEL.ERROR, "YouTubeExporter", "No playlists configured");
                return false;
            }
        }

        if (this.playlist_id == "") {
            log(LOGLEVEL.WARNING, "YouTubeExporter", "No playlist configured");
            return false;
        }

        let response;
        try {
            response = await service.playlistItems.insert({
                // auth: YouTubeHelper.oAuth2Client,
                part: ["snippet"],
                requestBody: {
                    snippet: {
                        playlistId: playlist_id,
                        resourceId: {
                            kind: "youtube#video",
                            videoId: video_id,
                        },
                    },
                },
            });
        } catch (error) {
            log(LOGLEVEL.ERROR, "YouTube", `Could not add video to playlist: ${(error as Error).message}`, error);
            throw error;
        }

        if (response) {
            log(LOGLEVEL.SUCCESS, "YouTube", "Video added to playlist", response.data);
            return true;
        } else {
            log(LOGLEVEL.ERROR, "YouTube", "Could not add video to playlist, no response gotten.");
            return false;
        }

    }
}