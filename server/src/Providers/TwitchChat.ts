import chalk from "chalk";
import { randomUUID } from "crypto";
import { EventEmitter } from "events";
import fs from "fs";
import { WebSocket } from "ws";
import { TwitchComment, TwitchCommentDump, TwitchCommentMessageFragment } from "../../../common/Comments";
import { TwitchHelper } from "./Twitch";

interface TwitchIRCMessage {
    // tags?: Record<string, TagTypes>;
    tags?: Tags;
    source?: Source;
    command?: Command;
    parameters?: string;
}

interface Tags {
    badges?: Badge;
    color?: string;
    "display-name"?: string;
    "emote-only"?: string;
    emotes?: Emote;
    id?: string;
    mod?: string;
    "room-id"?: string;
    subscriber?: string;
    turbo?: string;
    "tmi-sent-ts"?: string;
    "user-id"?: string;
    "user-type"?: string;
}

interface Badge {
    [key: string]: string;
}

interface Pos {
    startPosition: string;
    endPosition: string;
}

interface Emote {
    [key: string]: Pos[];
}

interface Command {
    command?: string;
    channel?: string;
    isCapRequestEnabled?: boolean;
    botCommand?: string;
    botCommandParams?: string;
}

interface Source {
    nick?: string;
    host?: string;
}

// interface Parameters {
// 
// }

type TagTypes = string | Badge | Emote | string[] | null;

export class TwitchChat extends EventEmitter {
    public ws: WebSocket;
    public channel_login = "";
    public channel_id = "";
    public cap = false;
    public dumpStream: fs.WriteStream | undefined;
    public dumpFilename: string | undefined;
    public dumpStart: Date | undefined;

    constructor(channel_login: string, channel_id: string) {
        super();
        this.channel_login = channel_login;
        this.channel_id = channel_id;
        this.ws = new WebSocket("wss://irc-ws.chat.twitch.tv:443");
        this.ws.onopen = () => {
            this.ws.send("PASS blah");
            this.ws.send(
                `NICK justinfan${Math.floor(Math.random() * 1000000)}`
            );
            this.ws.send(`JOIN #${this.channel_login}`);
            this.ws.send("CAP REQ :twitch.tv/commands twitch.tv/tags");
        };
        this.ws.onmessage = (event) => {
            const messages = event.data.toString().split("\r\n");  // The IRC message may contain one or more messages.
            messages.forEach(message => {
                if (message === "") return;
                // console.log(event.data);
                const parsedMessage = this.parseMessage(message.toString());
                // console.log(message);
                if (parsedMessage) {
                    /*
                    if (parsedMessage.tags) {
                        console.log("\t", chalk.yellow(JSON.stringify(parsedMessage.tags)));
                    } else {
                        console.log("\t", chalk.red(event.data.toString().trim()));
                    }
                    */
                    this.emit("message", parsedMessage);

                    if (parsedMessage.command?.command == "PING") {
                        this.ws.send("PONG :tmi.twitch.tv");
                        console.log(chalk.green("PONG"));
                    }

                    if (parsedMessage.command?.isCapRequestEnabled) {
                        console.log(chalk.green("CAP REQ ACK"));
                        this.cap = true;
                    }

                    if (this.dumpStream && this.dumpStart && parsedMessage.command?.command === "PRIVMSG") {
                        const offset = (new Date().getTime() - this.dumpStart.getTime()) / 1000;
                        this.dumpStream.write(JSON.stringify(this.messageToDump(parsedMessage, this.channel_id, offset)) + "\n");
                    }

                }
            });
        };
        this.ws.onclose = () => {
            console.log("Connection closed");
            this.stopDump();
            this.emit("close");
        };
    }

    public close() {
        this.ws.close();
    }

    // Parses an IRC message and returns a JSON object with the message's
    // component parts (tags, source (nick and host), command, parameters).
    // Expects the caller to pass a single message. (Remember, the Twitch
    // IRC server may send one or more IRC messages in a single message.)

