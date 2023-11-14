import type { KickVODJSON } from "@/Storage/JSON";
import type { ApiKickVod } from "@common/Api/Client";
import type { Providers } from "@common/Defs";
import { parseJSON } from "date-fns";
import { BaseVOD } from "../Base/BaseVOD";

export class KickVOD extends BaseVOD {
    public provider: Providers = "kick";

    json?: KickVODJSON;

    public kick_vod_id? = "";

    /**
     * Set up basic data
     * Requires JSON to be loaded
     */
    public setupBasic(): void {
        if (!this.json) {
            throw new Error("No JSON loaded for basic setup!");
        }

        super.setupBasic();

        this.stream_resolution = this.json.stream_resolution;

        // TODO: what
        // const dur = this.getDurationLive();
        // this.duration_live = dur === false ? -1 : dur;

        this.bookmarks = this.json.bookmarks
            ? this.json.bookmarks.map((b) => {
                  return {
                      name: b.name,
                      date: parseJSON(b.date),
                  };
              })
            : [];
    }

    public async toAPI(): Promise<ApiKickVod> {
        if (!this.uuid) throw new Error(`No UUID set on VOD ${this.basename}`);
        if (!this.channel_uuid)
            throw new Error(`No channel UUID set on VOD ${this.basename}`);
        return await Promise.resolve({
            ...(await super.toAPI()),
            provider: "kick",
            segments: this.segments.map((s) => s.toAPI()),
            segments_raw: this.segments_raw,
            chapters: this.chapters.map((c) => c.toAPI()),
            // chapters_raw: this.chapters_raw,
        });
    }
}
