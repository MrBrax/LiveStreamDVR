import type { ApiVodSegment } from "@common/Api/Client";
import type { AudioMetadata, VideoMetadata } from "@common/MediaInfo";

export class BaseVODSegment {
    public filename = "";
    public basename = "";
    public directory = "";
    // strings: Record<string, string> = {};
    public filesize: number | undefined;
    public deleted = false;

    public metadata: VideoMetadata | AudioMetadata | undefined;

    public toAPI(): ApiVodSegment {
        return {
            basename: this.basename || "",
            filesize: this.filesize || 0,
            deleted: this.deleted,
            metadata: this.metadata,
        };
    }
}
