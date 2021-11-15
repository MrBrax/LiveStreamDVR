// const ChatClient = require("dank-twitch-irc").ChatClient;
import { ChatClient } from 'dank-twitch-irc';
// const fs = require('fs');
import fs from 'fs';
// const { format } = require('date-fns').format;
import { format, parse } from 'date-fns';
// import readline from 'readline';

const date_format = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'";

let client = new ChatClient();

let input_username = "pokelawls";
// let input_userid = "12943173";

let chatStream = fs.createWriteStream(`${input_username}.jsonline`, { flags: 'a' });

let comments = [];

function saveJSON() {

    console.log("program end");

    chatStream.end('\n');

    let date_start = "test1";

    let input_userid = comments[0]['channel_id'];

    let jsondata = {
        "comments": comments,
        "video": {
            "created_at": date_start, // fake
            "description": "",
            "duration": "1h0s", // fake
            "id": 0, // fake
            "language": "en",
            "published_at": date_start, // fake
            "thumbnail_url": "", // fake
            "title": "Chat Dump", // fake
            "type": "archive", // fake
            "url": "", // fake
            "user_id": input_userid,
            "user_name": input_username,
            "view_count": 1000,
            "viewable": "public"
        }
    }

    fs.writeFileSync(`${input_username}.json`, JSON.stringify(jsondata));

    /*
    // let file = fs.readFileSync(`${input_username}.jsonline`);
    const fileStream = fs.createReadStream(`${input_username}.jsonline`);

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

    console.log("finished");
}

process.on('exit', function () {
    console.log('exit fired');
    saveJSON();
})

process.on('beforeExit', function () {
console.log('beforeExit fired')
})
process.on('exit', function () {
console.log('exit fired')
})

// signals
process.on('SIGUSR1', function () {
console.log('SIGUSR1 fired')
process.exit(1)
})
process.on('SIGTERM', function () {
console.log('SIGTERM fired')
process.exit(1)
})
process.on('SIGPIPE', function () {
console.log('SIGPIPE fired')
})
process.on('SIGHUP', function () {
console.log('SIGHUP fired')
process.exit(1)
})
process.on('SIGTERM', function () {
console.log('SIGTERM fired')
process.exit(1)
})
process.on('SIGINT', function () {
console.log('SIGINT fired')
process.exit(1)
})
process.on('SIGBREAK', function () {
console.log('SIGBREAK fired')
})
process.on('SIGWINCH', function () {
console.log('SIGWINCH fired')
})


client.on("ready", () => console.debug("Successfully connected to chat"));
client.on("close", (error) => {
    if (error != null) {
        console.error("Client closed due to error", error);
    }
    console.log("chat end!!");
    chatStream.end('\n');
});

client.on("PRIVMSG", (msg) => {

    // 2021-11-14T03:38:58.626Z
    let thetime = format(msg.serverTimestamp, date_format);

    let fmt_offset = 0;

    if(comments.length > 0){
        let first_comment_date = parse(comments[0]['created_at'], date_format, msg.serverTimestamp);
        let diff = ( msg.serverTimestamp.getTime() - first_comment_date.getTime() ) / 1000;
        fmt_offset = diff;
    }

    let fmt_emotes = [];
    msg.emotes.forEach(element => {
        fmt_emotes.push({
            "_id": element.id,
            "begin": element.startIndex,
            "end": element.endIndex,
        });
        // console.debug(`Emote added (${element.id}): ${element.startIndex} to ${element.endIndex}`);
    });

    // console.log(msg.badges);
    // console.log(msg.badgeInfo);

    let fmt_fragments = [];
    let text_buffer = "";

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
                        "text": text_buffer
                    })
                    // console.debug(`Push text buffer: '${text_buffer}' ${emote['begin']}:${emote['end']}`);
                    text_buffer = ""
                }

                if (i + 1 == emote['end']) {
                    // emoticon node
                    fmt_fragments.push({
                        "emoticon": {
                            "emoticon_id": emote["_id"]
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
            "text": msg.messageText
        })
        // console.debug(`No emotes, push text: '${msg.messageText}'`);
    }

    let fmt_badges = [];
    msg.badges.forEach(element => {
        fmt_badges.push({
            "_id": element.name,
            "version": element.version,
        });
    });

    let message = {
        "_id": comments.length + 1,
        "channel_id": msg.channelID,
        "commenter": {
            "_id": msg.senderUserID,
            "bio": "dummy", // fake
            "created_at": thetime, // no access to account creation
            "display_name": msg.displayName,
            "name": msg.senderUsername,
            "type": "user",
            "updated_at": thetime,
        },
        "content_id": 1337,
        "content_offset_seconds": fmt_offset, // hmm
        "content_type": "video",
        "created_at": thetime,
        "message": {
            "body": msg.messageText,
            "emoticons": fmt_emotes,
            "fragments": fmt_fragments,
            "is_action": false,
            "user_badges": fmt_badges,
            "user_color": msg.colorRaw || "#FFFFFF",
            "user_notice_params": {},
        },
        "source": "chat",
        "state": "published",
        "updated_at": thetime,
    };

    // console.debug(JSON.stringify(message, null, 2));

    chatStream.write(JSON.stringify(message) + "\n");
    comments.push(message);

    console.debug(`[#${msg.channelName}] <${thetime}> ${msg.displayName}: ${msg.messageText}`);
    // console.debug(`\t ${JSON.stringify(msg.emotes)}`);
});

// See below for more events

client.connect();
client.join(input_username);

// console.log("ended?");