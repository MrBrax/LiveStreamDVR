import { ApiVodSegment } from "@common/Api/Client";

export class TwitchVODSegment {
    // filename: string | undefined;
    basename: string | undefined;
    // strings: Record<string, string> = {};
    filesize: number | undefined;
    deleted = false;

    public static makeFromApiResponse(apiResponse: ApiVodSegment): TwitchVODSegment {
        const segment = new TwitchVODSegment();
        // segment.filename = apiResponse.filename;
        segment.basename = apiResponse.basename;
        // segment.strings = apiResponse.strings;
        segment.filesize = apiResponse.filesize;
        segment.deleted = apiResponse.deleted;
        return segment;
    }
}
