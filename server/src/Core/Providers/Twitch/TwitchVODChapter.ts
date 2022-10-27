import chalk from "chalk";
import { parseJSON } from "date-fns";
import { ApiVodTwitchChapter } from "@common/Api/Client";
import { TwitchVODChapterJSON } from "../../../Storage/JSON";
import { TwitchGame } from "./TwitchGame";
import { BaseVODChapter } from "../Base/BaseVODChapter";
import { Providers } from "@common/Defs";

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


export class TwitchVODChapter extends BaseVODChapter {

    public provider: Providers = "twitch";

    public raw_chapter: TwitchVODChapterJSON | undefined;

    public game_id?: string;
    public game?: TwitchGame;

    public is_mature = false;

    /**
     * Twitch does not include viewer count in the EventSub response,
     * so it has to be fetched from the GetStreams endpoint.
     */
    public viewer_count?: number;

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

    public toAPI(): ApiVodTwitchChapter {
        return {
            title: this.title,

            game_id: this.game_id,
            box_art_url: this.box_art_url,
            game_name: this.game_name,

            game: this.game?.toAPI(),

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
        chapter.started_at = parseJSON(data.started_at);
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