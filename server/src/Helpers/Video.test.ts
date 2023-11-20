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

    it("should error on corrupted video file", () => {
        expect(async () => {
            await videometadata(
                path.join(
                    __dirname,
                    "..",
                    "..",
                    "tests",
                    "mockdata",
                    "testvideo_corrupted.mp4"
                )
            );
        }).rejects.toThrow();
    });
});

/*
describe("parseMediainfoOutput", () => {
    it("should parse mediainfo output and return the expected MediaInfo object", () => {
        const inputData = `{
            "media": {
                "track": [
                    {
                        "@type": "General",
                        "duration": "1",
                        "bit_rate": "6125255"
                    },
                    {
                        "@type": "Video",
                        "codec_name": "AVC",
                        "width": "1920",
                        "height": "1080",
                        "frame_rate": "60",
                        "frame_rate_mode": "VFR"
                    },
                    {
                        "@type": "Audio",
                        "codec_name": "AAC"
                    }
                ]
            }
        }`;

        const expectedOutput = {
            general: {
                "@type": "General",
                duration: "1",
                bit_rate: "6125255",
            },
            video: {
                "@type": "Video",
                codec_name: "AVC",
                width: "1920",
                height: "1080",
                frame_rate: "60",
                frame_rate_mode: "VFR",
            },
            audio: {
                "@type": "Audio",
                codec_name: "AAC",
            },
        };

        const result = parseMediainfoOutput(inputData);
        expect(result).toEqual(expectedOutput);
    });
});
*/
