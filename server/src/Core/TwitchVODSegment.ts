import { ApiVodSegment } from "../../../common/Api/Client";

export class TwitchVODSegment {
    filename: string | undefined;
    basename: string | undefined;
    strings: Record<string, string> = {};
    filesize: number | undefined;
    deleted = false;

    toAPI(): ApiVodSegment {
        return {
            basename: this.basename || "",
            filesize: this.filesize || 0,
            deleted: this.deleted,
        };
    }

}