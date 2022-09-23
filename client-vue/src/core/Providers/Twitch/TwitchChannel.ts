import { ApiTwitchChannel } from "@common/Api/Client";
import { UserData } from "@common/User";
import { VideoQuality } from "@common/Config";
import { BroadcasterType } from "@common/TwitchAPI/Users";
import { TwitchGame } from "./TwitchGame";
import TwitchVOD from "./TwitchVOD";
import { TwitchVODChapterJSON } from "../../../../../server/src/Storage/JSON";
import BaseChannel from "../Base/BaseChannel";

export default class TwitchChannel extends BaseChannel {

    readonly provider = "twitch";
    uuid = "";
    /** @deprecated */
    userid = "";
    /** @deprecated */
    display_name = "";

    /** @deprecated */
    login = "";
    quality: VideoQuality[] = [];
    broadcaster_type: BroadcasterType = "";

    profile_image_url = "";
    offline_image_url = "";
    banner_image_url = "";

    vods_list: TwitchVOD[] = [];

    api_getSubscriptionStatus = false;

    channel_data: UserData | undefined;

    // is_live = false;
    // is_capturing = false;

    declare chapter_data?: TwitchVODChapterJSON;

    public static makeFromApiResponse(apiResponse: ApiTwitchChannel): TwitchChannel {
        const channel = new TwitchChannel();
        // channel.provider = apiResponse.provider;
        channel.uuid = apiResponse.uuid;
        channel.userid = apiResponse.userid;
        channel.display_name = apiResponse.display_name;
        channel.login = apiResponse.login;
        channel.description = apiResponse.description;
        channel.quality = apiResponse.quality || [];
        channel.vods_raw = apiResponse.vods_raw;
        channel.vods_list = apiResponse.vods_list.map((vod) => TwitchVOD.makeFromApiResponse(vod));
        channel.profile_image_url = apiResponse.profile_image_url;
        channel.offline_image_url = apiResponse.offline_image_url;
        channel.banner_image_url = apiResponse.banner_image_url;
        channel.api_getSubscriptionStatus = apiResponse.api_getSubscriptionStatus;
        channel.clips_list = apiResponse.clips_list;
        channel.video_list = apiResponse.video_list;
        channel.broadcaster_type = apiResponse.broadcaster_type;
        channel.no_capture = apiResponse.no_capture;
        channel.channel_data = apiResponse.channel_data;
        channel.current_stream_number = apiResponse.current_stream_number ?? 0;
        channel.current_season = apiResponse.current_season ?? "";
        // channel.is_capturing = apiResponse.is_capturing ?? false;
        channel.is_live = apiResponse.is_live ?? false;
        channel.chapter_data = apiResponse.chapter_data as TwitchVODChapterJSON; // temp
        channel.saves_vods = apiResponse.saves_vods ?? false;
        channel.displayName = apiResponse.displayName;
        channel.internalName = apiResponse.internalName;
        channel.internalId = apiResponse.internalId;
        channel.url = apiResponse.url;
        channel.profilePictureUrl = apiResponse.profilePictureUrl;
        channel.cloud_storage = apiResponse.cloud_storage;
        return channel;
    }

    get current_vod(): TwitchVOD | undefined {
        return this.vods_list?.find((vod) => vod.is_capturing);
    }

    get current_game(): TwitchGame | undefined {
        return this.current_vod?.current_game;
    }

}
