import { TwitchChannel } from "../src/Core/TwitchChannel";
import { TwitchConfig } from "../src/Core/TwitchConfig";
import { TwitchVOD } from "../src/Core/TwitchVOD";
import fs from "fs";
import { TwitchGame } from "../src/Core/TwitchGame";

console.log(TwitchVOD.vods[0]);

describe("TwitchVOD", () => {

    /*
    it("loaded json should be same as saved json", async () => {
        await TwitchConfig.init();

        const vod = TwitchVOD.vods[0];

        if (!vod) {
            throw new Error("No VODs loaded");
        }

        if (!vod.filename) {
            throw new Error("No filename");
        }

        console.log("test vod found", vod.basename);

        const json = JSON.stringify(vod);

        const manual_load_json = fs.readFileSync(vod.filename, "utf8");
        // const json2 = JSON.stringify(vod.json);
        expect(json).toEqual(manual_load_json);
    });
    */

    it("vod should have valid fields", async() => {
        await TwitchConfig.init();

        const vod = TwitchVOD.vods[0];

        if (!vod) throw new Error("No VODs loaded");
        if (!vod.filename) throw new Error("No filename");

        expect(typeof vod.basename).toBe("string");
        expect(typeof vod.filename).toBe("string");
        expect(vod.chapters.length).toBeGreaterThan(0);
        expect(vod.segments.length).toBeGreaterThan(0);
        expect(vod.is_finalized).toBe(true);
        expect(vod.is_capturing).toBe(false);
        expect(vod.is_converting).toBe(false);
        expect(vod.is_converted).toBe(true);

    });

    it("vod should have valid chapters", async() => {
        await TwitchConfig.init();

        const vod = TwitchVOD.vods[0];

        if (!vod) throw new Error("No VODs loaded");
        if (!vod.filename) throw new Error("No filename");

        expect(vod.chapters.length).toBeGreaterThan(0);

        vod.chapters.forEach(chapter => {
            expect(chapter.datetime?.getTime()).toBeGreaterThan(0);
            expect(chapter.offset).toBeDefined();
            expect(chapter.duration).toBeGreaterThan(0);
            expect(chapter.game).toBeInstanceOf(TwitchGame);
            expect(chapter.game_id).not.toBe("");
            expect(chapter.game_name).not.toBe("");
            expect(chapter.box_art_url).not.toBe("");
            expect(chapter.title).not.toBe("");
            expect(typeof chapter.is_mature).toBe("boolean");
            expect(typeof chapter.online).toBe("boolean");
            // expect(chapter.viewer_count).toBeGreaterThan(0);
            expect(typeof chapter.hasFavouriteGame()).toBe("boolean");
        });

    });

    // it("should download a video", async () => {
    //     const vod = await TwitchVOD.downloadVideo("v18787878", "best", "v18787878.mp4");
    //     expect(vod).toBeTruthy();
    // });
});