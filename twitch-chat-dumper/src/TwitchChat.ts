import chalk from "chalk";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import { WebSocket } from "ws";
import { TwitchComment, TwitchCommentDumpTD, TwitchCommentMessageFragment, TwitchCommentEmoticons, TwitchCommentUserBadge } from "../../common/Comments";

function getNiceDuration(duration: number) {
    // format 1d 2h 3m 4s

    const days = Math.floor(duration / (60 * 60 * 24));
    const hours = Math.floor((duration - (days * 60 * 60 * 24)) / (60 * 60));
    const minutes = Math.floor((duration - (days * 60 * 60 * 24) - (hours * 60 * 60)) / 60);
    const seconds = duration - (days * 60 * 60 * 24) - (hours * 60 * 60) - (minutes * 60);

    let str = "";

    if (days > 0) str += days + "d ";
    if (hours > 0) str += hours + "h ";
    if (minutes > 0) str += minutes + "m ";
    if (seconds > 0) str += seconds + "s";

    return str.trim();

}

function twitchDuration(seconds: number): string {
    return getNiceDuration(seconds).replaceAll(" ", "").trim();
    // return trim(str_replace(" ", "", self::getNiceDuration($seconds)));
}

type UserType = "" | "admin" | "global_mod" | "staff";

interface TwitchIRCMessage {
    // tags?: Record<string, TagTypes>;
    tags?: Tags;
    source?: Source;
    command?: Command;
    parameters?: string;
    user?: TwitchIRCUser;
    date?: Date;
    isItalic?: boolean;
    isAction?: boolean;
}

interface Tags {
    // badges?: Badge;
    badges?: Record<string, string>;
    color?: string;
    "display-name"?: string;
    "emote-only"?: string;
    emotes?: Emote;
    id?: string;
    mod?: "1" | "0"; // number
    "room-id"?: string;
    subscriber?: "1" | "0";
    turbo?: "1" | "0";
    "tmi-sent-ts"?: string;
    "user-id"?: string;
    "user-type"?: UserType;
    "badge-info"?: Record<string, string>;
    login?: string;

    "msg-id"?: string;
    "msg-param-cumulative-months"?: string;
    "msg-param-months"?: string;
    "msg-param-multimonth-duration"?: string;
    "msg-param-multimonth-tenure"?: string;
    "msg-param-should-share-streak"?: string;
    "msg-param-streak-months"?: string;
    "msg-param-sub-plan-name"?: string;
    "msg-param-sub-plan"?: string;
    "msg-param-was-gifted"?: string;
    "system-msg"?: string;
    "ban-duration"?: string;
    "target-user-id"?: string;
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

interface TwitchIRCUser {
    nick: string;
    id: string;
    login: string;
    displayName: string;
    color: string;
    badges: Badge;
    isMod: boolean;
    isSubscriber: boolean;
    isTurbo: boolean;
    // isBroadcaster: boolean;
    // isVip: boolean;
    // isStaff: boolean;
    // isGlobalMod: boolean;
    // isBot: boolean;
    ban_date?: Date;
    ban_duration?: number;
    messageCount: number;
}

// interface Parameters {
// 
// }

type TagTypes = string | Badge | Emote | string[] | null;

export class TwitchChat extends EventEmitter {
    declare public ws: WebSocket;
    public channel_login = "";
    public channel_id = "";
    public cap = false;
    public dumpStream: fs.WriteStream | undefined;
    public dumpFilename: string | undefined;
    public dumpStart: Date | undefined;

    public static readonly liveTerms = ["live", "hi youtube", "hi yt", "pog", "pogchamp"];
    public lastLiveEmit: Date | undefined;
    public lastTenMessages: TwitchIRCMessage[] = [];
    public users: Record<string, TwitchUser> = {};
    public startDate = new Date();

    public static chalk = new chalk.Instance({ level: 3 });
    public hideAbuseUsers = true;

    public comedyScore = 0;

    get bannedUserCount() {
        return Object.values(this.users).filter(u => u.ban_date && u.ban_date.getTime() + ((u.ban_duration || 0) * 1000) > Date.now()).length;
    }

    get userCount() {
        return Object.keys(this.users).length;
    }

    constructor(channel_login: string, channel_id?: string, start_date?: string) {
        super();
        this.channel_login = channel_login;
        if (channel_id) this.channel_id = channel_id;
        if (start_date) this.startDate = new Date(start_date);
        // this.connect();
    }

