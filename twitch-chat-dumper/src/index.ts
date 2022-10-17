import chalk from 'chalk';
import minimist from 'minimist';
import { TwitchChat } from './TwitchChat';
// import { ChatDumper } from './ChatDumper.ts.bak';

const argv = minimist(process.argv.slice(2));

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

// const dumper = new ChatDumper(argv.channel, argv.output, argv.overwrite, argv.notext);
const dumper = new TwitchChat(channel, userid, date);

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

try {
    dumper.startDump(output);
} catch (error) {
    console.log(`Could not start dumper: ${(error as Error).message}`)
}

dumper.on("chat", (message) => {
    const text = message.isItalic ? chalk.italic(message.parameters) : message.parameters;
    // if (message.tags?.emotes) {
    //     console.debug(message.tags.emotes);
    // }
    console.log(`${chalk.red(message.date?.toISOString())} <${dumper.channel_login}> ${Object.keys(message.user?.badges || []).join(",")} ${chalk.hex(message.user?.color || "#FFFFFF")(message.user?.displayName)}: ${text}`);
});

dumper.on("command", (message) => {
    console.debug(message);
});

dumper.on("ban", (nick, duration, message) => {
    console.log(`Banned ${nick} for ${duration} seconds: ${message.parameters}`);
});