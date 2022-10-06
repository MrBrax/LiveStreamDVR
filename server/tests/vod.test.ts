import { TwitchChannel } from "../src/Core/Providers/Twitch/TwitchChannel";
import { Config } from "../src/Core/Config";
import { TwitchVOD } from "../src/Core/Providers/Twitch/TwitchVOD";
import fs from "fs";
import { BaseVODSegment } from "../src/Core/Providers/Base/BaseVODSegment";
import { randomUUID } from "crypto";
import { LiveStreamDVR } from "../src/Core/LiveStreamDVR";
import { KeyValue } from "../src/Core/KeyValue";
import { format } from "date-fns";
import { TwitchAutomator } from "../src/Core/Providers/Twitch/TwitchAutomator";

// jest.mock("TwitchVOD");
// const mockTwitchVOD = jest.mocked(TwitchVOD, true);

// jest.mock("../src/Core/Providers/Twitch/TwitchVOD");

beforeAll(async () => {
    const channels_config = JSON.parse(fs.readFileSync("./tests/mockdata/channels.json", "utf8"));
    await Config.init();
    LiveStreamDVR.getInstance().channels_config = channels_config;
    LiveStreamDVR.getInstance().channels = [];

    const mock_channel = new TwitchChannel();
    mock_channel.userid = "1";
    mock_channel.login = "testuser";
    mock_channel.display_name = "TestUser";
    mock_channel.channel_data = {
        login: "testuser",
        _updated: 1,
        cache_offline_image: "",
        profile_image_url: "",
        offline_image_url: "",
        created_at: "",
        id: "1",
        cache_avatar: "",
        broadcaster_type: "partner",
        display_name: "TestUser",
        type: "",
        description: "",
        view_count: 0,
    };
    LiveStreamDVR.getInstance().channels.push(mock_channel);

    jest.spyOn(mock_channel, "saveVodDatabase").mockImplementation(() => {
        console.debug("save vod database");
        return;
    });

    jest.spyOn(TwitchChannel, "channelLoginFromId").mockImplementation((channel_id: string) => { return Promise.resolve("testuser"); });
    jest.spyOn(TwitchChannel, "channelDisplayNameFromId").mockImplementation((channel_id: string) => { return Promise.resolve("TestUser"); });

    jest.spyOn(KeyValue.prototype, "save").mockImplementation(() => true);
    jest.spyOn(KeyValue.prototype, "load").mockImplementation(() => true);

    jest.spyOn(Config.prototype, "saveConfig").mockImplementation(() => true);

    // mock twitchvod delete function
    // mockTwitchVOD.delete.mockImplementation(async (vod_id) => {

});

describe("VOD", () => {

    it("episode number", async () => {

        const channel = LiveStreamDVR.getInstance().channels[0] as TwitchChannel;
        channel.setupStreamNumber();
        
        expect(channel.current_season).toBe(format(new Date(), Config.SeasonFormat));

        expect(channel.current_stream_number).toBe(1);
        expect(channel.incrementStreamNumber()).toBe(2);
        expect(channel.incrementStreamNumber()).toBe(3);
        expect(channel.incrementStreamNumber()).toBe(4);
        
        KeyValue.getInstance().set("testuser.season_identifier", "ayylmao");
        expect(channel.incrementStreamNumber()).toBe(1);
        expect(channel.incrementStreamNumber()).toBe(2);
        expect(channel.incrementStreamNumber()).toBe(3);
        expect(channel.incrementStreamNumber()).toBe(4);

        /*
        const vod = await channel.createVOD("test");

        const TA = new TwitchAutomator();
        TA.broadcaster_user_login = "test";
        TA.channel = channel;
        TA.vod = vod;

        TA.applySeasonEpisode();
        expect(vod.stream_number).toBe(5);
        expect(vod.stream_season).toBe(format(new Date(), Config.SeasonFormat));
        */

    });

});