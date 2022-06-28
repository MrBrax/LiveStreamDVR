import { ApiChannel } from "@common/Api/Client";
import { UserData } from "@common/User";
import { VideoQuality } from "@common/Config";
import { BroadcasterType } from "@common/TwitchAPI/Users";
import { TwitchVODChapter } from "./chapter";
import { TwitchGame } from "./game";
import TwitchVOD from "./vod";
import { TwitchVODChapterJSON } from "../../../server/src/Storage/JSON";

export default class TwitchChannel {
    userid = "";
    display_name = "";
    login = "";
    description = "";
    quality: VideoQuality[] = [];
    no_capture = false;
    broadcaster_type: BroadcasterType = "";

    profile_image_url = "";
    offline_image_url = "";
    banner_image_url = "";

    vods_raw: string[] = [];
    vods_list: TwitchVOD[] = [];

    clips_list: string[] = [];

    api_getSubscriptionStatus = false;

    channel_data: UserData | undefined;

    current_stream_number: number = 0;
    current_season = "";
    is_live = false;
    is_capturing = false;

    chapter_data?: TwitchVODChapterJSON;

    public static makeFromApiResponse(apiResponse: ApiChannel): TwitchChannel {
        const channel = new TwitchChannel();
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
        channel.broadcaster_type = apiResponse.broadcaster_type;
        channel.no_capture = apiResponse.no_capture;
        channel.channel_data = apiResponse.channel_data;
        channel.current_stream_number = apiResponse.current_stream_number ?? 0;
        channel.current_season = apiResponse.current_season ?? "";
        channel.is_capturing = apiResponse.is_capturing ?? false;
        channel.is_live = apiResponse.is_live ?? false;
        channel.chapter_data = apiResponse.chapter_data;
        return channel;
    }

    get current_vod(): TwitchVOD | undefined {
        return this.vods_list?.find((vod) => vod.is_capturing);
    }

    // get is_live() {
    //     return this.current_vod != undefined && this.current_vod.is_capturing;
    // }

    get current_game(): TwitchGame | undefined {
        return this.current_vod?.current_game;
    }

    get current_chapter(): TwitchVODChapter | undefined {
        return this.current_vod?.current_chapter;
    }

    get is_converting(): boolean {
        return this.vods_list?.some((vod) => vod.is_converting) ?? false;
    }

    get vods_size(): number {
        return this.vods_list?.reduce((acc, vod) => acc + (vod.segments?.reduce((acc, seg) => acc + (seg && seg.filesize ? seg.filesize : 0), 0) ?? 0), 0) ?? 0;
    }
}
