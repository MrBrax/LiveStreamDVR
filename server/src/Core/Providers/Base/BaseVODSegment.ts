import type { ApiVodSegment } from "@common/Api/Client";

export class BaseVODSegment {
    public filename: string | undefined;
    public basename: string | undefined;
    // strings: Record<string, string> = {};
    public filesize: number | undefined;
    public deleted = false;

    public toAPI(): ApiVodSegment {
        return {
            basename: this.basename || "",
            filesize: this.filesize || 0,
            deleted: this.deleted,
        };
    }
}
