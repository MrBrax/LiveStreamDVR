import { ApiBaseChannel, ApiTwitchChannel } from "@common/Api/Client";
import { UserData } from "@common/User";
import { VideoQuality } from "@common/Config";
import { BroadcasterType } from "@common/TwitchAPI/Users";
import { TwitchVODChapterJSON } from "../../../../../server/src/Storage/JSON";
import { LocalVideo } from "@common/LocalVideo";
import { LocalClip } from "@common/LocalClip";
import TwitchVOD from "@/core/Providers/Twitch/TwitchVOD";
import { TwitchGame } from "../Twitch/TwitchGame";
import { BaseVODChapter } from "./BaseVODChapter";

export default class BaseChannel {

    provider = "base";
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

    clips_list: LocalClip[] = [];
    video_list: LocalVideo[] = [];

    api_getSubscriptionStatus = false;

    // channel_data: UserData | undefined;

    current_stream_number: number = 0;
    current_season = "";
    is_live = false;
    // is_capturing = false;

    chapter_data?: TwitchVODChapterJSON;

    saves_vods = false;

    download_vod_at_end: boolean = false;
    download_vod_at_end_quality: VideoQuality = "best";

    public static makeFromApiResponse(apiResponse: ApiBaseChannel): BaseChannel {
        throw new Error("Not for base channel");
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

    get current_chapter(): BaseVODChapter | undefined {
        return this.current_vod?.current_chapter;
    }

    get is_capturing(): boolean {
        return this.current_vod != undefined && this.current_vod.is_capturing;
    }

    get is_converting(): boolean {
        return this.vods_list?.some((vod) => vod.is_converting) ?? false;
    }

    get vods_size(): number {
        return this.vods_list?.reduce((acc, vod) => acc + (vod.segments?.reduce((acc, seg) => acc + (seg && seg.filesize ? seg.filesize : 0), 0) ?? 0), 0) ?? 0;
    }
}