    public connect() {
        this.ws = new WebSocket("wss://irc-ws.chat.twitch.tv:443");
        this.ws.onopen = () => {
            this.loginAnonymous();
            this.join(this.channel_login);
            this.ws.send("CAP REQ :twitch.tv/commands twitch.tv/tags");
        };
        this.ws.onmessage = (event) => {
            const messages = event.data.toString("utf-8").split("\r\n");  // The IRC message may contain one or more messages.
            messages.forEach(message => {
                if (message === "") return;
                this.emit("raw", message);
                this.handleMessage(message.toString());
            });
        };
        this.ws.onclose = (ev) => {
            console.log("Connection closed", ev.code, ev.reason);
            this.stopDump();
            this.emit("close");
        };
    }

    public handleMessage(message: string): TwitchMessage | undefined {

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

            const messageClass = new TwitchMessage(parsedMessage);

            const userId = messageClass.getTag<string>("user-id");
            const roomId = messageClass.getTag<string>("room-id");

            if (messageClass.getTag("tmi-sent-ts")) {
                messageClass.date = new Date(parseInt(messageClass.getTag("tmi-sent-ts") || "0"));
            }

            if (userId && messageClass.getCommandName() === "PRIVMSG") {
                if (!this.users[userId]) {
                    this.users[userId] = new TwitchUser({
                        nick: parsedMessage.tags?.login || "",
                        id: parsedMessage.tags?.["user-id"] || "",
                        login: parsedMessage.tags?.login || "",
                        displayName: parsedMessage.tags?.["display-name"] || "",
                        color: parsedMessage.tags?.color || "",
                        badges: parsedMessage.tags?.["badge-info"] || parsedMessage.tags?.badges || {},
                        messageCount: 0,
                        isMod: parsedMessage.tags?.mod === "1",
                        isSubscriber: parsedMessage.tags?.subscriber === "1",
                        isTurbo: parsedMessage.tags?.turbo === "1",
                    });
                } else {
                    this.users[userId].messageCount++;
                }

                messageClass.user = this.users[userId];

                if (messageClass.getTag<string>("mod") === "1") {
                    messageClass.user.isMod = true;
                }
                if (messageClass.getTag<string>("subscriber") === "1") {
                    messageClass.user.isSubscriber = true;
                }
                if (messageClass.getTag<string>("turbo") === "1") {
                    messageClass.user.isTurbo = true;
                }

                if (messageClass.isAbuse) {
                    messageClass.user.abuseMessageCount++;
                }

                if (messageClass.getTag("badges") || messageClass.getTag("badge-info")) {
                    const allBadges: Record<string, string> = {};
                    const badgeInfo = messageClass.getTag<Record<string, string>>("badge-info");
                    const badges = messageClass.getTag<Record<string, string>>("badges");
                    if (badgeInfo) {
                        Object.keys(badgeInfo).forEach(badge => {
                            allBadges[badge] = badgeInfo[badge];
                        });
                    }
                    if (badges) {
                        Object.keys(badges).forEach(badge => {
                            allBadges[badge] = badges[badge];
                        });
                    }
                    this.users[userId].badges = allBadges;
                    // console.debug(messageClass.tags);
                    /*
                    console.debug(
                        "Updated badges for user",
                        badgeInfo,
                        badges,
                        userId,
                        this.users[userId].badges
                    );
                    */
                }


            }

            if (roomId) {
                this.channel_id = roomId;
            }

            if (messageClass.getCommandName() === "PRIVMSG") {
                this.emit("chat", messageClass);
            } else {
                this.emit("command", messageClass);
            }

            // match +2 and -2 messages to comedy score
            if (messageClass.getCommandName() === "PRIVMSG") {
                const comedyMatch = messageClass.parameters?.match(/(\+|-)(\d+)/);
                if (comedyMatch) {
                    const comedyScore = parseInt(comedyMatch[2]);
                    if (comedyMatch[1] === "+") {
                        this.comedyScore += comedyScore;
                    } else {
                        this.comedyScore -= comedyScore;
                    }
                    // console.log(TwitchChat.chalk.green(`Comedy score: ${this.comedyScore}`));
                    this.emit("comedy", this.comedyScore, comedyScore, messageClass);
                }
            }

            this.emit("message", messageClass);

            if (messageClass.getCommandName() == "PING") {
                this.ws.send("PONG :tmi.twitch.tv");
                // console.log(chalk.green("PONG"));
                this.emit("pong");
            }

            if (messageClass.getCommand()?.isCapRequestEnabled) {
                console.log(TwitchChat.chalk.green("CAP REQ ACK"));
                this.cap = true;
                this.emit("connected");
            }

            // dump to file
            if (this.dumpStream && this.dumpStart && messageClass.getCommandName() === "PRIVMSG") {
                const offset = (new Date().getTime() - this.startDate.getTime()) / 1000;
                this.dumpStream.write(JSON.stringify(this.messageToDump(messageClass, this.channel_id, offset)) + "\n");
            }

            this.lastTenMessages.push(parsedMessage);
            if (this.lastTenMessages.length > 10) {
                this.lastTenMessages.shift();
            }

            // if more than half of the last 10 messages contain a live term, emit live
            if (this.lastTenMessages.filter(message => TwitchChat.liveTerms.some(term => message.parameters?.includes(term))).length > 5) {
                if (!this.lastLiveEmit || (new Date().getTime() - this.lastLiveEmit.getTime()) > 1000 * 60) {
                    this.emit("live", messageClass);
                    this.lastLiveEmit = new Date();
                }
            }

            if (messageClass.getCommandName() === "CLEARCHAT") {

                const targetUserId = messageClass.getTag<string>("target-user-id");

                if (messageClass.parameters && targetUserId && this.users[targetUserId]) {
                    const user = this.users[targetUserId];
                    user.ban_date = new Date();
                    user.ban_duration = parseInt(messageClass.getTag("ban-duration") || "0");
                }

                this.emit(
                    "ban",
                    messageClass.parameters,
                    parseInt(messageClass.getTag("ban-duration") || "0"),
                    messageClass
                );

                // console.debug(`${Object.keys(this.users).length} users`);
            }

            if (messageClass.getCommandName() === "USERNOTICE") {
                // if (parsedMessage.tags?.msg_id === "sub") {
                //     this.emit("sub", parsedMessage.source?.nick);
                // }
                // console.debug(parsedMessage.tags);

                if (userId && this.users[userId]) {
                    this.users[userId].login = messageClass.getTag("login") || "";
                }

                if (messageClass.getTag("msg-id") === "sub" || messageClass.getTag("msg-id") === "resub" || messageClass.getTag("msg-id") === "subgift") {
                    this.emit(
                        "sub",
                        messageClass.getTag("display-name"),
                        parseInt(messageClass.getTag("msg-param-cumulative-months") || "0"),
                        messageClass.getTag<string>("msg-param-sub-plan-name"),
                        messageClass.parameters,
                        messageClass
                    );
                }
            }

            return messageClass;

        }
    }

