import { TwitchVODChapterJSON } from "./TwitchVOD";

export class TwitchVODChapter {
	
    datetime: Date | undefined;
	offset: number | undefined;
    duration: number | undefined;
    strings: Record<string, string> = {};

    box_art_url: string | undefined;

    constructor(raw_chapter: TwitchVODChapterJSON){

    }
}