    parseMessage(message: string) {
        const parsedMessage: TwitchIRCMessage = {
            // Contains the component parts.
            tags: undefined,
            source: undefined,
            command: undefined,
            parameters: undefined,
        };

        // The start index. Increments as we parse the IRC message.

        let idx = 0;

        // The raw components of the IRC message.

        let rawTagsComponent = undefined;
        let rawSourceComponent = undefined;
        let rawCommandComponent = undefined;
        let rawParametersComponent = undefined;

        // If the message includes tags, get the tags component of the IRC message.

        if (message[idx] === "@") {
            // The message includes tags.
            const endIdx = message.indexOf(" ");
            rawTagsComponent = message.slice(1, endIdx);
            idx = endIdx + 1; // Should now point to source colon (:).
        }

        // Get the source component (nick and host) of the IRC message.
        // The idx should point to the source part; otherwise, it's a PING command.

        if (message[idx] === ":") {
            idx += 1;
            const endIdx = message.indexOf(" ", idx);
            rawSourceComponent = message.slice(idx, endIdx);
            idx = endIdx + 1; // Should point to the command part of the message.
        }

        // Get the command component of the IRC message.

        let endIdx = message.indexOf(":", idx); // Looking for the parameters part of the message.
        if (-1 == endIdx) {
            // But not all messages include the parameters part.
            endIdx = message.length;
        }

        rawCommandComponent = message.slice(idx, endIdx).trim();

        // Get the parameters component of the IRC message.

        if (endIdx != message.length) {
            // Check if the IRC message contains a parameters component.
            idx = endIdx + 1; // Should point to the parameters part of the message.
            rawParametersComponent = message.slice(idx);
        }

        // Parse the command component of the IRC message.

        parsedMessage.command = this.parseCommand(rawCommandComponent);

        // Only parse the rest of the components if it's a command
        // we care about; we ignore some messages.

        if (undefined == parsedMessage.command) {
            // Is null if it's a message we don't care about.
            return undefined;
        } else {
            if (undefined != rawTagsComponent) {
                // The IRC message contains tags.
                // console.debug("rawTagsComponent", rawTagsComponent);
                parsedMessage.tags = this.parseTags(rawTagsComponent);
            }

            if (rawSourceComponent) {
                parsedMessage.source = this.parseSource(rawSourceComponent);
            }

            parsedMessage.parameters = rawParametersComponent;
            if (rawParametersComponent && rawParametersComponent[0] === "!") {
                // The user entered a bot command in the chat window.
                parsedMessage.command = this.parseParameters(
                    rawParametersComponent,
                    parsedMessage.command
                );
            }
        }

        return parsedMessage;
    }

    parseTags(tags: string) {
        // badge-info=;badges=broadcaster/1;color=#0000FF;...

        const tagsToIgnore = ["client-nonce", "flags"];

        const dictParsedTags: Record<string, TagTypes> = {}; // Holds the parsed list of tags.
        // The key is the tag's name (e.g., color).
        const parsedTags = tags.split(";");

        parsedTags.forEach((tag) => {
            const parsedTag = tag.split("="); // Tags are key/value pairs.
            const tagValue = parsedTag[1] === "" ? null : parsedTag[1];
            const tagName = parsedTag[0];
            if (tagName == "badges") {
                // Switch on tag name
            } else if (tagName == "badge-info") {
                // badges=staff/1,broadcaster/1,turbo/1;

                if (tagValue) {
                    const dict: Badge = {}; // Holds the list of badge objects.
                    // The key is the badge's name (e.g., subscriber).
                    const badges = tagValue.split(",");
                    badges.forEach((pair) => {
                        const badgeParts = pair.split("/");
                        dict[badgeParts[0]] = badgeParts[1];
                    });
                    dictParsedTags[parsedTag[0]] = dict;
                } else {
                    dictParsedTags[parsedTag[0]] = null;
                }
            } else if (tagName == "emotes") {
                // emotes=25:0-4,12-16/1902:6-10

                if (tagValue) {
                    const dictEmotes: Emote = {}; // Holds a list of emote objects.
                    // The key is the emote's ID.
                    const emotes = tagValue.split("/");
                    emotes.forEach((emote) => {
                        const emoteParts = emote.split(":");

                        const textPositions: Pos[] = []; // The list of position objects that identify
                        // the location of the emote in the chat message.
                        const positions = emoteParts[1].split(",");
                        positions.forEach((position) => {
                            const positionParts = position.split("-");
                            textPositions.push({
                                startPosition: positionParts[0],
                                endPosition: positionParts[1],
                            });
                        });

                        dictEmotes[emoteParts[0]] = textPositions;
                    });

                    dictParsedTags[parsedTag[0]] = dictEmotes;
                } else {
                    dictParsedTags[parsedTag[0]] = null;
                }
            } else if (tagName == "emote-sets") {
                // emote-sets=0,33,50,237

                if (tagValue) {
                    const emoteSetIds = tagValue.split(","); // Array of emote set IDs.
                    dictParsedTags[parsedTag[0]] = emoteSetIds;
                }
            } else {
                // If the tag is in the list of tags to ignore, ignore
                // it; otherwise, add it.

                if (tagsToIgnore.includes(parsedTag[0])) {
                    // Do nothing.
                } else {
                    dictParsedTags[parsedTag[0]] = tagValue;
                }
            }
        });

        return dictParsedTags;
    }