    public close() {
        this.ws.close();
        if (this.dumpStream) {
            this.stopDump();
        }
    }

    public send(message: string) {
        this.ws.send(`PRIVMSG #${this.channel_login} :${message}`);
    }

    public loginAnonymous() {
        this.ws.send("PASS blah");
        this.ws.send(`NICK justinfan${Math.floor(Math.random() * 1000000)}`);
    }

    public join(channel: string) {
        this.ws.send(`JOIN #${channel}`);
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

        let rawTagsComponent: string | undefined = undefined;
        let rawSourceComponent: string | undefined = undefined;
        let rawCommandComponent: string | undefined = undefined;
        let rawParametersComponent: string | undefined = undefined;

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

            // action message
            if (rawParametersComponent && rawParametersComponent.charCodeAt(0) === 1 && rawParametersComponent.charCodeAt(rawParametersComponent.length - 1) === 1) {
                parsedMessage.parameters = rawParametersComponent.slice(1, rawParametersComponent.length - 1);
                if (parsedMessage.parameters.startsWith("ACTION")) {
                    parsedMessage.parameters = parsedMessage.parameters.slice(6).trim();
                    // parsedMessage.command = {
                    //     command: "ACTION",
                    // };
                    parsedMessage.isItalic = true;
                    parsedMessage.isAction = true;
                }
            }

            // clean up message text from hidden characters
            // if (parsedMessage.parameters) {
            //     parsedMessage.parameters = parsedMessage.parameters.replace(/[\u0000-\u001f]/g, "");
            // }

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
            // Switch on tag name
            if (tagName == "badges" || tagName == "badge-info") {
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
        let parsedCommand: Command | undefined = undefined;
        const commandParts = rawCommandComponent.split(" ");

        switch (commandParts[0]) {
            case "JOIN":
            case "PART":
            case "NOTICE":
            case "CLEARCHAT": // user gets banned lol
            case "HOSTTARGET":
            case "PRIVMSG":
                parsedCommand = {
                    command: commandParts[0],
                    channel: commandParts[1],
                };
                break;
            case "USERNOTICE":
                parsedCommand = {
                    command: commandParts[0],
                };
                // console.log("USERNOTICE", commandParts, rawCommandComponent);
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
            case "003": // Ignoring all other numeric messages.
            case "004": // Logged in (successfully authenticated).
            case "353":  // Tells you who else is in the chat room you're joining.
            case "366":  // End of /NAMES list.
            case "372":  // MOTD (message of the day).
            case "375": // Start of MOTD.
            case "376": // End of MOTD.
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

    messageToDump(message: TwitchMessage, channel_id: string, offset_seconds: number): TwitchComment {

        if (!message.parameters) {
            throw new Error("messageToDump: message.parameters is undefined");
        }

        const emoticons: TwitchCommentEmoticons[] = [];
        if (message.getTag('emotes')) {
            for (const emote in message.tags.emotes) {
                for (const pos of message.tags.emotes[emote]) {
                    emoticons.push({
                        _id: emote,
                        begin: parseInt(pos.startPosition),
                        end: parseInt(pos.endPosition),
                    });
                }
            }
        }

        // console.debug(`Got ${emoticons.length} emoticons`);

        const fragments: TwitchCommentMessageFragment[] = [];
        let lastEnd = 0;
        for (const emoticon of emoticons) {
            if (emoticon.begin > lastEnd) {
                fragments.push({
                    text: message.parameters.slice(lastEnd, emoticon.begin),
                    emoticon: null,
                });
            }
            fragments.push({
                text: message.parameters.slice(emoticon.begin, emoticon.end),
                emoticon: {
                    emoticon_id: emoticon._id,
                }
            });
            lastEnd = emoticon.end;
        }
        if (lastEnd < message.parameters.length) {
            fragments.push({
                text: message.parameters.slice(lastEnd),
                emoticon: null,
            });
        }

        /*
        const words = message.parameters.split(" ");

        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const fragment: TwitchCommentMessageFragment = {
                "text": word,
                "emoticon": null,
            };

            if (emoticons.length > 0) {
                // find emoticon based on entire message text position
                // i in this case is the word index, not the character index
                const emoticon = emoticons.find(e => e.begin <= i && e.end >= i);
                if (emoticon) {
                    fragment.emoticon = {
                        emoticon_id: emoticon._id,
                        // emoticon_set_id: message.tags["emote-sets"][0],
                    };
                } else {
                    console.debug(`No emoticon found for word ${word}`);
                }
            }

            fragments.push(fragment);
        }
        */

        // console.debug(`Got ${fragments.length} fragments`, fragments);

        // merge fragments with only text
        /*
        const mergedFragments: TwitchCommentMessageFragment[] = [];
        let currentFragment: TwitchCommentMessageFragment | undefined = undefined;
        for (let i = 0; i < fragments.length; i++) {
            const fragment = fragments[i];
            if (fragment.emoticon) {
                if (currentFragment) {
                    mergedFragments.push(currentFragment);
                }
                currentFragment = undefined;
                mergedFragments.push(fragment);
            } else {
                if (!currentFragment) {
                    currentFragment = {
                        text: fragment.text,
                        emoticon: null,
                    };
                } else {
                    currentFragment.text += " " + fragment.text;
                }
            }
        }
        if (currentFragment) {
            mergedFragments.push(currentFragment);
        }

        console.debug(`Merged ${fragments.length} fragments to ${mergedFragments.length}`);
        */

        const badges: TwitchCommentUserBadge[] = [];
        if (message.tags?.badges) {
            for (const badge in message.tags.badges) {
                badges.push({
                    "_id": badge,
                    "version": message.tags.badges[badge],
                });
            }
        }

        if (message.tags?.["badge-info"]) {
            for (const badge in message.tags["badge-info"]) {
                badges.push({
                    "_id": badge,
                    "version": message.tags["badge-info"][badge],
                });
            }
        }

        return {
            _id: message.tags?.id || randomUUID().substring(0, 8),
            channel_id: message.tags?.["room-id"] || channel_id,
            content_id: "",
            content_offset_seconds: offset_seconds,
            content_type: "video",
            commenter: {
                _id: message.tags?.["user-id"] || "",
                bio: "",
                created_at: (message.date || new Date()).toISOString(),
                display_name: message.tags?.["display-name"] || message.source?.nick || "",
                logo: "",
                name: message.source?.nick || "",
                type: "user",
                updated_at: (message.date || new Date()).toISOString(),
            },
            message: {
                body: message.parameters || "",
                emoticons: emoticons,
                fragments: fragments,
                user_badges: badges || null,
                user_color: message.tags?.color || "#FFFFFF",
                is_action: message.isAction || false,
            },
            created_at: (message.date || new Date()).toISOString(),
            source: "chat",
            state: "published",
            updated_at: (message.date || new Date()).toISOString(),
            more_replies: false,
        };
    }

    public startDump(filename: string) {
        if (this.dumpFilename) {
            throw new Error("Dump already started");
        }
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

            const finalDump: TwitchCommentDumpTD = {
                comments: dumpAllComments,
                video: {
                    created_at: this.dumpStart.toISOString(),
                    description: "",
                    duration: twitchDuration(Math.round((new Date().getTime() - this.dumpStart.getTime()) / 1000)),
                    id: "",
                    language: "",
                    published_at: this.dumpStart.toISOString(),
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
                streamer: {
                    name: this.channel_login,
                    id: parseInt(this.channel_id),
                },
            };
            fs.writeFileSync(this.dumpFilename, JSON.stringify(finalDump));
            fs.unlinkSync(this.dumpStream.path);
            console.log(`Chat dump of ${this.channel_login} to ${this.dumpFilename} stopped.`);
            this.dumpStream = undefined;
            this.dumpFilename = undefined;
            this.dumpStart = undefined;
        } else {
            console.log(`Chat dump of ${this.channel_login} to ${this.dumpFilename} was not started.`);
        }
    }

    public getUser(user_id: string): TwitchUser | undefined {
        return this.users[user_id];
    }

    public getBannedUsers(): TwitchUser[] {
        return Object.values(this.users).filter((user) => user.isBanned);
    }

    public clearUsers() {
        this.users = {};
    }

}

export class TwitchMessage {
    public date?: Date;
    public source?: Source;
    public command?: Command;
    public parameters?: string;
    public tags: Tags = {};
    public isAction: boolean;
    public user?: TwitchUser;

    constructor(message: TwitchIRCMessage) {
        this.date = message.date;
        this.source = message.source;
        this.command = message.command;
        this.parameters = message.parameters;
        this.tags = message.tags || {};
        this.isAction = message.isAction || false;
        // this.user = user;
    }

    public getTag<T>(tag: keyof Tags): T | undefined {
        if (this.tags) {
            const val = this.tags[tag];
            if (typeof val === "string") {
                return val.replace(/\\\\s/g, " ").replace(/\\s/g, " ") as unknown as T;
            }

            // parse as number
            // if (typeof val === "string" && !isNaN(val) && !isNaN(parseFloat(val))) {
            //     return parseInt(val) as unknown as T;
            // }

            return this.tags[tag] as T;
        }
        return undefined;
    }

    // public getEmotes(): Emote[] {
    //     if (this.tags && this.tags.emotes || this.tags?.["emote-sets"]) {
    //         return this.tags.emotes || this.tags["emote-sets"] || [];
    //     }
    //     return [];
    // }

    /*
    public getBadges(): Record<string, string> {
        if (this.tags && this.tags.badges) {
            return this.tags.badges;
        }
        return {};
    }
    */

    public getCommandName(): string | undefined {
        return this.command ? this.command.command : undefined;
    }

    public getCommand(): Command | undefined {
        return this.command;
    }

    public getUser(): TwitchUser | undefined {
        return this.user;
    }

    public getDate(): Date | undefined {
        return this.date;
    }

    public getTime(): string {
        return this.date ? this.date.toLocaleTimeString() + "." + this.date.getMilliseconds().toString().padStart(3, "0") : "";
    }

    public getFormattedText() {
        let text = this.isAction ? TwitchChat.chalk.italic(this.parameters) : this.parameters;
        // if (message.tags?.emotes) {
        //     console.debug(message.tags.emotes);
        // }
        text = text?.replaceAll(/\@(\w+)/g, TwitchChat.chalk.blueBright('@$1'));
        // text = text?.replaceAll(/\#(\w+)/g, chalk.blueBright('#$1'));

        // remove all hidden characters
        text = text?.replaceAll(/[\u{E000}-\u{F8FF}]/gu, "");
        return text;
    }

    public getFormattedUser(): string {
        const user = this.getUser();
        if (!user || user === undefined) return "";

        // if (this.user?.isBanned) {
        //     user = chalk.redBright(user);
        // }
        let text = "";
        if (user.isMod) {
            return TwitchChat.chalk.bold.underline.hex(user.color || "#FFFFFF")(user.displayName);
        } else {
            return TwitchChat.chalk.hex(user.color || "#FFFFFF")(user.displayName);
        }
    }

    private static abuseCharacters = [56320];
    get isAbuse(): boolean {
        const text = this.parameters;
        if (!text) return false;

        if (this.user && this.user.isMod) return false; // even though mods can be abusive lol

        // check for invisible characters
        if (text.match(/[\u{E000}-\u{F8FF}]/gu) || text.match(/[\u{FFF0}-\u{FFFF}]/gu)) {
            return true;
        }

        // check for abuse characters
        if (text.split("").map((c) => c.charCodeAt(0)).some((c) => TwitchMessage.abuseCharacters.includes(c))) {
            return true;
        }

        // check for links
        if (text.match(/https?:\/\/\S+/gi)) {
            return true;
        }

        return false;
    }

}

export class TwitchUser {
    public login: string;
    public id: string;
    public displayName: string;
    public color: string;
    public badges: Record<string, string>;
    public tags: Tags = {};
    public isMod = false;
    public isSubscriber = false;
    public isTurbo = false;
    // isBroadcaster: boolean;
    // isVip: boolean;
    // isStaff: boolean;
    // isGlobalMod: boolean;
    // isBot: boolean;
    public ban_date?: Date;
    public ban_duration?: number;
    public messageCount = 0;
    public abuseMessageCount = 0;
    public abuseWarning = false;

    constructor(user: TwitchIRCUser) {
        this.login = user.nick;
        this.id = user.id;
        this.displayName = user.displayName;
        this.color = user.color;
        this.badges = user.badges;
    }

    private static badgeEmojis: Record<string, string> = {
        "broadcaster": "👑",
        "moderator": "🛡️",
        "global_mod": "🌎",
        "admin": "👮",
        "bits": "💎",
        "subscriber": "🔴",
        "turbo": "🚀",
        "bot": "🤖",
        "partner": "🔵",
        "moments": /** coin/medal */ "🏅",
        "no_video": "👁️‍🗨️",
        "no_audio": "🔇",
        "vip": /** pumpkin */ "🎃", // probably only for halloween
        "glhf-pledge": /** keyboard key */ "⌨️",
        "sub-gifter": /** gift */ "🎁",
        "staff": "👨‍💼",
        "glitchcon2020": /** dinosaur */ "🦖",
        "game-developer": /** game controller */ "🎮",
        "twitchconEU2022": /** rose */ "🌹",
        "twitchconNA2022": /** palm tree */ "🌴",
        "hype-train": /** train */ "🚂",
    };
    public displayBadges(): string {
        const b = Object.keys(this.badges).map((badge) => {
            if (badge in TwitchUser.badgeEmojis && this.badges[badge]) {
                return TwitchUser.badgeEmojis[badge];
            }
            return `${badge}`; // badge.substring(0, 1).toUpperCase()
        });
        if (b && b.length > 0) {
            return " " + b.join("") + " ";
        } else {
            return " ";
        }
    }

    get isBanned(): boolean {
        return this.ban_date !== undefined && this.ban_duration !== undefined && this.ban_date.getTime() + (this.ban_duration * 1000) > new Date().getTime();
    }
}

export declare interface TwitchChat {

    on(event: "raw", listener: (message: string) => void): this;

    /**
     * When a message is posted to the chat, including commands.
     */
    on(event: "message", listener: (message: TwitchMessage) => void): this;

    on(event: "chat", listener: (message: TwitchMessage) => void): this;
    on(event: "command", listener: (message: TwitchMessage) => void): this;

    /**
     * Live prediction event based on chat messages
     */
    on(event: "live", listener: (message: TwitchMessage) => void): this;

    /**
     * When an user gets banned (timeout), actually when their messages get geleted
     */
    on(event: "ban", listener: (nick: string, duration: number, message: TwitchMessage) => void): this;

    /**
     * When an user subscribes to the channel or gifts subscriptions
     */
    on(event: "sub", listener: (displayName: string, months: number, planName: string, subMessage: string, message: TwitchMessage) => void): this;

    on(event: "connected", listener: () => void): this;

    on(event: "pong", listener: () => void): this;

    on(event: "comedy", listener: (totalScore: number, deltaScore: number, message: TwitchMessage) => void): this;
}
