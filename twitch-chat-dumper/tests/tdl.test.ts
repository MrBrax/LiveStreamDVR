import { TwitchChat } from "../src/TwitchChat";
import {
    TwitchComment,
    TwitchCommentDumpTD,
    TwitchCommentMessageFragment,
    TwitchCommentEmoticons,
    TwitchCommentUserBadge,
} from "../../common/Comments";
import fs from "node:fs";
import { spawn } from "child_process";

describe("TwitchDownloader compliance", () => {
    test("Dump", () => {
        const data: TwitchCommentDumpTD = JSON.parse(
            fs.readFileSync("./tests/dump.json", "utf8")
        );

        expect(data.comments).not.toBeUndefined();
        // expect(data.emotes).not.toBeUndefined();
        expect(data.streamer).not.toBeUndefined();
        expect(data.video).not.toBeUndefined();

        if (!data.streamer) throw new Error("No streamer");

        expect(typeof data.streamer.name).toBe("string");
        expect(typeof data.streamer.id).toBe("number");

        const comment = data.comments[0];
        expect(typeof comment._id).toBe("string");
        expect(typeof comment.channel_id).toBe("string");
        expect(typeof comment.content_id).toBe("string");
        expect(typeof comment.content_offset_seconds).toBe("number");
        expect(typeof comment.content_type).toBe("string");
        expect(typeof comment.commenter._id).toBe("string");
        expect(typeof comment.commenter.bio).toBe("string");
        expect(typeof comment.commenter.created_at).toBe("string");
        expect(typeof comment.commenter.display_name).toBe("string");
        expect(typeof comment.commenter.logo).toBe("string");
        expect(typeof comment.commenter.name).toBe("string");
        // expect(typeof comment.commenter.type).toBe("string");
        expect(typeof comment.commenter.updated_at).toBe("string");
        expect(typeof comment.message.body).toBe("string");
        expect(typeof comment.message.emoticons).toBe("object");
        expect(typeof comment.message.fragments).toBe("object");
        expect(typeof comment.message.user_badges).toBe("object");
        expect(typeof comment.message.user_color).toBe("string");
        expect(typeof comment.message.bits_spent).toBe("number");
        // expect(typeof comment.message.is_action).toBe("boolean");
        // expect(typeof comment.more_replies).toBe("boolean");
        expect(typeof comment.created_at).toBe("string");
        // expect(typeof comment.source).toBe("string");
        // expect(typeof comment.state).toBe("string");
        // expect(typeof comment.updated_at).toBe("string");

        const fragment = comment.message.fragments[0];
        expect(typeof fragment.text).toBe("string");
        expect(typeof fragment.emoticon).toBe("object");

        expect(typeof data.video.start).toBe("number");
        expect(typeof data.video.end).toBe("number");
    });

    // relying on a live channel is not a good idea, TODO: mock this somehow
    /*
    test("Live Dump", async () => {

        const channel = "bobross";

        const dumper = new TwitchChat(channel, "0", JSON.stringify(new Date()));
        dumper.connect();

        dumper.startDump("temp.json");

        // wait 30 seconds, probably enough time to get a few messages
        await new Promise(resolve => setTimeout(resolve, 30000));

        dumper.stopDump();
        dumper.close();

        expect(fs.existsSync("temp.json")).toBe(true);

        const data: TwitchCommentDumpTD = JSON.parse(fs.readFileSync("temp.json", "utf8"));

        expect(data.comments).not.toBeUndefined();
        // expect(data.emotes).not.toBeUndefined();
        expect(data.streamer).not.toBeUndefined();

        expect(data.comments[0].content_offset_seconds).toBeGreaterThan(0);

        fs.unlinkSync("temp.json");

    }, 40000);
    */

    /*
    test("Render", async () => {
        if (
            !fs.existsSync("./tests/tmp/TwitchDownloaderCLI.exe") &&
            !fs.existsSync("./tests/tmp/TwitchDownloaderCLI")
        ) {
            console.warn("Skipping render test, no executable found");
            return;
        }

        const bin =
            process.platform === "win32"
                ? "./tests/tmp/TwitchDownloaderCLI.exe"
                : "./tests/tmp/TwitchDownloaderCLI";
        const ffmpeg_bin =
            process.platform === "win32"
                ? "./tests/tmp/ffmpeg.exe"
                : "./tests/tmp/ffmpeg";
        const args: string[] = [];

        if (!bin || !fs.existsSync(bin)) {
            throw new Error(`TwitchDownloaderCLI not installed: ${bin}`);
        }

        // if (!ffmpeg_bin || !fs.existsSync(ffmpeg_bin)) {
        //     throw new Error(`FFmpeg not installed: ${ffmpeg_bin}`);
        // }

        args.push("chatrender");
        args.push("--temp-path", "./tmp");
        // args.push("--ffmpeg-path", ffmpeg_bin);
        args.push("--input", "./tests/dump.json");
        args.push("--chat-height", "720");
        args.push("--chat-width", "300");
        args.push("--framerate", "60");
        args.push("--update-rate", "0");
        args.push("--font", "Arial");
        args.push("--font-size", "24");
        args.push("--outline");
        args.push("--background-color", "#00000000"); // alpha
        args.push("--generate-mask");
        args.push("--output", "./tmp/render.mp4");

        console.debug(args.join(" "));

        expect(() => {
            return new Promise<void>((resolve, reject) => {
                const proc = spawn(bin, args);

                proc.stdout.on("data", (data) => {
                    console.log(data.toString());
                });

                proc.stderr.on("data", (data) => {
                    console.error(data.toString());
                });

                proc.on("close", (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(
                            new Error(
                                `TwitchDownloaderCLI exited with code ${code}`
                            )
                        );
                    }
                });
            });
        }).rejects.not.toThrow();
    });
    */
});