    parseCommand(rawCommandComponent: string): Command | undefined {
        let parsedCommand = undefined;
        const commandParts = rawCommandComponent.split(" ");

        switch (commandParts[0]) {
        case "JOIN":
        case "PART":
        case "NOTICE":
        case "CLEARCHAT":
        case "HOSTTARGET":
        case "PRIVMSG":
            parsedCommand = {
                command: commandParts[0],
                channel: commandParts[1],
            };
            break;
        case "PING":
            parsedCommand = {
                command: commandParts[0],
            };
            break;
        case "CAP":
            parsedCommand = {
                command: commandParts[0],
                isCapRequestEnabled: (commandParts[2] === "ACK") ? true : false,
                // The parameters part of the messages contains the 
                // enabled capabilities.
            };
            break;
        case "GLOBALUSERSTATE":  // Included only if you request the /commands capability.
            // But it has no meaning without also including the /tags capability.
            parsedCommand = {
                command: commandParts[0],
            };
            break;
        case "USERSTATE":   // Included only if you request the /commands capability.
        case "ROOMSTATE":   // But it has no meaning without also including the /tags capabilities.
            parsedCommand = {
                command: commandParts[0],
                channel: commandParts[1],
            };
            break;
        case "RECONNECT":  
            console.log("The Twitch IRC server is about to terminate the connection for maintenance.");
            parsedCommand = {
                command: commandParts[0],
            };
            break;
        case "421":
            console.log(`Unsupported IRC command: ${commandParts[2]}`);
            return undefined;
        case "001":  // Logged in (successfully authenticated). 
            parsedCommand = {
                command: commandParts[0],
                channel: commandParts[1],
            };
            break;
        case "002":  // Ignoring all other numeric messages.
        case "003":
        case "004":
        case "353":  // Tells you who else is in the chat room you're joining.
        case "366":
        case "372":
        case "375":
        case "376":
            console.log(`numeric message: ${commandParts[0]}`);
            return undefined;
        default:
            console.log(`\nUnexpected command: ${commandParts[0]} (${rawCommandComponent}) \n`);
            return undefined;
        }

        return parsedCommand;
    }
    parseSource(rawSourceComponent: string): Source | undefined {
        if (null == rawSourceComponent) {  // Not all messages contain a source
            return undefined;
        }
        else {
            const sourceParts = rawSourceComponent.split("!");
            return {
                nick: (sourceParts.length == 2) ? sourceParts[0] : undefined,
                host: (sourceParts.length == 2) ? sourceParts[1] : sourceParts[0],
            };
        }
    }

    parseParameters(rawParametersComponent: string, command: Command): Command {
        const idx = 0;
        const commandParts = rawParametersComponent.slice(idx + 1).trim(); 
        const paramsIdx = commandParts.indexOf(" ");

        if (-1 == paramsIdx) { // no parameters
            command.botCommand = commandParts.slice(0); 
        }
        else {
            command.botCommand = commandParts.slice(0, paramsIdx); 
            command.botCommandParams = commandParts.slice(paramsIdx).trim();
            // TODO: remove extra spaces in parameters string
        }

        return command;
    }

