import { PHPDateTimeProxy } from "@/types";
import { parse, format } from "date-fns";
import { TwitchGame } from "./TwitchGame";
import { TwitchHelper } from "./TwitchHelper";
export interface TwitchVODChapterJSON {
    /** Date, 2022-02-23T00:47:32Z */
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
    /** Date, 2022-02-23T00:47:32Z */
    time: string;
    dt_started_at: PHPDateTimeProxy;
    game_id: string | false;
    game_name: string;
    viewer_count?: number;
    title: string;
    is_mature: boolean;
    online: boolean;
}

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

    raw_chapter: TwitchVODChapterJSON | TwitchVODChapterMinimalJSON | undefined;

    datetime: Date | undefined;
    offset: number | undefined;
    duration: number | undefined;
    strings: Record<string, string> = {};

    game: TwitchGame | undefined;
    game_id: string | false | undefined;

    /** Do not use for display */
    game_name: string | undefined; // make dynamic

    /** Do not use for display */
    box_art_url: string | undefined; // make dynamic

    title: string | undefined;

    is_mature: boolean | undefined;
    online: boolean | undefined;

    viewer_count: number | undefined;

    // favourite: boolean | undefined;

    constructor(raw_chapter: TwitchVODChapterJSON | TwitchVODChapterMinimalJSON) {

        if ("box_art_url" in raw_chapter) this.box_art_url = raw_chapter.box_art_url;
        this.game_id = raw_chapter.game_id;
        this.game_name = raw_chapter.game_name;
        if ("duration" in raw_chapter) this.duration = raw_chapter.duration;
        if ("offset" in raw_chapter) this.offset = raw_chapter.offset;
        this.title = raw_chapter.title;
        this.is_mature = raw_chapter.is_mature;
        this.online = raw_chapter.online;
        // this.favourite = raw_chapter.favourite;

        this.datetime = parse(raw_chapter.time, TwitchHelper.TWITCH_DATE_FORMAT, new Date());

        if (raw_chapter.game_id) {
            const game = TwitchGame.getGameDataFromCache(raw_chapter.game_id);
            if (game) {
                this.game = game;
            } else {
                console.error(`Could not find game data for game_id: ${raw_chapter.game_id}`);
            }
        } else {
            console.error(`No game_id for chapter: ${raw_chapter.title}`);
        }

        this.raw_chapter = raw_chapter;

    }

    getRawChapter(): TwitchVODChapterMinimalJSON {
        if (!this.datetime) throw new Error("Can't get raw chapter: No datetime set");
        // if (!this.game_id) throw new Error("Can't get raw chapter: No game_id set");
        // if (!this.game_name) throw new Error("Can't get raw chapter: No game_name set");
        if (!this.title) throw new Error("Can't get raw chapter: No title set");
        return {
            time: format(this.datetime, TwitchHelper.TWITCH_DATE_FORMAT),
            dt_started_at: TwitchHelper.JSDateToPHPDate(this.datetime),
            game_id: this.game_id || false,
            game_name: this.game_name || "",
            title: this.title,
            is_mature: this.is_mature || false,
            online: this.online || false,
            viewer_count: this.viewer_count ?? undefined,
        };
    }

    get dt_started_at(): PHPDateTimeProxy {
        if (!this.datetime) throw new Error("Can't get dt_started_at: No datetime set");
        return TwitchHelper.JSDateToPHPDate(this.datetime);
    }

    toJSON() {
        return {
            time: this.raw_chapter?.time,
            dt_started_at: this.dt_started_at,
            game_id: this.game_id,
            game_name: this.game_name,
            title: this.title,
            is_mature: this.is_mature,
            online: this.online,
            viewer_count: this.viewer_count,
            datetime: this.datetime ? TwitchHelper.JSDateToPHPDate(this.datetime) : undefined,
            favourite: this.game ? this.game.isFavourite() : false,
            offset: this.offset,
            strings: this.strings,
            box_art_url: this.box_art_url,
            duration: this.duration,
            // width: this.width,
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

    // get game_name(){
    //     const game_data = await TwitchHelper.getGameData(this.game_id);
    //     return game_data?.name;
    // }

}