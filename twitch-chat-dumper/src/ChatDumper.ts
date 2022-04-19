import { ChatClient } from 'dank-twitch-irc';
import fs from 'fs';
import { format, parse } from 'date-fns';
import { TwitchComment, TwitchCommentMessageFragment, TwitchCommentUserBadge } from "../../common/Comments";

export class ChatDumper {

    client: ChatClient;
    input_username: string;
    file_output: string;
    overwrite: boolean;
    comments: TwitchComment[];
    chatStream: fs.WriteStream | undefined;
    textStream: fs.WriteStream | undefined;
    
    constructor(input_username: string, file_output: string, overwrite = false) {
        this.client = new ChatClient();
        this.input_username = input_username;
        this.file_output = file_output;
        this.overwrite = overwrite;
        this.comments = [];
        this.setup();
    }

    setup() {

        const date_format = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'";

        if (!this.input_username) {
            throw new Error("No channel supplied.");
        }

        if (!this.file_output) {
            throw new Error("No output file supplied.");
        }

        if (!this.overwrite && (fs.existsSync(this.file_output) || fs.existsSync(`${this.file_output}.line`) || fs.existsSync(`${this.file_output}.txt`))) {
            throw new Error("Chat file already exists, force with overwrite.");
        }

        this.chatStream = fs.createWriteStream(`${this.file_output}.line`, { flags: 'a' });
        this.textStream = fs.createWriteStream(`${this.file_output}.txt`, { flags: 'a' });

        this.client.on("ready", () => console.debug("Successfully connected to chat"));

        this.client.on("close", (error) => {
            if (error != null) {
                console.error("Client closed due to error", error);
            }
            console.error("Chat ended abruptly");
            this.saveJSON();
        });

        this.client.on("PRIVMSG", (msg) => {

            if (!this.chatStream || !this.textStream) return;

            // 2021-11-14T03:38:58.626Z
            let thetime = format(msg.serverTimestamp, date_format);

            let fmt_offset = 0;

            // calculate offset from first comment
            if (this.comments.length > 0) {
                let first_comment_date = parse(this.comments[0]['created_at'], date_format, msg.serverTimestamp);
                let diff = (msg.serverTimestamp.getTime() - first_comment_date.getTime()) / 1000;
                fmt_offset = diff;
            }

            if(fmt_offset == 0) console.error("Comment offset at 0");

            // parse emotes
            let fmt_emotes: { _id: string, begin: number; end: number; }[] = [];
            msg.emotes.forEach(element => {
                fmt_emotes.push({
                    "_id": element.id,
                    "begin": element.startIndex,
                    "end": element.endIndex,
                });
                // console.debug(`Emote added (${element.id}): ${element.startIndex} to ${element.endIndex}`);
            });

            let fmt_fragments: TwitchCommentMessageFragment[] = [];
            let text_buffer = "";

            // parse message and emotes, creating fragments
            if (fmt_emotes.length > 0) {
                let chars = msg.messageText.split("");
                for (let i = 0; i < chars.length; i++) {

                    let letter = chars[i];

                    // console.debug(`Parse char ${i}/${chars.length}: '${letter}'`);

                    text_buffer += letter

                    for (let emote of fmt_emotes) {


                        if (i + 1 == emote['begin']) {
                            // text node
                            fmt_fragments.push({
                                "text": text_buffer,
                                "emoticon": null,
                            })
                            // console.debug(`Push text buffer: '${text_buffer}' ${emote['begin']}:${emote['end']}`);
                            text_buffer = ""
                        }

                        if (i + 1 == emote['end']) {
                            // emoticon node
                            fmt_fragments.push({
                                "emoticon": {
                                    "emoticon_id": emote["_id"],
                                    "emoticon_set_id": "",
                                },
                                "text": text_buffer
                            })
                            // console.debug(`Push emote buffer: '${emote["_id"]}' -- '${text_buffer}' -- ${emote['begin']}:${emote['end']}`);
                            // print("Append emoticon: " + text_buffer)
                            text_buffer = ""
                        }

                    }

                }
            } else {
                fmt_fragments.push({
                    "text": msg.messageText,
                    "emoticon": null,
                })
                // console.debug(`No emotes, push text: '${msg.messageText}'`);
            }

            // parse badges
            let fmt_badges: TwitchCommentUserBadge[] = [];
            msg.badges.forEach(element => {
                fmt_badges.push({
                    "_id": element.name,
                    "version": element.version,
                });
            });

            let message = {
                "_id": `uid_${this.comments.length + 1}`,
                "channel_id": msg.channelID,
                "commenter": {
                    "_id": msg.senderUserID,
                    "bio": "dummy", // fake
                    "created_at": thetime, // no access to account creation
                    "display_name": msg.displayName,
                    "name": msg.senderUsername,
                    "type": "user",
                    "updated_at": thetime,
                    "logo": "dummy" // fake
                },
                "content_id": "1337",
                "content_offset_seconds": fmt_offset, // hmm
                "content_type": "video",
                "created_at": thetime,
                "message": {
                    "body": msg.messageText,
                    // "emoticons": fmt_emotes, // old version
                    "emoticons": null,
                    "fragments": fmt_fragments,
                    "is_action": false,
                    "user_badges": fmt_badges,
                    "user_color": msg.colorRaw || "#FFFFFF",
                    // "user_notice_params": {},
                },
                "source": "chat",
                "state": "published",
                "updated_at": thetime,
            };

            // console.debug(JSON.stringify(message, null, 2));

            this.chatStream.write(JSON.stringify(message) + "\n");
            this.comments.push(message);

            let delay = ((new Date().getTime() - msg.serverTimestamp.getTime()) / 1000).toFixed(2);

            console.debug(`[#${msg.channelName}] <${thetime} (${delay}d, ${fmt_offset}s)> ${msg.displayName}: ${msg.messageText}`);

            this.textStream.write(`<${thetime},${fmt_offset}> ${msg.displayName}: ${msg.messageText}\n`);
            // console.debug(`\t ${JSON.stringify(msg.emotes)}`);
        });

        this.client.on("connecting", () => {
            console.log("Connecting...");
        });

        this.client.on("JOIN", (joinMessage) => {
            console.log(`Joined chat room: ${joinMessage.channelName}`);
        });

        this.client.on("PART", (partMessage) => {
            console.log(`Left chat room: ${partMessage.channelName}`);
        });

        // console.log("ended?");

    }

