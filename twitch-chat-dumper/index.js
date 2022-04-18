import minimist from 'minimist';
import { ChatDumper } from './ChatDumper.js';

const argv = minimist(process.argv.slice(2));

const dumper = new ChatDumper(argv.channel, argv.output, argv.overwrite);

process.on('exit', function () {
    console.log('Exit fired, save JSON before shutting down');
    if(dumper.comments) dumper.saveJSON();
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
    dumper.stop();
})

process.on('SIGTERM', function () {
    console.log('SIGTERM fired')
    // process.exit(1)
    dumper.stop();
})

process.on('SIGPIPE', function () {
    console.log('SIGPIPE fired')
})

process.on('SIGHUP', function () {
    console.log('SIGHUP fired')
    // process.exit(1)
    dumper.stop();
})

process.on('SIGTERM', function () {
    console.log('SIGTERM fired')
    // process.exit(1)
    dumper.stop();
})

process.on('SIGINT', function () {
    console.log('SIGINT fired')
    // process.exit(1)
    dumper.stop();
})

process.on('SIGBREAK', function () {
    console.log('SIGBREAK fired')
})

process.on('SIGWINCH', function () {
    console.log('SIGWINCH fired')
})

dumper.start();