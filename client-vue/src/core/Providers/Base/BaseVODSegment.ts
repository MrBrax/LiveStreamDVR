import type { ApiVodSegment } from "@common/Api/Client";

export class BaseVODSegment {
    // filename: string | undefined;
    basename: string | undefined;
    // strings: Record<string, string> = {};
    filesize: number | undefined;
    deleted = false;

    public static makeFromApiResponse(apiResponse: ApiVodSegment): BaseVODSegment {
        const segment = new BaseVODSegment();
        // segment.filename = apiResponse.filename;
        segment.basename = apiResponse.basename;
        // segment.strings = apiResponse.strings;
        segment.filesize = apiResponse.filesize;
        segment.deleted = apiResponse.deleted;
        return segment;
    }
}
