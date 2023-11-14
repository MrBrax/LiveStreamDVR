import chalk from 'chalk';
import minimist from 'minimist';
import { TwitchChat } from './TwitchChat';
import fs from 'fs';
import { TwitchCommentDumpTD } from '../../common/Comments';
// import { ChatDumper } from './ChatDumper.ts.bak';

function main(argv: Record<string, string>): void {

    /*
        --channel
        --userid
        --date
        --output
    */

    const channel = argv.channel;
    const userid = argv.userid;
    const date = argv.date;
    const output = argv.output;
    const help = argv.help || argv.h;

    const show_raw = argv.raw;
    const show_chat = argv.showchat;
    const show_commands = argv.showcommands;
    const show_subs = argv.showsubs;
    const show_bans = argv.showbans;

    const no_color = argv.nocolor;

    if (no_color) {
        TwitchChat.chalk.level = 0;
    }

    if ( help ) {
        console.log(`
        Usage: twitch-chat-dumper [options]

        Options:
        --channel <channel>         Channel to dump chat from
        --userid <userid>           User ID of channel to dump chat from
        --date <date>               Start date of chat dump
        --output <output>           Output file to dump chat to
        --raw                       Show raw chat
        --showchat                  Show chat
        --showcommands              Show commands
        --showsubs                  Show subs
        --showbans                  Show bans
        --nocolor                   Disable color output
        --help                      Show help
        `);
        return;
    }

    if (channel) {

        // const dumper = new ChatDumper(argv.channel, argv.output, argv.overwrite, argv.notext);
        const dumper = new TwitchChat(channel, userid, date);
        dumper.connect();

        process.on('exit', function () {
            console.log('Exit fired, save JSON before shutting down');
            dumper.close();
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
            // process.exit(1)
            dumper.close();
        })

        process.on('SIGTERM', function () {
            console.log('SIGTERM fired')
            // process.exit(1)
            dumper.close();
        })

        process.on('SIGPIPE', function () {
            console.log('SIGPIPE fired')
        })

        process.on('SIGHUP', function () {
            console.log('SIGHUP fired')
            // process.exit(1)
            dumper.close();
        })

        process.on('SIGTERM', function () {
            console.log('SIGTERM fired')
            // process.exit(1)
            dumper.close();
        })

        process.on('SIGINT', function () {
            console.log('SIGINT fired')
            // process.exit(1)
            dumper.close();
        })

        process.on('SIGBREAK', function () {
            console.log('SIGBREAK fired')
        })

        process.on('SIGWINCH', function () {
            console.log('SIGWINCH fired')
        })

        if (output) {
            console.log(TwitchChat.chalk.green(`Starting chat dump to file: ${output}`));
            try {
                dumper.startDump(output);
            } catch (error) {
                console.error(`Could not start dumper: ${(error as Error).message}`);
                if (error instanceof Error && error.message.toString().includes('EEXIST')) {
                    process.exit(1);
                    return;
                }
            }
        } else {
            console.log(TwitchChat.chalk.red('No output file specified, only showing chat'));
        }

        if (show_chat) {
            console.log(TwitchChat.chalk.green('Showing chat'));
            dumper.on("chat", (message) => {
                if (dumper.hideAbuseUsers && message.user && message.user.abuseMessageCount > 3) {
                    if (!message.user.abuseWarning) {
                        message.user.abuseWarning = true;
                        `${TwitchChat.chalk.red(message.getTime())} <${dumper.channel_login}:${dumper.userCount}>${message.getFormattedUser()} has been hidden internally due to abuse`;
                    }
                    return;
                }
                console.log(`${TwitchChat.chalk.red(message.getTime())} <${dumper.channel_login}:${dumper.userCount}>${message.getUser()?.displayBadges()}${message.getFormattedUser()}${message.isAbuse ? '⚠️' : ''}: ${message.getFormattedText()}`);
            });
            dumper.on("comedy", (total, delta, message) => {
                console.log(`${TwitchChat.chalk.red(message.getTime())} <${dumper.channel_login}:${dumper.userCount}> ${TwitchChat.chalk.yellow(`Comedy: ${total} (+${delta})`)}`);
            });
        }

        if (show_bans) {
            console.log(TwitchChat.chalk.green('Showing bans'));
            dumper.on("ban", (nick, duration, message) => {
                console.log(`${TwitchChat.chalk.red(message.getTime())} <${dumper.channel_login}:${dumper.userCount}> ${TwitchChat.chalk.redBright(`Banned ${nick} for ${duration} seconds (${dumper.bannedUserCount} total)`)}`);
            });
        }

        if (show_commands) {
            console.log(TwitchChat.chalk.green('Showing commands'));
            dumper.on("command", (message) => {
                console.debug(message);
            });
        }

        if (show_subs) {
            console.log(TwitchChat.chalk.green('Showing subs'));
            dumper.on("sub", (displayName, months, planName, subMessage, message) => {
                console.log(`${TwitchChat.chalk.red(message.getTime())} <${dumper.channel_login}:${dumper.userCount}> ${displayName} subscribed for ${months} months (${planName}): ${subMessage}`);
            });
        }

        if (show_raw) {
            console.log(TwitchChat.chalk.green('Showing raw'));
            dumper.on("raw", (message) => {
                console.log(TwitchChat.chalk.bgGray.whiteBright(message));
            });
        }

    } else if (argv.change_offset) {

        if (fs.existsSync(argv.change_offset)) {
            const relative_offset = argv.offset;
            if (!relative_offset) {
                console.log(TwitchChat.chalk.red('No offset specified'));
            } else {
                const data = fs.readFileSync(argv.change_offset, 'utf8');
                const json: TwitchCommentDumpTD = JSON.parse(data);
                for (const comment of json.comments) {
                    if ( comment.content_offset_seconds === undefined || comment.content_offset_seconds === null ) {
                        throw new Error(`Comment ${comment._id} has no offset`);
                    }
                    comment.content_offset_seconds += parseInt(relative_offset);
                }
                fs.writeFileSync(argv.change_offset, JSON.stringify(json));
                console.log(TwitchChat.chalk.green(`Changed offset by ${relative_offset} seconds for ${json.comments.length} comments`));
            }

        } else {
            console.log(TwitchChat.chalk.red(`File does not exist: ${argv.change_offset}`));
        }

    } else {
        console.log(TwitchChat.chalk.red('No channel specified (--channel)'));
    }

}

if (require.main === module) {
    const argv = minimist(process.argv.slice(2));
    main(argv);
} else {
    console.log(TwitchChat.chalk.red('Not main module'));
}