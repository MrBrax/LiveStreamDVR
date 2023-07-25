import { format } from "date-fns";
import fs from "node:fs";
import { Config } from "../src/Core/Config";
import { KeyValue } from "../src/Core/KeyValue";
import { LiveStreamDVR } from "../src/Core/LiveStreamDVR";
import { TwitchChannel } from "../src/Core/Providers/Twitch/TwitchChannel";
import "./environment";

// jest.mock("TwitchVOD");
// const mockTwitchVOD = jest.mocked(TwitchVOD, true);

// jest.mock("../src/Core/Providers/Twitch/TwitchVOD");

beforeAll(async () => {
    jest.spyOn(TwitchChannel, "channelLoginFromId").mockImplementation(
        (channel_id: string) => {
            return Promise.resolve("testuser");
        }
    );
    jest.spyOn(TwitchChannel, "channelDisplayNameFromId").mockImplementation(
        (channel_id: string) => {
            return Promise.resolve("TestUser");
        }
    );

    const channels_config = JSON.parse(
        fs.readFileSync("./tests/mockdata/channels.json", "utf8")
    );
    LiveStreamDVR.getInstance().channels_config = channels_config;
    LiveStreamDVR.getInstance().clearChannels();

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
        avatar_cache: "",
        avatar_thumb: "",
        broadcaster_type: "partner",
        display_name: "TestUser",
        type: "",
        description: "",
        view_count: 0,
    };

    LiveStreamDVR.getInstance().addChannel(mock_channel);

    // mock twitchvod delete function
    // mockTwitchVOD.delete.mockImplementation(async (vod_id) => {
});

describe("VOD", () => {
    it("episode number", async () => {
        const channel =
            LiveStreamDVR.getInstance().getChannels()[0] as TwitchChannel;
        await channel.setupStreamNumber();

        expect(channel.current_season).toBe(
            format(new Date(), Config.SeasonFormat)
        );

        expect(channel.current_stream_number).toBe(1);
        expect(channel.incrementStreamNumber()).toMatchObject({
            stream_number: 2,
        });
        expect(channel.incrementStreamNumber()).toMatchObject({
            stream_number: 3,
        });
        expect(channel.incrementStreamNumber()).toMatchObject({
            stream_number: 4,
        });

        KeyValue.getInstance().set("testuser.season_identifier", "ayylmao");
        expect(channel.incrementStreamNumber()).toMatchObject({
            stream_number: 1,
        });
        expect(channel.incrementStreamNumber()).toMatchObject({
            stream_number: 2,
        });
        expect(channel.incrementStreamNumber()).toMatchObject({
            stream_number: 3,
        });
        expect(channel.incrementStreamNumber()).toMatchObject({
            stream_number: 4,
        });

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
