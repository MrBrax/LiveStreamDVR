import type { ApiYouTubeChannel } from "@common/Api/Client";
import type { BaseVODChapterJSON } from "../../../../../server/src/Storage/JSON";
import BaseChannel from "../Base/BaseChannel";
import YouTubeVOD from "./YouTubeVOD";

export default class YouTubeChannel extends BaseChannel {
    uuid = "";
    readonly provider = "youtube";
    channel_id = "";
    display_name = "";
    // quality: VideoQuality[] = [];
    profile_image_url = "";

    vods_list: YouTubeVOD[] = [];

    api_getSubscriptionStatus = false;

    // channel_data: UserData | undefined;

    is_live = false;
    // is_capturing = false;

    // declare chapter_data?: BaseVODChapterJSON;

    public static makeFromApiResponse(apiResponse: ApiYouTubeChannel): YouTubeChannel {

        const { provider, ...baseChannel } = BaseChannel.makeFromApiResponse(apiResponse); // remove provider from baseChannel to avoid overwriting it
        const channel = new YouTubeChannel();
        Object.assign(channel, baseChannel);

        channel.vods_list = apiResponse.vods_list.map((vod) => YouTubeVOD.makeFromApiResponse(vod));
        channel.profile_image_url = apiResponse.profile_image_url;
        channel.api_getSubscriptionStatus = apiResponse.api_getSubscriptionStatus;
        channel.chapter_data = apiResponse.chapter_data as BaseVODChapterJSON; // temp
        // channel.saves_vods = apiResponse.saves_vods ?? false;
        return channel;
    }
}
