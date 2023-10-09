// BEGIN: 7d4e1f7d9f5a
import path from "node:path";
import { videometadata } from "./Video";

// mock Config.getInstance() to return our mock config with mediainfo path set
jest.mock("../Core/Config", () => {
    const config = {
        cfg: (key: string) => {
            if (key === "mediainfo_path") {
                return "mediainfo";
            }
            return null;
        },
        hasValue: (key: string) => {
            if (key === "mediainfo_path") {
                return true;
            }
            return false;
        },
        initialised: true,
    };
    return {
        Config: {
            getInstance: jest.fn(() => config),
        },
    };
});

describe("videometadata", () => {
    it("should throw an error if the file does not exist", async () => {
        await expect(videometadata("nonexistentfile.mp4")).rejects.toThrow();
    });

    it("should return metadata for a valid video file", async () => {
        const metadata = await videometadata(
            path.join(
                __dirname,
                "..",
                "..",
                "tests",
                "mockdata",
                "testvideo.mp4"
            )
        );
        expect(metadata).toBeDefined();
        if (metadata.type !== "video") {
            throw new Error("Expected metadata.type to be video");
        }
        expect(metadata.type).toBe("video");
        expect(metadata.container).toBe("MPEG-4");
        expect(metadata.video_codec).toBe("AVC");
        expect(metadata.audio_codec).toBe("AAC");
        expect(metadata.width).toBe(1920);
        expect(metadata.height).toBe(1080);
        expect(metadata.duration).toBe(1);
        expect(metadata.bitrate).toBe(6125255);
        expect(metadata.fps).toBe(60);
        expect(metadata.fps_mode).toBe("VFR");
    });

    it("should return metadata for a valid audio file", async () => {
        const metadata = await videometadata(
            path.join(
                __dirname,
                "..",
                "..",
                "tests",
                "mockdata",
                "testaudio.mp3"
            )
        );
        expect(metadata).toBeDefined();
        if (metadata.type !== "audio") {
            throw new Error("Expected metadata.type to be audio");
        }
        expect(metadata.type).toBe("audio");
        expect(metadata.container).toBe("MPEG Audio");
        expect(metadata.audio_codec).toBe("MPEG Audio");
    });
});
// END: 7d4e1f7d9f5a
