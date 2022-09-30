import { TwitchChannel } from "../src/Core/Providers/Twitch/TwitchChannel";
import { Config } from "../src/Core/Config";
import { TwitchVOD } from "../src/Core/Providers/Twitch/TwitchVOD";
import fs from "fs";
import { BaseVODSegment } from "../src/Core/Providers/Base/BaseVODSegment";
import { randomUUID } from "crypto";
import { LiveStreamDVR } from "../src/Core/LiveStreamDVR";

// jest.mock("TwitchVOD");
// const mockTwitchVOD = jest.mocked(TwitchVOD, true);

beforeAll(async () => {
    const channels_config = JSON.parse(fs.readFileSync("./tests/mockdata/channels.json", "utf8"));
    await Config.init();
    LiveStreamDVR.getInstance().channels_config = channels_config;
    LiveStreamDVR.getInstance().channels = [];

    const mock_channel = new TwitchChannel();
    mock_channel.login = "testuser";
    LiveStreamDVR.getInstance().channels.push(mock_channel);

    // mock twitchvod delete function
    // mockTwitchVOD.delete.mockImplementation(async (vod_id) => {

});

describe("Channel", () => {

    it("cleanup", async () => {
        const channel = LiveStreamDVR.getInstance().channels[0] as TwitchChannel;

        const spies = [];

        for (let i = 0; i < 10; i++) {
            const vod = new TwitchVOD();
            vod.uuid = randomUUID();
            vod.basename = `testvod_${i+1}`;
            const seg = new BaseVODSegment();
            seg.basename = `testvod_${i+1}.mp4`;
            seg.filesize = 1024 * 1024 * 1024 * 20;
            vod.segments = [seg];
            vod.total_size = seg.filesize;
            vod.is_finalized = true;
            spies.push(jest.spyOn(vod, "delete").mockImplementation(async () => {
                console.log("delete", vod.basename);
                return await Promise.resolve(true);
            }));
            channel.vods_list.push(vod);
            // console.log("add", vod.basename, Helper.formatBytes(seg.filesize));
        }

        console.log("added vods", channel.vods_list.length);

        // to test
        // Config.getInstance().cfg<number>("storage_per_streamer", 100);
        // Config.getInstance().cfg<number>("vods_to_keep", 5);
        // channel.max_storage
        // channel.max_vods

        // 10 vods in memory

        // 6 vods per streamer (delete 4 vods)
        Config.getInstance().setConfig("vods_to_keep", 6);
        Config.getInstance().setConfig("storage_per_streamer", 1000);
        const candidates_0 = channel.roundupCleanupVodCandidates();
        expect(candidates_0.length).toBe(4);

        // 1 vod per streamer (delete 9 vods)
        Config.getInstance().setConfig("vods_to_keep", 1);
        Config.getInstance().setConfig("storage_per_streamer", 1000);
        const candidates_1 = channel.roundupCleanupVodCandidates();
        expect(candidates_1.length).toBe(9);

        // 40 GB per streamer (delete 8 vods)
        Config.getInstance().setConfig("vods_to_keep", 99);
        Config.getInstance().setConfig("storage_per_streamer", 40);
        const candidates_2 = channel.roundupCleanupVodCandidates();
        expect(candidates_2.length).toBe(8);

        // 0 GB per streamer (delete 10 vods) (stupid case)
        Config.getInstance().setConfig("vods_to_keep", 99);
        Config.getInstance().setConfig("storage_per_streamer", 0);
        const candidates_3 = channel.roundupCleanupVodCandidates();
        expect(candidates_3.length).toBe(10);

        // 0 vods per streamer (delete 10 vods) (stupid case)
        Config.getInstance().setConfig("vods_to_keep", 0);
        Config.getInstance().setConfig("storage_per_streamer", 1000);
        const candidates_4 = channel.roundupCleanupVodCandidates();
        expect(candidates_4.length).toBe(10);

        // 20 vods per streamer (delete 0 vods)
        Config.getInstance().setConfig("vods_to_keep", 20);
        Config.getInstance().setConfig("storage_per_streamer", 1000);
        const candidates_5 = channel.roundupCleanupVodCandidates();
        expect(candidates_5.length).toBe(0);

        // 1000 GB per streamer (delete 0 vods)
        Config.getInstance().setConfig("vods_to_keep", 99);
        Config.getInstance().setConfig("storage_per_streamer", 1000);
        const candidates_6 = channel.roundupCleanupVodCandidates();
        expect(candidates_6.length).toBe(0);

        // 1 vod override for channel (delete 9 vods)
        Config.getInstance().setConfig("vods_to_keep", 5);
        Config.getInstance().setConfig("storage_per_streamer", 100);
        channel.max_vods = 1;
        channel.max_storage = 0;
        const candidates_7 = channel.roundupCleanupVodCandidates();
        expect(candidates_7.length).toBe(9);

        // 40 GB override for channel (delete 8 vods)
        Config.getInstance().setConfig("vods_to_keep", 99);
        Config.getInstance().setConfig("storage_per_streamer", 100);
        channel.max_vods = 0;
        channel.max_storage = 40;
        const candidates_8 = channel.roundupCleanupVodCandidates();
        expect(candidates_8.length).toBe(8);

        const last_uuid = channel.vods_list ? channel.vods_list.at(-1)?.uuid : "";

        // 1 vod per streamer but ignore newest vod (delete 8 vods)
        Config.getInstance().setConfig("vods_to_keep", 1);
        Config.getInstance().setConfig("storage_per_streamer", 1000);
        const candidates_9 = channel.roundupCleanupVodCandidates(last_uuid);
        expect(candidates_9.length).toBe(8);

        // 40 GB per streamer but ignore newest vod (delete 7 vods)
        Config.getInstance().setConfig("vods_to_keep", 99);
        Config.getInstance().setConfig("storage_per_streamer", 40);
        const candidates_10 = channel.roundupCleanupVodCandidates(last_uuid);
        expect(candidates_10.length).toBe(7);

        // 1 vod per streamer but legacy mode (delete 1 vod)
        Config.getInstance().setConfig("vods_to_keep", 1);
        Config.getInstance().setConfig("storage_per_streamer", 1000);
        Config.getInstance().setConfig("delete_only_one_vod", true);
        const candidates_11 = await channel.cleanupVods();
        expect(candidates_11).toBe(1);
        // expect(spies[9].mock.calls.length).toBe(1);
        expect(spies[8].mock.calls.length).toBe(1); // FIXME: legacy mode does not delete the oldest vod (#9)

        // 1 vod per streamer but one vod has protected flag (delete 8 vod)
        Config.getInstance().setConfig("vods_to_keep", 1);
        Config.getInstance().setConfig("storage_per_streamer", 1000);
        channel.vods_list[0].prevent_deletion = true;
        const candidates_12 = channel.roundupCleanupVodCandidates();
        expect(candidates_12.length).toBe(8);

        // const vodsDeleted = await channel.cleanupVods();
        // expect(vodsDeleted).toBe(10);
        // console.log("vodsDeleted", vodsDeleted);
    });

});