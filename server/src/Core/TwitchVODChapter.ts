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

    raw_chapter: TwitchVODChapterJSON | undefined;

    started_at: Date;

    offset?: number;
    duration?: number;

    strings: Record<string, string> = {};

    game?: TwitchGame;
    game_id?: string;

    /** Do not use for display */
    game_name?: string; // make dynamic

    /** Do not use for display */
    box_art_url?: string; // make dynamic

    title = "";

    is_mature = false;
    // online: boolean | undefined;

    viewer_count?: number;

    online = false;

    // favourite: boolean | undefined;

    /*
    constructor(data: TwitchVODChapterJSON) {

        this.box_art_url = data.box_art_url;
        this.game_id = data.game_id;
        this.game_name = data.game_name;
        // this.duration = data.duration;
        // this.offset = data.offset;
        this.title = data.title;
        this.is_mature = data.is_mature;
        this.online = data.online;
        this.started_at = parseISO(data.started_at);
        this.viewer_count = data.viewer_count;

        if (data.game_id) {
            const game = TwitchGame.getGameDataFromCache(data.game_id);
            if (game) {
                this.game = game;
            } else {
                console.error(`Could not find game data for game_id: ${data.game_id}`);
            }
        } else {
            console.error(chalk.red(`No game_id for chapter: ${data.title}`), data);
        }

        this.raw_chapter = data;

    }
    */

    /*
    getRawChapter(): TwitchVODChapterMinimalJSON {
        if (!this.started_at) throw new Error("Can't get raw chapter: No datetime set");
        // if (!this.game_id) throw new Error("Can't get raw chapter: No game_id set");
        // if (!this.game_name) throw new Error("Can't get raw chapter: No game_name set");
        if (!this.title) throw new Error("Can't get raw chapter: No title set");
        return {
            time: format(this.started_at, TwitchHelper.TWITCH_DATE_FORMAT),
            dt_started_at: TwitchHelper.JSDateToPHPDate(this.started_at),
            game_id: this.game_id || false,
            game_name: this.game_name || "",
            title: this.title,
            is_mature: this.is_mature || false,
            online: this.online || false,
            viewer_count: this.viewer_count ?? undefined,
        };
    }
    */


    toJSON(): TwitchVODChapterJSON {
        return {
            started_at: this.started_at.toISOString(),
            game_id: this.game_id,
            game_name: this.game_name,
            title: this.title,
            is_mature: this.is_mature,
            online: this.online, // ?
            viewer_count: this.viewer_count ?? undefined,
            offset: this.offset,
            duration: this.duration,
            box_art_url: this.box_art_url,
        };
    }

    
    toAPI(): ApiVodChapter {
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

    hasFavouriteGame() {
        return this.game && this.game.isFavourite();
    }

    /*
    let raw_chapter: TwitchVODChapterJSON = {
                title: chapter.title ?? "",
                time: format(chapter.datetime, TwitchHelper.TWITCH_DATE_FORMAT),
                duration: chapter.duration ?? 0,
            };
            `*/

    
    static fromJSON(data: TwitchVODChapterJSON): TwitchVODChapter {

        const chapter = new TwitchVODChapter();
        chapter.box_art_url = data.box_art_url;
        chapter.game_id = data.game_id;
        chapter.game_name = data.game_name;
        // chapter.duration = data.duration;
        // chapter.offset = data.offset;
        chapter.title = data.title;
        chapter.is_mature = data.is_mature;
        chapter.online = data.online;
        chapter.started_at = parseISO(data.started_at);
        chapter.viewer_count = data.viewer_count;

        if (data.game_id) {
            const game = TwitchGame.getGameDataFromCache(data.game_id);
            if (game) {
                chapter.game = game;
            } else {
                console.error(`Could not find game data for game_id: ${data.game_id}`);
            }
        } else {
            console.error(chalk.red(`No game_id for chapter: ${data.title}`), data);
        }

        chapter.raw_chapter = data;

        return chapter;

    }

    calculateDurationAndOffset(vod_started_at: Date, vod_ended_at: Date, next_chapter_started_at: Date | undefined) {

        if (next_chapter_started_at) {
            this.duration = next_chapter_started_at.getTime() - this.started_at.getTime();
        } else {
            this.duration = vod_ended_at.getTime() - this.started_at.getTime();
        }

        this.offset = this.started_at.getTime() - vod_started_at.getTime();

    }

}