import { TwitchGame } from "./TwitchGame";
import { TwitchHelper } from "./TwitchHelper";
import { TwitchVODChapterJSON } from "./TwitchVOD";

export class TwitchVODChapter {
	
    datetime: Date | undefined;
	offset: number | undefined;
    duration: number | undefined;
    strings: Record<string, string> = {};

    game: TwitchGame | undefined;

    /**
     * @deprecated
     */
    game_id: string | undefined;
    
    /**
     * @deprecated
     */
    game_name: string | undefined; // make dynamic

    /**
     * @deprecated
     */
    box_art_url: string | undefined; // make dynamic

	title: string | undefined;

    is_mature: boolean | undefined;
    online: boolean | undefined;

    // favourite: boolean | undefined;

    constructor(raw_chapter: TwitchVODChapterJSON){
        this.box_art_url = raw_chapter.box_art_url;
        this.game_id = raw_chapter.game_id;
        this.game_name = raw_chapter.game_name;
        this.duration = raw_chapter.duration;
        this.offset = raw_chapter.offset;
        this.title = raw_chapter.title;
        this.is_mature = raw_chapter.is_mature;
        this.online = raw_chapter.online;
        // this.favourite = raw_chapter.favourite;
    }

    // get game_name(){
    //     const game_data = await TwitchHelper.getGameData(this.game_id);
    //     return game_data?.name;
    // }

}