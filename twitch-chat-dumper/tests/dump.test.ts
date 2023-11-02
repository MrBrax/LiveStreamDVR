import { TwitchChat } from "../src/TwitchChat";

const ircMessage =
            "@badge-info=;badges=premium/1;color=#0000FF;display-name=abc;emote-only=1;emotes=70433:0-8,10-18;first-msg=0;flags=;id=44b71d8d-7c29-4cc5-a551-a15d5f9e58fb;mod=0;returning-chatter=0;room-id=105458682;subscriber=0;tmi-sent-ts=1698928813930;turbo=0;user-id=1234;user-type= :abc!abc@abc.tmi.twitch.tv PRIVMSG #xyz :KappaRoss KappaRoss";
const testData = {
    tags: {
        "badge-info": null,
        badges: { premium: "1" },
        color: "#0000FF",
        "display-name": "abc",
        "emote-only": "1",
        emotes: {
            // "PogChamp": [
            //     {"startPosition":"14","endPosition":"22"},
            // ],
            "70433": [
                { startPosition: "0", endPosition: "8" },
                { startPosition: "10", endPosition: "18" },
            ],
        },
        "first-msg": "0",
        id: "44b71d8d-7c29-4cc5-a551-a15d5f9e58fb",
        mod: "0",
        "returning-chatter": "0",
        "room-id": "105458682",
        subscriber: "0",
        "tmi-sent-ts": "1698928813930",
        turbo: "0",
        "user-id": "1234",
        "user-type": null,
    },
    source: { nick: "abc", host: "abc@abc.tmi.twitch.tv" },
    command: { command: "PRIVMSG", channel: "#xyz" },
    parameters: "KappaRoss KappaRoss",
};

describe("TwitchChat", () => {
    test("parseMessage", async () => {
        const chat = new TwitchChat("username");
        const message = chat.parseMessage(ircMessage);
        expect(JSON.stringify(message)).toBe(JSON.stringify(testData));
    });

    test("handleMessage", async () => {
        const chat = new TwitchChat("username");
        // const message = chat.parseMessage(ircMessage);
        const result = chat.handleMessage(ircMessage);
        expect(result).not.toBe(undefined);
        // console.log(result);
        expect(result?.getUser()?.isMod).toBe(false);
        expect(result?.getUser()?.isTurbo).toBe(false);
        expect(result?.getUser()?.messageCount).toBe(0);
        // expect(result?.getUser()?.login).toBe("abc");
        expect(result?.getUser()?.displayName).toBe("abc");
        expect(result?.getUser()?.color).toBe("#0000FF");
        expect(result?.getUser()?.badges).toStrictEqual({ premium: "1" });
        expect(result?.getUser()?.id).toBe("1234");

        expect(result?.parameters).toBe("KappaRoss KappaRoss");
        expect(Object.keys(result?.tags?.emotes || {}).length).toBe(1);
        // console.debug("TAGS", result?.tags?.emotes?.["PogChamp"][0]);
        // expect(
        //     result?.parameters?.substring(
        //         parseInt(result?.tags?.emotes?.["PogChamp"][0].startPosition || "0"),
        //         parseInt(result?.tags?.emotes?.["PogChamp"][0].endPosition || "0")
        //     )
        // ).toBe("PogChamp");

        expect(result?.command).toStrictEqual({ command: "PRIVMSG", channel: "#xyz" });
        expect(result?.source).toStrictEqual({ nick: "abc", host: "abc@abc.tmi.twitch.tv" });
        expect(result?.date?.toISOString()).toBe("2023-11-02T12:40:13.930Z");
    });

    test("messageToDump", async () => {
        const chat = new TwitchChat("username");
        const result = chat.handleMessage(ircMessage);
        if (result) {
            const dump = chat.messageToDump(result, "1234", 0);
            // console.log(dump);
            expect(dump._id).not.toBeUndefined();
            expect(dump.channel_id).not.toBeUndefined();
            expect(dump.content_id).toBe("");
            expect(dump.content_offset_seconds).toBe(0);
            expect(dump.content_type).toBe("video");
            expect(dump.message.fragments.map(f => f.text).join("")).toBe("KappaRoss KappaRoss");
            expect(dump.message.emoticons.length).toBe(2);
            expect(dump.message.fragments.length).toBe(3);
            expect(dump.message.user_badges.length).toBe(1);
        } else {
            throw new Error("No result");
        }
    });

});
