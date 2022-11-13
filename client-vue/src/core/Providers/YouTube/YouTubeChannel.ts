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
        const channel = new YouTubeChannel();
        // channel.provider = apiResponse.provider;
        channel.uuid = apiResponse.uuid;
        channel.channel_id = apiResponse.channel_id;
        channel.display_name = apiResponse.display_name;
        // channel.login = apiResponse.login;
        channel.description = apiResponse.description;
        // channel.quality = apiResponse.quality || [];
        channel.vods_raw = apiResponse.vods_raw;
        channel.vods_list = apiResponse.vods_list.map((vod) => YouTubeVOD.makeFromApiResponse(vod));
        channel.profile_image_url = apiResponse.profile_image_url;
        // channel.offline_image_url = apiResponse.offline_image_url;
        // channel.banner_image_url = apiResponse.banner_image_url;
        channel.api_getSubscriptionStatus = apiResponse.api_getSubscriptionStatus;
        channel.clips_list = apiResponse.clips_list;
        channel.video_list = apiResponse.video_list;
        // channel.broadcaster_type = apiResponse.broadcaster_type;
        channel.no_capture = apiResponse.no_capture;
        // channel.channel_data = apiResponse.channel_data;
        channel.current_stream_number = apiResponse.current_stream_number ?? 0;
        channel.current_season = apiResponse.current_season ?? "";
        // channel.is_capturing = apiResponse.is_capturing ?? false;
        channel.is_live = apiResponse.is_live ?? false;
        channel.chapter_data = apiResponse.chapter_data as BaseVODChapterJSON; // temp
        channel.saves_vods = apiResponse.saves_vods ?? false;
        channel.displayName = apiResponse.displayName;
        channel.internalName = apiResponse.internalName;
        channel.internalId = apiResponse.internalId;
        channel.url = apiResponse.url;
        channel.profilePictureUrl = apiResponse.profilePictureUrl;
        return channel;
    }

}
