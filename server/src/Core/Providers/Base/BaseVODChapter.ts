import type { VODTypes } from "@/Core/LiveStreamDVR";
import { LiveStreamDVR } from "@/Core/LiveStreamDVR";
import { LOGLEVEL, log } from "@/Core/Log";
import type { BaseVODChapterJSON } from "@/Storage/JSON";
import type { ApiVodBaseChapter } from "@common/Api/Client";
import type { Providers } from "@common/Defs";

export class BaseVODChapter {
    public provider: Providers = "base";

    /**
     * Started at date, offset and duration are calculated from this.
     */
    public started_at!: Date;

    public offset?: number;
    public duration?: number;

    public title = "";

    /**
     * Was it added when the channel was online?
     */
    public online = false;

    public declare vod_uuid: string;

    public calculateDurationAndOffset(
        vod_started_at: Date,
        vod_ended_at: Date | undefined,
        next_chapter_started_at: Date | undefined
    ): void {
        if (vod_started_at.getTime() > this.started_at.getTime()) {
            // this chapter started before the vod started

            const started_at = vod_started_at;

            if (next_chapter_started_at) {
                this.duration =
                    (next_chapter_started_at.getTime() - started_at.getTime()) /
                    1000;
            } else if (vod_ended_at) {
                this.duration =
                    (vod_ended_at.getTime() - started_at.getTime()) / 1000;
            } else {
                log(
                    LOGLEVEL.WARNING,
                    "chapter.calculateDurationAndOffset",
                    `No next chapter or vod end time for chapter ${
                        this.title
                    } (${this.started_at.toISOString()}), duration will probably be 0.`
                );
            }

            this.offset = 0;
        } else {
            if (next_chapter_started_at) {
                this.duration =
                    (next_chapter_started_at.getTime() -
                        this.started_at.getTime()) /
                    1000;
            } else if (vod_ended_at) {
                this.duration =
                    (vod_ended_at.getTime() - this.started_at.getTime()) / 1000;
            } else {
                log(
                    LOGLEVEL.WARNING,
                    "chapter.calculateDurationAndOffset",
                    `No next chapter or vod end time for chapter ${
                        this.title
                    } (${this.started_at.toISOString()}), duration will probably be 0.`
                );
            }

            this.offset =
                (this.started_at.getTime() - vod_started_at.getTime()) / 1000;
        }

        // console.debug(`Calculated duration and offset for chapter: ${this.title}`, this.offset, this.duration);
    }

    public toAPI(): ApiVodBaseChapter {
        return {
            title: this.title,

            // game_id: "",
            // box_art_url: "",
            // game_name: "",

            // game: undefined,

            offset: this.offset || 0,
            duration: this.duration || 0,

            started_at: this.started_at.toISOString(),

            // viewer_count: this.viewer_count,
            // is_mature: false,
        };
    }

    public toJSON(): BaseVODChapterJSON {
        return {
            started_at: this.started_at.toISOString(),
            // game_id: this.game_id ?? undefined,
            // game_name: this.game_name ?? undefined,
            title: this.title,
            // is_mature: this.is_mature,
            online: this.online, // ?
            // viewer_count: this.viewer_count ?? undefined,
            // offset: this.offset,
            // duration: this.duration,
            // box_art_url: this.box_art_url ?? undefined,
        };
    }

    public getVOD<T extends VODTypes>(): T {
        const vod = LiveStreamDVR.getInstance().getVodByUUID<T>(this.vod_uuid);
        if (!vod) throw new Error("no vod for chapter");
        return vod;
    }
}
