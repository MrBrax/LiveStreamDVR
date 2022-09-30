import { KeyValue } from "Core/KeyValue";
import { PubsubVideo } from "../../../../../common/YouTubeAPI/Pubsub";
import { BaseAutomator } from "../Base/BaseAutomator";
import express from "express";

export class YouTubeAutomator extends BaseAutomator {
    public getVodID(): string | false {
        return KeyValue.getInstance().get(`yt.${this.getUserID()}.vod.id`);
        // return $this->payload['id'];
    }

    public getStartDate(): string {
        return KeyValue.getInstance().get(`yt.${this.getUserID()}.vod.started_at`) || "";
    }

    public handle(entry: PubsubVideo, request: express.Request): Promise<boolean> {
        console.log("ya", entry["yt:channelId"], entry["yt:videoId"], entry.title);
        return Promise.resolve(false);
    }

}