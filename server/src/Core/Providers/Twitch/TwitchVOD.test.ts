import { TwitchVOD } from "./TwitchVOD";

describe("TwitchVOD", () => {
    describe("migrate", () => {
        it("should migrate twitch_vod_id to external_vod_id if external_vod_id is undefined", async () => {
            const twitchVOD = new TwitchVOD();
            twitchVOD.twitch_vod_id = "12345";

            const migrated = await twitchVOD.migrate();

            expect(migrated).toBe(true);
            expect(twitchVOD.external_vod_id).toBe("12345");
        });

        it("should migrate twitch_vod_duration to external_vod_duration if external_vod_duration is undefined", async () => {
            const twitchVOD = new TwitchVOD();
            twitchVOD.twitch_vod_duration = 3600;

            const migrated = await twitchVOD.migrate();

            expect(migrated).toBe(true);
            expect(twitchVOD.external_vod_duration).toBe(3600);
        });

        it("should migrate twitch_vod_title to external_vod_title if external_vod_title is undefined", async () => {
            const twitchVOD = new TwitchVOD();
            twitchVOD.twitch_vod_title = "Test VOD";

            const migrated = await twitchVOD.migrate();

            expect(migrated).toBe(true);
            expect(twitchVOD.external_vod_title).toBe("Test VOD");
        });

        it("should migrate twitch_vod_date to external_vod_date if external_vod_date is undefined", async () => {
            const twitchVOD = new TwitchVOD();
            twitchVOD.twitch_vod_date = "2022-01-01T00:00:00Z";

            const migrated = await twitchVOD.migrate();

            expect(migrated).toBe(true);
            expect(twitchVOD.external_vod_date).toEqual(
                new Date("2022-01-01T00:00:00Z")
            );
        });

        it("should migrate twitch_vod_exists to external_vod_exists if external_vod_exists is undefined", async () => {
            const twitchVOD = new TwitchVOD();
            twitchVOD.twitch_vod_exists = true;

            const migrated = await twitchVOD.migrate();

            expect(migrated).toBe(true);
            expect(twitchVOD.external_vod_exists).toBe(true);
        });

        it("should not migrate if all external_vod_* properties are defined", async () => {
            const twitchVOD = new TwitchVOD();
            twitchVOD.twitch_vod_id = "12345";
            twitchVOD.external_vod_id = "67890";
            twitchVOD.twitch_vod_duration = 3600;
            twitchVOD.external_vod_duration = 7200;
            twitchVOD.twitch_vod_title = "Test VOD";
            twitchVOD.external_vod_title = "Another Test VOD";
            twitchVOD.twitch_vod_date = "2022-01-01T00:00:00Z";
            twitchVOD.external_vod_date = new Date("2022-02-01T00:00:00Z");
            twitchVOD.twitch_vod_exists = true;
            twitchVOD.external_vod_exists = false;

            const migrated = await twitchVOD.migrate();

            expect(migrated).toBe(false);
            expect(twitchVOD.external_vod_id).toBe("67890");
            expect(twitchVOD.external_vod_duration).toBe(7200);
            expect(twitchVOD.external_vod_title).toBe("Another Test VOD");
            expect(twitchVOD.external_vod_date).toEqual(
                new Date("2022-02-01T00:00:00Z")
            );
            expect(twitchVOD.external_vod_exists).toBe(false);
        });
    });

    /*
    describe("saveJSON", () => {
        it("should throw an error if filename is not set", async () => {
            const twitchVOD = new TwitchVOD();
            await expect(twitchVOD.saveJSON()).rejects.toThrow(
                "Filename not set."
            );
        });

        it("should log a warning if chapters are not set and vod is not started", async () => {
            const twitchVOD = new TwitchVOD();
            twitchVOD.filename = "test.json";
            twitchVOD.not_started = false;
            twitchVOD.chapters = [];
            const logSpy = jest.spyOn(console, "log").mockImplementation();
            await twitchVOD.saveJSON();
            expect(logSpy).toHaveBeenCalledWith(
                expect.stringContaining(
                    "Saving JSON of test.json with no chapters!!"
                )
            );
            logSpy.mockRestore();
        });

        it("should log a fatal error if channel is not set and vod is not created", async () => {
            const twitchVOD = new TwitchVOD();
            twitchVOD.filename = "test.json";
            twitchVOD.not_started = true;
            twitchVOD.created = false;
            const logSpy = jest.spyOn(console, "log").mockImplementation();
            await twitchVOD.saveJSON();
            expect(logSpy).toHaveBeenCalledWith(
                expect.stringContaining(
                    "Found no channel in class of test.json, not saving!"
                )
            );
            logSpy.mockRestore();
        });

        it("should write JSON to file and return true if successful", async () => {
            const twitchVOD = new TwitchVOD();
            twitchVOD.filename = "test.json";
            twitchVOD.not_started = true;
            twitchVOD.created = true;
            twitchVOD.channel_uuid = "12345";
            twitchVOD.setPermissions = jest.fn();
            twitchVOD.stopWatching = jest.fn().mockResolvedValue(undefined);
            twitchVOD.startWatching = jest.fn().mockResolvedValue(undefined);
            twitchVOD.broadcastUpdate = jest.fn();
            twitchVOD.toJSON = jest.fn().mockResolvedValue({ test: "data" });
            const writeFileSyncSpy = jest
                .spyOn(fs, "writeFileSync")
                .mockImplementation();
            const result = await twitchVOD.saveJSON();
            expect(result).toBe(true);
            expect(writeFileSyncSpy).toHaveBeenCalledWith(
                "test.json",
                JSON.stringify({ test: "data" }, null, 4)
            );
            expect(twitchVOD.setPermissions).toHaveBeenCalled();
            expect(twitchVOD.stopWatching).toHaveBeenCalled();
            expect(twitchVOD.startWatching).toHaveBeenCalled();
            expect(twitchVOD.broadcastUpdate).toHaveBeenCalled();
            writeFileSyncSpy.mockRestore();
        });

        it("should log a fatal error and return false if failed to write JSON to file", async () => {
            const twitchVOD = new TwitchVOD();
            twitchVOD.filename = "test.json";
            twitchVOD.not_started = true;
            twitchVOD.created = true;
            twitchVOD.channel_uuid = "12345";
            twitchVOD.setPermissions = jest.fn();
            twitchVOD.stopWatching = jest.fn().mockResolvedValue(undefined);
            twitchVOD.startWatching = jest.fn().mockResolvedValue(undefined);
            twitchVOD.broadcastUpdate = jest.fn();
            twitchVOD.toJSON = jest.fn().mockResolvedValue({ test: "data" });
            const writeFileSyncSpy = jest
                .spyOn(fs, "writeFileSync")
                .mockImplementation(() => {
                    throw new Error("Failed to write file");
                });
            const logSpy = jest.spyOn(console, "log").mockImplementation();
            const result = await twitchVOD.saveJSON();
            expect(result).toBe(false);
            expect(logSpy).toHaveBeenCalledWith(
                expect.stringContaining(
                    "Failed to save JSON of test.json: Failed to write file"
                )
            );
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining(
                    "Failed to save JSON of test.json: Failed to write file"
                )
            );
            expect(twitchVOD.setPermissions).toHaveBeenCalled();
            expect(twitchVOD.stopWatching).toHaveBeenCalled();
            expect(twitchVOD.startWatching).toHaveBeenCalled();
            expect(twitchVOD.broadcastUpdate).not.toHaveBeenCalled();
            writeFileSyncSpy.mockRestore();
            logSpy.mockRestore();
        });
    });
    */

    describe("TwitchVOD", () => {
        describe("toAPI", () => {
            it("should have inherited toAPI value", async () => {
                const twitchVOD = new TwitchVOD();
                twitchVOD.uuid = "12345";
                twitchVOD.channel_uuid = "67890";
                twitchVOD.external_vod_id = "12345";

                const apiData = await twitchVOD.toAPI();
                expect(apiData).toHaveProperty("uuid", "12345");
                expect(apiData).toHaveProperty("channel_uuid", "67890");
                expect(apiData).toHaveProperty("external_vod_id", "12345");
            });
        });

        describe("toJSON", () => {
            it("should have inherited toJSON value", async () => {
                const twitchVOD = new TwitchVOD();
                twitchVOD.uuid = "12345";
                twitchVOD.channel_uuid = "67890";
                twitchVOD.external_vod_id = "12345";

                const jsonData = await twitchVOD.toJSON();
                expect(jsonData).toHaveProperty("uuid", "12345");
                expect(jsonData).toHaveProperty("channel_uuid", "67890");
                expect(jsonData).toHaveProperty("external_vod_id", "12345");
            });
        });
    });
});
