import { TwitchChat } from "../src/TwitchChat";

const ircMessage =
            "@badge-info=;badges=broadcaster/1;client-nonce=997dcf443c31e258c1d32a8da47b6936;color=#0000FF;display-name=abc;emotes=PogChamp:14-22;first-msg=0;flags=0-6:S.7;id=eb24e920-8065-492a-8aea-266a00fc5126;mod=0;room-id=713936733;subscriber=0;tmi-sent-ts=1642786203573;turbo=0;user-id=713936733;user-type= :abc!abc@abc.tmi.twitch.tv PRIVMSG #xyz :HeyGuys hello PogChamp hello";

const testData = {
    tags: {
        "badge-info": null,
        badges: { broadcaster: "1" },
        color: "#0000FF",
        "display-name": "abc",
        emotes: {
            "PogChamp": [
                {"startPosition":"14","endPosition":"22"},
            ],
        },
        "first-msg": "0",
        id: "eb24e920-8065-492a-8aea-266a00fc5126",
        mod: "0",
        "room-id": "713936733",
        subscriber: "0",
        "tmi-sent-ts": "1642786203573",
        turbo: "0",
        "user-id": "713936733",
        "user-type": null,
    },
    source: { nick: "abc", host: "abc@abc.tmi.twitch.tv" },
    command: { command: "PRIVMSG", channel: "#xyz" },
    parameters: "HeyGuys hello PogChamp hello",
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
        expect(result?.getUser()?.badges).toStrictEqual({ broadcaster: "1" });
        expect(result?.getUser()?.id).toBe("713936733");
        
        expect(result?.parameters).toBe("HeyGuys hello PogChamp hello");
        // console.debug("TAGS", result?.tags?.emotes?.["PogChamp"][0]);
        expect(
            result?.parameters?.substring(
                parseInt(result?.tags?.emotes?.["PogChamp"][0].startPosition || "0"),
                parseInt(result?.tags?.emotes?.["PogChamp"][0].endPosition || "0")
            )
        ).toBe("PogChamp");

        expect(result?.command).toStrictEqual({ command: "PRIVMSG", channel: "#xyz" });
        expect(result?.source).toStrictEqual({ nick: "abc", host: "abc@abc.tmi.twitch.tv" });
        expect(result?.date?.toISOString()).toBe("2022-01-21T17:30:03.573Z");
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
            expect(dump.message.fragments.map(f => f.text).join("")).toBe("HeyGuys hello PogChamp hello");
            expect(dump.message.emoticons.length).toBe(1);
            expect(dump.message.fragments.length).toBe(3); // text, emote, text (including space)
            expect(dump.message.user_badges.length).toBe(1);
        } else {
            throw new Error("No result");
        }
    });

});
