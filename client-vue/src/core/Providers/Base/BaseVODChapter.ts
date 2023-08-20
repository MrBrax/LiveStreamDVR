import type { ApiVodBaseChapter } from "@common/Api/Client";

export class BaseVODChapter {
    // public raw_chapter: TwitchVODChapterJSON | undefined;

    /**
     * Started at date, offset and duration are calculated from this.
     */
    public started_at!: Date;

    public offset?: number;
    public duration?: number;

    // public game_id?: string;
    // public game?: TwitchGame;

    public title = "";

    // public is_mature = false;

    /**
     * Twitch does not include viewer count in the EventSub response,
     * so it has to be fetched from the GetStreams endpoint.
     */
    public viewer_count?: number;

    /**
     * Was it added when the channel was online?
     */
    public online = false;

    public static makeFromApiResponse(apiResponse: ApiVodBaseChapter): BaseVODChapter {
        const chapter = new BaseVODChapter();
        chapter.started_at = new Date(apiResponse.started_at);
        chapter.offset = apiResponse.offset;
        chapter.duration = apiResponse.duration;
        // chapter.strings = apiResponse.strings;
        // chapter.game_id = apiResponse.game_id;
        chapter.title = apiResponse.title;
        // chapter.is_mature = apiResponse.is_mature;
        // chapter.viewer_count = apiResponse.viewer_count;
        // chapter.game = apiResponse.game ? TwitchGame.makeFromApiResponse(apiResponse.game) : undefined;
        // chapter.online = apiResponse.online;
        return chapter;
    }

    public getBoxArtUrl(width = 140, height = 190): string {
        return "";
    }

    get game_name(): string {
        return "";
    }

    // formatted
    get box_art_url(): string {
        return this.getBoxArtUrl();
    }

    get image_url(): string {
        return this.box_art_url;
    }
}
