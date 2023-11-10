import { useStore } from "../../../store";
import { MuteStatus } from "../../../../../common/Defs";
import type TwitchChannel from "./TwitchChannel";
import { TwitchVODChapter } from "./TwitchVODChapter";
// import { useStore } from "../store";
import type { TwitchGame } from "./TwitchGame";
import { BaseVODSegment } from "../Base/BaseVODSegment";
import type { VODBookmark } from "@common/Bookmark";
import BaseVOD from "../Base/BaseVOD";
import type { ApiTwitchVod } from "@common/Api/Client";
import { humanDuration } from "@/mixins/newhelpers";

// const store = useStore();

export default class TwitchVOD extends BaseVOD {
    readonly provider = "twitch";
    // segments: BaseVODSegment[] = [];
    chapters: TwitchVODChapter[] = [];
    bookmarks: VODBookmark[] = [];

    // twitch_vod_id: string | undefined;
    // twitch_vod_duration: number | undefined;
    // twitch_vod_exists: boolean | undefined;
    // twitch_vod_date: Date | undefined;
    // twitch_vod_title: string | undefined;
    twitch_vod_muted: MuteStatus | undefined = MuteStatus.UNKNOWN;

    stream_resolution: string | undefined = "";
    stream_title = "";

    public static makeFromApiResponse(apiResponse: ApiTwitchVod): TwitchVOD {

        const { provider, ...baseVod } = BaseVOD.makeFromApiResponse(apiResponse); // remove provider from baseVod to avoid overwriting it
        const vod = new TwitchVOD();
        Object.assign(vod, baseVod);

        vod.chapters = apiResponse.chapters.map((chap) => TwitchVODChapter.makeFromApiResponse(chap));
        vod.twitch_vod_muted = apiResponse.twitch_vod_muted;
        vod.stream_resolution = apiResponse.stream_resolution;
        vod.stream_title = apiResponse.stream_title;
        vod.chatDumpStatus = apiResponse.api_getChatDumpStatus;
        vod.bookmarks = apiResponse.bookmarks || [];
        return vod;
    }

    public hasFavouriteGame() {
        return this.chapters.some((chapter) => chapter.game?.isFavourite());
    }

    public getUniqueGames(): TwitchGame[] {
        const games: TwitchGame[] = [];
        this.chapters.forEach((chapter) => {
            if (chapter.game && !games.find((g) => chapter.game?.id == g.id)) games.push(chapter.game);
        });
        return games;
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

    public getChannel(): TwitchChannel {
        const store = useStore();
        const streamer = store.streamerList.find<TwitchChannel>((streamer): streamer is TwitchChannel => streamer.uuid == this.channel_uuid);
        if (!streamer) {
            throw new Error("No streamer for vod");
        }
        return streamer;
    }

    get current_game(): TwitchGame | undefined {
        if (this.chapters.length > 0) {
            return this.chapters[this.chapters.length - 1].game;
        } else {
            return undefined;
        }
    }

    public getTitle() {
        if (this.external_vod_title) {
            return this.external_vod_title;
        }
        if (this.chapters && this.chapters.length > 0) {
            return this.chapters[0].title;
        }
        return this.basename;
    }
}
