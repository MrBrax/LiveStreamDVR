import { parseJSON } from "date-fns";
import { BaseVOD } from "../Base/BaseVOD";
import type { Providers } from "@common/Defs";
import { JobStatus, MuteStatus } from "@common/Defs";
import type { KickVODJSON } from "../../../Storage/JSON";
import type { ApiKickVod } from "@common/Api/Client";

export class KickVOD extends BaseVOD {
    public provider: Providers = "kick";

    json?: KickVODJSON;

    public kick_vod_id? = "";

    /**
     * Set up basic data
     * Requires JSON to be loaded
     */
    public setupBasic(): void {
        if (!this.json) {
            throw new Error("No JSON loaded for basic setup!");
        }

        super.setupBasic();

        this.stream_resolution = this.json.stream_resolution;

        // TODO: what
        // const dur = this.getDurationLive();
        // this.duration_live = dur === false ? -1 : dur;

        this.bookmarks = this.json.bookmarks
            ? this.json.bookmarks.map((b) => {
                  return {
                      name: b.name,
                      date: parseJSON(b.date),
                  };
              })
            : [];
    }

    public async toAPI(): Promise<ApiKickVod> {
        if (!this.uuid) throw new Error(`No UUID set on VOD ${this.basename}`);
        if (!this.channel_uuid)
            throw new Error(`No channel UUID set on VOD ${this.basename}`);
        return {
            provider: "kick",
            uuid: this.uuid,
            channel_uuid: this.channel_uuid,
            basename: this.basename || "",

            // stream_title: this.stream_title,
            // stream_resolution: this.stream_resolution,

            segments: this.segments.map((s) => s.toAPI()),
            segments_raw: this.segments_raw,

            // streamer_name: this.streamer_name || "",
            // streamer_id: this.streamer_id || "",
            // streamer_login: this.streamer_login || "",

            created_at: this.created_at ? this.created_at.toISOString() : "",
            saved_at: this.saved_at ? this.saved_at.toISOString() : "",
            started_at: this.started_at ? this.started_at.toISOString() : "",
            ended_at: this.ended_at ? this.ended_at.toISOString() : undefined,
            capture_started: this.capture_started
                ? this.capture_started.toISOString()
                : undefined,
            capture_started2: this.capture_started2
                ? this.capture_started2.toISOString()
                : undefined,
            conversion_started: this.conversion_started
                ? this.conversion_started.toISOString()
                : undefined,

            capture_id: this.capture_id,

            is_converted: this.is_converted,
            is_capturing: this.is_capturing,
            is_converting: this.is_converting,
            is_finalized: this.is_finalized,

            is_chat_downloaded: this.is_chat_downloaded,
            is_vod_downloaded: this.is_vod_downloaded,
            is_chat_rendered: this.is_chat_rendered,
            is_chat_burned: this.is_chat_burned,
            is_lossless_cut_generated: this.is_lossless_cut_generated,
            is_chatdump_captured: this.is_chatdump_captured,
            is_capture_paused: this.is_capture_paused,

            // api_hasFavouriteGame: this.hasFavouriteGame(),
            // api_getUniqueGames: this.getUniqueGames().map((g) => g.toAPI()),
            // api_getWebhookDuration: this.getWebhookDuration(),
            // // api_getDuration: this.duration, // this.getDuration(),
            // api_getDuration: await this.getDuration(true),
            // api_getCapturingStatus: await this.getCapturingStatus(),
            api_getRecordingSize: this.getRecordingSize(),
            // api_getChatDumpStatus: await this.getChatDumpStatus(),
            // api_getDurationLive: this.getDurationLive(),
            // api_getConvertingStatus: await this.getConvertingStatus(),

            path_chat: this.path_chat,
            path_downloaded_vod: this.path_downloaded_vod,
            path_losslesscut: this.path_losslesscut,
            path_chatrender: this.path_chatrender,
            path_chatburn: this.path_chatburn,
            path_chatdump: this.path_chatdump,
            path_chatmask: this.path_chatmask,
            // path_adbreak: this.path_adbreak,
            path_playlist: this.path_playlist,

            duration_live: this.getDurationLive(),
            duration: this.duration || 0,

            total_size: this.total_size,

            chapters: this.chapters.map((c) => c.toAPI()),
            // chapters_raw: this.chapters_raw,

            webpath: this.webpath,

            video_metadata: this.video_metadata,

            stream_number: this.stream_number,
            stream_season: this.stream_season,
            stream_absolute_season: this.stream_absolute_season,
            stream_absolute_number: this.stream_absolute_number,

            comment: this.comment,

            prevent_deletion: this.prevent_deletion,

            failed: this.failed,

            bookmarks: this.bookmarks,

            cloud_storage: this.cloud_storage,

            export_data: this.exportData,

            viewers: this.viewers.map((v) => {
                return {
                    timestamp: v.timestamp.toISOString(),
                    amount: v.amount,
                };
            }),
            stream_pauses: this.stream_pauses.map((v) => {
                return {
                    start: v.start.toISOString(),
                    end: v.end.toISOString(),
                };
            }),
        };
    }
}
