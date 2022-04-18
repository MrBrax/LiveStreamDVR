import { ApiVodSegment } from "../../../common/Api/Client";

export class TwitchVODSegment {
    filename: string | undefined;
    basename: string | undefined;
    strings: Record<string, string> = {};
    filesize: number | undefined;

    toAPI(): ApiVodSegment {
        return {
            basename: this.basename || "",
            filesize: this.filesize || 0,
            deleted: false,
        };
    }

}