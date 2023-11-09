import { useStore } from "../../../store";
import { BaseVODSegment } from "../Base/BaseVODSegment";
import BaseVOD from "../Base/BaseVOD";
import { BaseVODChapter } from "../Base/BaseVODChapter";
import YouTubeChannel from "./YouTubeChannel";
import type { ApiYouTubeVod } from "@common/Api/Client";
import { humanDuration } from "@/mixins/newhelpers";

// const store = useStore();

export default class YouTubeVOD extends BaseVOD {
    readonly provider = "youtube";
    segments: BaseVODSegment[] = [];
    chapters: BaseVODChapter[] = [];
    // bookmarks: TwitchVODBookmark[] = [];

    public static makeFromApiResponse(apiResponse: ApiYouTubeVod): YouTubeVOD {

        const baseVod = BaseVOD.makeFromApiResponse(apiResponse);
        const vod = new YouTubeVOD();
        Object.assign(vod, baseVod);

        vod.chapters = apiResponse.chapters.map((chap) => BaseVODChapter.makeFromApiResponse(chap));
        return vod;
    }

    public getWebhookDuration(): string | undefined {
        if (this.started_at && this.ended_at) {
            // format is H:i:s
            const diff_seconds = (this.ended_at.getTime() - this.started_at.getTime()) / 1000;
            return humanDuration(diff_seconds);
        } else {
            return undefined;
        }
    }

    public getDurationLive(): number | false {
        if (!this.started_at) return false;
        const now = new Date();
        return Math.abs((this.started_at.getTime() - now.getTime()) / 1000);
    }

    public getChannel(): YouTubeChannel {
        const store = useStore();
        const streamer = store.streamerList.find<YouTubeChannel>(
            (streamer): streamer is YouTubeChannel => streamer instanceof YouTubeChannel && streamer.uuid == this.channel_uuid,
        );
        if (!streamer) {
            throw new Error("No streamer for vod");
        }
        return streamer;
    }

    get current_chapter(): BaseVODChapter | undefined {
        if (this.chapters.length > 0) {
            return this.chapters[this.chapters.length - 1];
        } else {
            return undefined;
        }
    }
}