    messageToDump(message: TwitchIRCMessage, channel_id: string, offset_seconds: number): TwitchComment {

        if (!message.parameters) {
            throw new Error("messageToDump: message.parameters is undefined");
        }

        const emoticons = [];
        if (message.tags?.emotes) {
            for (const emote in message.tags.emotes) {
                emoticons.push({
                    "_id": emote,
                    "begin": parseInt(message.tags.emotes[emote][0].startPosition),
                    "end": parseInt(message.tags.emotes[emote][0].endPosition),
                });
            }
        }

        const fragments: TwitchCommentMessageFragment[] = [];
        const words = message.parameters.split(" ");

        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const fragment: TwitchCommentMessageFragment = {
                "text": word,
                "emoticon": undefined,
            };

            if (emoticons.length > 0) {
                for (let j = 0; j < emoticons.length; j++) {
                    const emoticon = emoticons[j];
                    if (emoticon.begin <= fragment.text.length) {
                        fragment.emoticon = {
                            "emoticon_id": emoticon._id,
                        };
                        break;
                    }
                }
            }

            fragments.push(fragment);
        }

        // merge fragments with only text
        const mergedFragments: TwitchCommentMessageFragment[] = [];
        let currentFragment: TwitchCommentMessageFragment | undefined = undefined;
        for (let i = 0; i < fragments.length; i++) {
            const fragment = fragments[i];
            if (fragment.emoticon) {
                if (currentFragment) {
                    mergedFragments.push(currentFragment);
                }
                currentFragment = fragment;
            } else {
                if (currentFragment) {
                    currentFragment.text += " " + fragment.text;
                }
                else {
                    currentFragment = fragment;
                }
            }
        }
        if (currentFragment) {
            mergedFragments.push(currentFragment);
        }

        return {
            _id: randomUUID().substring(0, 8),
            channel_id: channel_id,
            content_id: "",
            content_offset_seconds: offset_seconds,
            content_type: "video",
            commenter: {
                _id: "",
                bio: "",
                created_at: "",
                display_name: message.source?.nick || "",
                logo: "",
                name: message.source?.nick || "",
                type: "",
                updated_at: "",
            },
            message: {
                body: message.parameters || "",
                emoticons: emoticons,
                fragments: mergedFragments,
                user_badges: [],
                user_color: "",
            },
            created_at: new Date().toISOString(),
            source: "twitch",
            state: "published",
            updated_at: new Date().toISOString(),
        };
    }

    public startDump(filename: string) {
        if (fs.existsSync(filename)) {
            throw new Error(`File ${filename} already exists`);
        }
        this.dumpFilename = filename;
        this.dumpStream = fs.createWriteStream(`${this.dumpFilename}.line`, { flags: "a" });
        this.dumpStart = new Date();
        console.log(`Starting chat dump to of ${this.channel_login} to ${this.dumpFilename}.`);
    }

    public stopDump() {
        if (this.dumpStream && this.dumpFilename && this.dumpStart) {
            this.dumpStream.close();
            const dumpData = fs.readFileSync(`${this.dumpStream.path}`);
            const dumpLines = dumpData.toString().split("\n").filter((line) => line.length > 0);
            const dumpAllComments = dumpLines.map((line) => JSON.parse(line));

            const finalDump: TwitchCommentDump = {
                comments: dumpAllComments,
                video: {
                    created_at: "",
                    description: "",
                    duration: TwitchHelper.twitchDuration(Math.round((new Date().getTime() - this.dumpStart.getTime()) / 1000)),
                    id: "",
                    language: "",
                    published_at: "",
                    thumbnail_url: "",
                    title: "Chat Dump",
                    type: "archive",
                    url: "",
                    user_id: this.channel_id,
                    user_name: this.channel_login,
                    view_count: 0,
                    viewable: "",

                    start: 0,
                    end: (new Date().getTime() - this.dumpStart.getTime()) / 1000,
                },
            };
            fs.writeFileSync(this.dumpFilename, JSON.stringify(finalDump));
            fs.unlinkSync(this.dumpStream.path);
            this.dumpStream = undefined;
            console.log(`Chat dump of ${this.channel_login} to ${this.dumpFilename} stopped.`);
        } else {
            console.log(`Chat dump of ${this.channel_login} to ${this.dumpFilename} was not started.`);
        }
    }

}

export declare interface TwitchChat {
    on(event: "message", listener: (message: TwitchIRCMessage) => void): this;
}
