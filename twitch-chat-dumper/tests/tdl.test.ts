import { TwitchComment, TwitchCommentDumpTD, TwitchCommentMessageFragment, TwitchCommentEmoticons, TwitchCommentUserBadge } from "../../common/Comments";
import fs from "node:fs";

describe("TwitchDownloader compliance", () => {
    test("Dump", () => {

        const data: TwitchCommentDumpTD = JSON.parse(fs.readFileSync("./tests/dump.json", "utf8"));

        expect(data.comments).not.toBeUndefined();
        expect(data.emotes).not.toBeUndefined();
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
        expect(typeof comment.commenter.type).toBe("string");
        expect(typeof comment.commenter.updated_at).toBe("string");
        expect(typeof comment.message.body).toBe("string");
        expect(typeof comment.message.emoticons).toBe("object");
        expect(typeof comment.message.fragments).toBe("object");
        expect(typeof comment.message.user_badges).toBe("object");
        expect(typeof comment.message.user_color).toBe("string");
        expect(typeof comment.message.bits_spent).toBe("number");
        expect(typeof comment.message.is_action).toBe("boolean");
        expect(typeof comment.more_replies).toBe("boolean");
        expect(typeof comment.created_at).toBe("string");
        expect(typeof comment.source).toBe("string");
        expect(typeof comment.state).toBe("string");
        expect(typeof comment.updated_at).toBe("string");

        const fragment = comment.message.fragments[0];
        expect(typeof fragment.text).toBe("string");
        expect(typeof fragment.emoticon).toBe("object");

        expect(typeof data.video.start).toBe("number");
        expect(typeof data.video.end).toBe("number");

    });

});