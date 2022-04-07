import chalk from "chalk";
import { parseISO } from "date-fns";
import { ApiVodChapter } from "../../../common/Api/Client";
import { TwitchVODChapterJSON } from "../Storage/JSON";
import { TwitchGame } from "./TwitchGame";

/*
export interface TwitchVODChapterJSON {
    /** Date, 2022-02-23T00:47:32Z *
    time: string;
    dt_started_at: PHPDateTimeProxy;
    game_id: string;
    game_name: string;
    title: string;
    is_mature: boolean;
    online: boolean;
    viewer_count: number;
    datetime: PHPDateTimeProxy;
    favourite: boolean;
    offset: number;
    strings: Record<string, string>;
    box_art_url: string;
    duration: number;
    width: number;
}

export interface TwitchVODChapterMinimalJSON {
    /** Date, 2022-02-23T00:47:32Z *
    time: string;
    dt_started_at: PHPDateTimeProxy;
    game_id: string | false;
    game_name: string;
    viewer_count?: number;
    title: string;
    is_mature: boolean;
    online: boolean;
}
*/

/*
'time' 			=> $this->getDateTime(),
                'dt_started_at'	=> new \DateTime(),
                'game_id' 		=> $event["category_id"],
                'game_name'		=> $event["category_name"],
                // 'viewer_count' 	=> $data_viewer_count,
                'title'			=> $event["title"],
                'is_mature'		=> $event["is_mature"],
                'online'		=> false,
                */


export class TwitchVODChapter {

    public raw_chapter: TwitchVODChapterJSON | undefined;

    /**
     * Started at date, offset and duration are calculated from this.
     */
    public started_at!: Date;

    public offset?: number;
    public duration?: number;

    /**
     * @deprecated
     */
    public strings: Record<string, string> = {};

    public game_id?: string;
    public game?: TwitchGame;

    public title = "";

    public is_mature = false;

    /**
     * Twitch does not include viewer count in the EventSub response,
     * so it has to be fetched from the GetStreams endpoint.
     */
    public viewer_count?: number;

    /**
     * Was it added when the channel was online?
     */
    public online = false;

    public toJSON(): TwitchVODChapterJSON {
        return {
            started_at: this.started_at.toISOString(),
            game_id: this.game_id ?? undefined,
            game_name: this.game_name ?? undefined,
            title: this.title,
            is_mature: this.is_mature,
            online: this.online, // ?
            viewer_count: this.viewer_count ?? undefined,
            // offset: this.offset,
            // duration: this.duration,
            box_art_url: this.box_art_url ?? undefined,
        };
    }

    public toAPI(): ApiVodChapter {
        return {
            title: this.title,

            game_id: this.game_id,
            box_art_url: this.box_art_url,
            game_name: this.game_name,

            strings: this.strings,

            offset: this.offset || 0,
            duration: this.duration || 0,

            started_at: this.started_at.toISOString(),

            viewer_count: this.viewer_count,
            is_mature: this.is_mature,
        };
    }

    public hasFavouriteGame(): boolean {
        return this.game !== undefined && this.game.isFavourite();
    }

    static async fromJSON(data: TwitchVODChapterJSON): Promise<TwitchVODChapter> {

        const chapter = new TwitchVODChapter();
        // chapter.box_art_url = data.box_art_url;
        chapter.game_id = data.game_id;
        // chapter.game_name = data.game_name;
        // chapter.duration = data.duration;
        // chapter.offset = data.offset;
        chapter.title = data.title;
        chapter.is_mature = data.is_mature;
        chapter.online = data.online;
        chapter.started_at = parseISO(data.started_at);
        chapter.viewer_count = data.viewer_count;

        if (data.game_id) {
            const game = await TwitchGame.getGameAsync(data.game_id);
            if (game) {
                chapter.game = game;
                // chapter.game_name = game.name;
                // chapter.box_art_url = game.box_art_url;
            } else {
                console.error(`Could not find game data for game_id: ${data.game_id}`);
            }
        } else {
            console.warn(chalk.red(`No game_id for chapter: ${data.title}`), data);
        }

        chapter.raw_chapter = data;

        return chapter;

    }

    public calculateDurationAndOffset(vod_started_at: Date, vod_ended_at: Date | undefined, next_chapter_started_at: Date | undefined): void {

        if (vod_started_at.getTime() > this.started_at.getTime()) { // this chapter started before the vod started

            const started_at = vod_started_at;

            if (next_chapter_started_at) {
                this.duration = (next_chapter_started_at.getTime() - started_at.getTime()) / 1000;
            } else if (vod_ended_at) {
                this.duration = (vod_ended_at.getTime() - started_at.getTime()) / 1000;
            }

            this.offset = 0;

        } else {

            if (next_chapter_started_at) {
                this.duration = (next_chapter_started_at.getTime() - this.started_at.getTime()) / 1000;
            } else if (vod_ended_at) {
                this.duration = (vod_ended_at.getTime() - this.started_at.getTime()) / 1000;
            }

            this.offset = (this.started_at.getTime() - vod_started_at.getTime()) / 1000;

        }

        // console.debug(`Calculated duration and offset for chapter: ${this.title}`, this.offset, this.duration);

    }

    public getBoxArtUrl(width = 140, height = 190): string {
        if (!this.game) return "";
        return this.game.getBoxArtUrl(width, height);
    }

    get game_name(): string {
        return this.game?.name ?? "";
    }

    // formatted
    get box_art_url(): string {
        return this.getBoxArtUrl();
    }

}