import { LiveStreamDVR } from "./LiveStreamDVR";
import { VChannel } from "./VChannel";

export class YouTubeChannel extends VChannel {

    vods_list: string[] = [];

    public static getChannels(): YouTubeChannel[] {
        return LiveStreamDVR.getInstance().channels.filter<YouTubeChannel>((channel): channel is YouTubeChannel => channel instanceof YouTubeChannel) || [];
    }

}