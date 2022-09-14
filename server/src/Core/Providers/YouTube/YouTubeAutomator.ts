import { KeyValue } from "Core/KeyValue";
import { BaseAutomator } from "../Base/BaseAutomator";

export class YouTubeAutomator extends BaseAutomator {
    public getVodID(): string | false {
        return KeyValue.getInstance().get(`yt.${this.getUserID()}.vod.id`);
        // return $this->payload['id'];
    }

    public getStartDate(): string {
        return KeyValue.getInstance().get(`yt.${this.getUserID()}.vod.started_at`) || "";
    }
    
}