    start() {

        if (!this.input_username) throw new Error("No username provided");

        if (!this.chatStream || !this.textStream) {
            throw new Error("File streams have not been set up.");
        }

        // See below for more events
        this.client.connect().catch(reason => {
            console.log("connect error", reason);
        });

        this.client.join(this.input_username).catch( reason => {
            console.log("join error", reason);
        });

    }

    stop() {
        if (!this.client) return;
        this.client.close();
        console.log(`Stopped chat dump of ${this.input_username}`);
    }

    saveJSON() {

        if (this.comments.length <= 0) return;
        if (!this.chatStream || !this.textStream) return;

        console.log("Save JSON...");

        this.chatStream.end('\n');
        this.textStream.end('\n');

        let date_start = this.comments[0]['created_at'];

        let input_userid = this.comments[0]['channel_id'];

        let duration_seconds = this.comments[this.comments.length - 1].content_offset_seconds;


        // var sec_num = parseInt(duration_seconds, 10)
        var hours = Math.floor(duration_seconds / 3600)
        var minutes = Math.floor(duration_seconds / 60) % 60
        var seconds = duration_seconds % 60;
        let duration = `${hours}h${minutes}m${seconds}s`;

        let jsondata = {
            "comments": this.comments,
            "video": {
                "created_at": date_start, // fake
                "description": "",
                "duration": duration, // fake
                "id": 0, // fake
                "language": "en",
                "published_at": date_start, // fake
                "thumbnail_url": "", // fake
                "title": "Chat Dump", // fake
                "type": "archive", // fake
                "url": "", // fake
                "user_id": input_userid,
                "user_name": this.input_username,
                "view_count": 1000,
                "viewable": "public",

                "start": 0,
                "end": duration_seconds, // not standard?
            }
        }

        fs.writeFileSync(`${this.file_output}`, JSON.stringify(jsondata));

        /*
        // let file = fs.readFileSync(`${this.input_username}.jsonline`);
        const fileStream = fs.createReadStream(`${this.input_username}.jsonline`);

        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });
        // Note: we use the crlfDelay option to recognize all instances of CR LF
        // ('\r\n') in input.txt as a single line break.
        
        for await (const line of rl) {
            // Each line in input.txt will be successively available here as `line`.
            // console.log(`Line from file: ${line}`);
            if(!line) continue;

            const jsonline = JSON.parse(line);

            jsondata['comments'].push(jsonline);

        }
        
        console.log("save json");
        */

        console.log("JSON saved, hopefully.");
    }

}