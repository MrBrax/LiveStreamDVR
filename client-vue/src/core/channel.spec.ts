import { ApiChannel } from '@common/Api/Client';
import { MockApiChannelData, MockApiChapterData, MockApiGameData, MockApiVODData, MockApiVODSegmentData } from '@/../test/mockdata';
import { assert, describe, expect, it, test, vitest } from 'vitest'
import TwitchChannel from "./channel";
import TwitchVOD from './vod';
import { TwitchGame } from './game';
import { TwitchVODChapter } from './chapter';
import { TwitchVODSegment } from './segment';

test("makeFromApiResponse", () => {

    const channel = TwitchChannel.makeFromApiResponse(MockApiChannelData);
    expect(channel).to.be.instanceof(TwitchChannel);
    expect(channel.userid).toBe("123");
    expect(channel.display_name).toBe("test");
    expect(channel.login).toBe("test");
    expect(channel.description).toBe("test");
    expect(channel.quality).toEqual([]);
    expect(channel.vods_raw).toEqual([]);
    expect(channel.vods_list).toEqual([]);
    expect(channel.profile_image_url).toBe("");
    expect(channel.api_getSubscriptionStatus).toBe(false);
    expect(channel.broadcaster_type).toBe("");
    expect(channel.clips_list).toEqual([]);

});

test("is_live getter", () => {

    const channel = TwitchChannel.makeFromApiResponse(MockApiChannelData);
    expect(channel.is_live).toBe(false);

    const live_channel = TwitchChannel.makeFromApiResponse(MockApiChannelData);
    const mock_vod = TwitchVOD.makeFromApiResponse(MockApiVODData);
    mock_vod.is_capturing = true;
    live_channel.vods_list.push(mock_vod);
    expect(live_channel.is_live).toBe(true);

});

test("current_vod getter", () => {

    const channel = TwitchChannel.makeFromApiResponse(MockApiChannelData);
    expect(channel.current_vod).toBe(undefined);

    const live_channel = TwitchChannel.makeFromApiResponse(MockApiChannelData);
    const mock_vod = TwitchVOD.makeFromApiResponse(MockApiVODData);
    mock_vod.is_capturing = true;
    live_channel.vods_list.push(mock_vod);
    expect(live_channel.current_vod).toBe(mock_vod);

});

test("is_converting getter", () => {

    const channel = TwitchChannel.makeFromApiResponse(MockApiChannelData);
    expect(channel.is_converting).toBe(false);

    const converting_channel = TwitchChannel.makeFromApiResponse(MockApiChannelData);
    const mock_vod = TwitchVOD.makeFromApiResponse(MockApiVODData);
    mock_vod.is_converting = true;
    converting_channel.vods_list.push(mock_vod);
    expect(converting_channel.is_converting).toBe(true);

});

test("current_game getter", () => {

    const channel = TwitchChannel.makeFromApiResponse(MockApiChannelData);
    expect(channel.current_game).toBe(undefined);

    const gaming_channel = TwitchChannel.makeFromApiResponse(MockApiChannelData);
    const mock_vod = TwitchVOD.makeFromApiResponse(MockApiVODData);
    const mock_chapter = TwitchVODChapter.makeFromApiResponse(MockApiChapterData);
    const mock_game = TwitchGame.makeFromApiResponse(MockApiGameData);

    mock_chapter.game_id = "123";
    mock_chapter.game = mock_game;
    mock_vod.chapters.push(mock_chapter);
    mock_vod.is_capturing = true;
    gaming_channel.vods_list.push(mock_vod);

    expect(gaming_channel.current_game).toBe(mock_game);

});

test("vods_size getter", () => {

    const channel = TwitchChannel.makeFromApiResponse(MockApiChannelData);
    expect(channel.vods_size).toBe(0);

    const vod_channel = TwitchChannel.makeFromApiResponse(MockApiChannelData);
    const mock_vod = TwitchVOD.makeFromApiResponse(MockApiVODData);
    const mock_segment = TwitchVODSegment.makeFromApiResponse(MockApiVODSegmentData);
    mock_segment.filesize = 1024;
    mock_vod.segments.push(mock_segment);
    vod_channel.vods_list.push(mock_vod);

    expect(vod_channel.vods_size).toBe(1024);

});


/*
test("current_game getter", () => {

    const channel = TwitchChannel.makeFromApiResponse(MockApiChannelData);
    expect(channel.current_game).toBe(undefined);

    const live_channel = TwitchChannel.makeFromApiResponse(MockApiChannelData);
    const mock_vod = TwitchVOD.makeFromApiResponse(MockApiVODData);
    mock_vod.is_capturing = true;
    live_channel.vods_list.push(mock_vod);
    expect(live_channel.current_game).toBe(mock_vod.current_game);

});
*/