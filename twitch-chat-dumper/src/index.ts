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

const show_raw = argv.raw;
const show_chat = argv.showchat;
const show_commands = argv.showcommands;
const show_subs = argv.showsubs;
const show_bans = argv.showbans;

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

if (output) {
    console.log(chalk.green(`Starting chat dump to file: ${output}`));
    try {
        dumper.startDump(output);
    } catch (error) {
        console.log(`Could not start dumper: ${(error as Error).message}`)
    }
} else {
    console.log(chalk.red('No output file specified, only showing chat'));
}

if (show_chat) {
    console.log(chalk.green('Showing chat'));
    dumper.on("chat", (message) => {
        console.log(`${chalk.red(message.getTime())} <${dumper.channel_login}:${dumper.userCount}>${message.getUser()?.displayBadges()}${message.getFormattedUser()}: ${message.getFormattedText()}`);
    });
}

if (show_bans) {
    console.log(chalk.green('Showing bans'));
    dumper.on("ban", (nick, duration, message) => {
        console.log(`${chalk.red(message.getTime())} <${dumper.channel_login}:${dumper.userCount}> ${chalk.redBright(`Banned ${nick} for ${duration} seconds (${dumper.bannedUserCount} total)`)}`);
    });
}

if (show_commands) {
    console.log(chalk.green('Showing commands'));
    dumper.on("command", (message) => {
        console.debug(message);
    });
}

if (show_subs) {
    console.log(chalk.green('Showing subs'));
    dumper.on("sub", (displayName, months, planName, subMessage, message) => {
        console.log(`${chalk.red(message.getTime())} <${dumper.channel_login}:${dumper.userCount}> ${displayName} subscribed for ${months} months (${planName}): ${subMessage}`);
    });
}

if (show_raw) {
    console.log(chalk.green('Showing raw'));
    dumper.on("raw", (message) => {
        console.log(chalk.bgGray.whiteBright(message));
    });
}