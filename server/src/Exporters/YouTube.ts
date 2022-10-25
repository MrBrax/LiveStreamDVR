import { BaseExporter } from "./Base";
// import { google } from "googleapis"; // FIXME: don't import the whole module
import { youtube_v3 } from "@googleapis/youtube";
import { YouTubeHelper } from "../Providers/YouTube";
import fs from "node:fs";
import { Log } from "../Core/Log";
import { Job } from "../Core/Job";
import { Config } from "../Core/Config";
import path from "node:path";

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

        if (!this.vod) throw new Error("No VOD loaded");
        if (!this.filename) throw new Error("No filename");
        if (!this.template_filename) throw new Error("No template filename");
        if (!this.extension) throw new Error("No extension");
        if (!this.vod.started_at) throw new Error("No started_at");
        if (!this.vod.video_metadata) throw new Error("No video_metadata");
        if (!YouTubeHelper.oAuth2Client) throw new Error("No YouTube client");

        const final_title = this.getFormattedTitle();

        // const service = google.youtube("v3");
        const service = new youtube_v3.Youtube({
            auth: YouTubeHelper.oAuth2Client,
        });

        Log.logAdvanced(Log.Level.INFO, "YouTubeExporter", `Uploading ${this.filename} to YouTube...`);

        const job = Job.create(`YouTubeExporter_${path.basename(this.filename)}`);
        job.dummy = true;
        job.save();

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
            });
        } catch (error) {
            Log.logAdvanced(Log.Level.ERROR, "YouTube", `Could not upload video: ${(error as Error).message}`, error);
            job.clear();
            throw error;
        }

        if (response) {
            Log.logAdvanced(Log.Level.SUCCESS, "YouTube", `Video uploaded: ${response.data.id}`);
            this.video_id = response.data.id || "";
            if (response.data.id && this.playlist_id) {
                if (this.vod) this.vod.exportData.youtube_id = response.data.id;
                let success;
                try {
                    success = this.addToPlaylist(response.data.id, this.playlist_id);
                } catch (error) {
                    Log.logAdvanced(Log.Level.ERROR, "YouTube", `Could not add video to playlist: ${(error as Error).message}`, error);
                    job.clear();
                    throw error;
                }

                if (this.vod) this.vod.exportData.youtube_playlist_id = this.playlist_id;
                Log.logAdvanced(Log.Level.SUCCESS, "YouTube", `Video added to playlist: ${success}`);
                job.clear();
                return this.video_id;
            } else if (response.data.id) {
                job.clear();
                if (this.vod) this.vod.exportData.youtube_id = response.data.id;
                Log.logAdvanced(Log.Level.SUCCESS, "YouTube", `Video uploaded, no playlist: ${response.data.id}`);
                return this.video_id;
            } else {
                job.clear();
                Log.logAdvanced(Log.Level.ERROR, "YouTube", "Could not upload video, no ID gotten.", response);
                throw new Error("Could not upload video");
            }
        }

        Log.logAdvanced(Log.Level.ERROR, "YouTube", "Could not upload video, no response gotten.");

        return false;

    }

    async verify(): Promise<boolean> {
        
        if (!this.vod) throw new Error("No VOD loaded");
        if (!this.filename) throw new Error("No filename");
        if (!this.template_filename) throw new Error("No template filename");
        if (!this.extension) throw new Error("No extension");
        if (!this.vod.started_at) throw new Error("No started_at");
        if (!this.vod.video_metadata) throw new Error("No video_metadata");
        if (!YouTubeHelper.oAuth2Client) throw new Error("No YouTube client");

        const service = new youtube_v3.Youtube({
            auth: YouTubeHelper.oAuth2Client,
        });

        // const service = google.youtube("v3");

        Log.logAdvanced(Log.Level.INFO, "YouTubeExporter", `Verifying ${this.filename} on YouTube...`);

        let response;
        try {
            response = await service.videos.list({
                // auth: YouTubeHelper.oAuth2Client,
                part: ["snippet"],
                id: [this.video_id],
            });
        } catch (error) {
            Log.logAdvanced(Log.Level.ERROR, "YouTube", `Could not verify video: ${(error as Error).message}`, error);
            throw error;
        }
        
        Log.logAdvanced(Log.Level.SUCCESS, "YouTube", "Video verified", response.data.items);
        
        return true;            

    }

    async addToPlaylist(video_id: string, playlist_id: string): Promise<boolean> {

        if (!YouTubeHelper.oAuth2Client) throw new Error("No YouTube client");

        const service = new youtube_v3.Youtube({
            auth: YouTubeHelper.oAuth2Client,
        });

        Log.logAdvanced(Log.Level.INFO, "YouTubeExporter", `Adding ${video_id} to playlist...`);

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
                    Log.logAdvanced(Log.Level.INFO, "YouTubeExporter", `Found playlist ${this.playlist_id} for channel ${this.vod?.getChannel().internalName}`);
                } else {
                    Log.logAdvanced(Log.Level.ERROR, "YouTubeExporter", `No playlist configured for channel ${this.vod?.getChannel().internalName}`);
                    return false;
                }
            } else {
                Log.logAdvanced(Log.Level.ERROR, "YouTubeExporter", "No playlists configured");
                return false;
            }
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
            Log.logAdvanced(Log.Level.ERROR, "YouTube", `Could not add video to playlist: ${(error as Error).message}`, error);
            throw error;
        }

        if (response) {
            Log.logAdvanced(Log.Level.SUCCESS, "YouTube", "Video added to playlist", response.data);
            return true;
        } else {
            Log.logAdvanced(Log.Level.ERROR, "YouTube", "Could not add video to playlist, no response gotten.");
            return false;
        }

    }
}