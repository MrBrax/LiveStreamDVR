import chalk from "chalk";
import { format } from "date-fns";
import fs from "node:fs";
import path from "node:path";
import { BaseConfigDataFolder } from "./BaseConfig";
import { ClientBroker } from "./ClientBroker";
import { Config } from "./Config";

export enum LOGLEVEL {
    ERROR = "ERROR",
    WARNING = "WARNING",
    INFO = "INFO",
    DEBUG = "DEBUG",
    FATAL = "FATAL",
    SUCCESS = "SUCCESS",
    EXEC = "EXEC",
}

export interface LogLine {
    module: string;
    time: number;
    level: LOGLEVEL;
    text: string;
    pid?: number;
    metadata?: any;
    g?: string; // git hash
}

export class Log {

    public static currentDate = "";
    public static lines: LogLine[] = [];

    public static websocket_buffer: LogLine[] = [];
    public static websocket_timer: NodeJS.Timeout | undefined;

    static readonly LOG_COLORS = {
        [LOGLEVEL.ERROR]: chalk.red,
        [LOGLEVEL.WARNING]: chalk.yellow,
        [LOGLEVEL.INFO]: chalk.blue,
        [LOGLEVEL.DEBUG]: chalk.gray,
        [LOGLEVEL.FATAL]: chalk.red,
        [LOGLEVEL.SUCCESS]: chalk.green,
        [LOGLEVEL.EXEC]: chalk.redBright,
    };

    static readonly LOG_LEVELS = {
        [LOGLEVEL.INFO]: "INFO",
        [LOGLEVEL.SUCCESS]: "INFO",
        [LOGLEVEL.DEBUG]: "DEBUG",
        [LOGLEVEL.WARNING]: "ERROR",
        [LOGLEVEL.ERROR]: "ERROR",
        [LOGLEVEL.FATAL]: "ERROR",
        [LOGLEVEL.EXEC]: "EXEC",
    };

    static readonly Level = LOGLEVEL;
    // static readonly INFO = "INFO";
    // static readonly SUCCESS = "SUCCESS";
    // static readonly DEBUG = "DEBUG";
    // static readonly WARNING = "WARNING";

    static readTodaysLog(): void {
        console.log(chalk.blue("Read today's log..."));
        const today = format(new Date(), "yyyy-MM-dd");
        const filename = `${today}.log`;
        const filepath = path.join(BaseConfigDataFolder.logs, filename);
        const jsonlinename = `${filepath}.jsonline`;

        if (!fs.existsSync(filepath)) {
            return;
        }

        const lines = fs.readFileSync(jsonlinename, "utf8").split("\n");
        // console.log(`Read ${lines.length} lines from ${jsonlinename}`);
        this.lines = lines.map(line => line.length > 0 ? JSON.parse(line) : null).filter(line => line !== null);
        console.log(chalk.green(`✔ Parsed ${this.lines.length} lines from ${jsonlinename}`));
        this.currentDate = today;
    }

    /**
     * Log a message to the log file. Do NOT call before loading the config.
     * 
     * @param level 
     * @param module 
     * @param text 
     * @param metadata 
     * @returns 
     */
    static logAdvanced(level: LOGLEVEL, module: string, text: string, metadata?: any): void {
        if (!Config.debug && level == Log.Level.DEBUG) return;

        // if testing, don't log
        if (process.env.NODE_ENV == "test") {
            console.log(chalk.yellow("[TEST]"), level, module, text);
            return;
        }

        // check if folder exists
        if (!fs.existsSync(BaseConfigDataFolder.logs)) {
            throw new Error("Log folder does not exist!");
        }

        if (!Log.currentDate) {
            console.error(chalk.bgRed.whiteBright("😤 Log called before date was set!"));
        }

        // clear old logs from memory
        Log.nextLog();

        // today's filename in Y-m-d format
        const date = new Date();

        const loglevel_category = Log.LOG_LEVELS[level];

        const filename_combined     = format(date, "yyyy-MM-dd") + ".log";
        const filename_separate     = format(date, "yyyy-MM-dd") + "." + level + ".log";
        const filename_level        = format(date, "yyyy-MM-dd") + "." + loglevel_category + ".jsonline";

        const filepath_combined     = path.join(BaseConfigDataFolder.logs, filename_combined);
        const filepath_separate     = path.join(BaseConfigDataFolder.logs, filename_separate);
        const filepath_level        = path.join(BaseConfigDataFolder.logs, filename_level);

        // console.debug(`Logging to ${filepath_separate}`);

        const jsonlinename_combined = `${filepath_combined}.jsonline`;
        const jsonlinename_separate = `${filepath_separate}.jsonline`;
        const jsonlinename_level    = `${filepath_level}.jsonline`;

        const dateFormat = "yyyy-MM-dd HH:mm:ss.SSS";
        const dateString = format(date, dateFormat);

        // write cleartext
        const textOutput = `${dateString} ${process.pid}+${Config.getInstance().gitHash?.substring(0, 4)} | ${module} <${level}> ${text}`;
        fs.appendFileSync(filepath_combined, `${textOutput}\n`);
        // fs.appendFileSync(filepath_separate, textOutput + "\n");
        // fs.appendFileSync(filepath_level, textOutput + "\n");

        // if docker, output to stdout
        // if (TwitchConfig.getInstance().cfg("docker")) {
        //     console.log(textOutput);
        // }

        console.log(
            this.LOG_COLORS[level](`${dateString} | ${module} <${level}> ${text}`)
        );

        const log_data: LogLine = {
            module: module,
            time: Date.now(),
            level: level,
            text: text,
            pid: process.pid,
            g: Config.getInstance().gitHash,
        };

        if (metadata !== undefined) log_data.metadata = metadata;

        let stringy_log_data;
        try {
            stringy_log_data = JSON.stringify(log_data);
        } catch (e) {
            console.error(chalk.bgRed.whiteBright("😤 Error stringifying log data!"), log_data);
            return;
        }

        // write jsonline
        fs.appendFileSync(jsonlinename_combined, `${stringy_log_data}\n`);
        // fs.appendFileSync(jsonlinename_separate, stringy_log_data + "\n");
        // fs.appendFileSync(jsonlinename_level, stringy_log_data + "\n");
        this.lines.push(log_data);

        // send over websocket, probably extremely slow
        if (Config.getInstance().cfg<boolean>("websocket_log")) {

            this.websocket_buffer.push(log_data);

            if (Log.websocket_timer) clearTimeout(Log.websocket_timer);
            Log.websocket_timer = setTimeout(() => {
                // console.debug(`Sending ${this.websocket_buffer.length} lines over websocket`);
                ClientBroker.broadcast({
                    server: true,
                    action: "log",
                    data: this.websocket_buffer,
                });
                this.websocket_buffer = [];
                Log.websocket_timer = undefined;
            }, 5000);

        }

        /*
        ClientBroker.broadcast({
            action: "log",
            data: log_data,
        });

        TwitchLog.websocket_timer = setTimeout(() => {
                    ClientBroker.send("log", TwitchLog.websocket_buffer);
                    TwitchLog.websocket_buffer = [];
                    TwitchLog.websocket_timer = undefined;
                }, 100);
            } else {
        */

    }

    private static nextLog(): void {
        const today = format(new Date(), "yyyy-MM-dd");
        if (today != Log.currentDate) {
            console.log(chalk.yellow(`Clearing log memory from ${Log.currentDate} to ${today}`));
            Log.currentDate = today;
            Log.lines = [];
            Log.logAdvanced(Log.Level.INFO, "log", `Starting new log file for ${today}, git hash ${Config.getInstance().gitHash}`);
        }
    }

    /**
     * Fetch n lines from a log file.
     * @param date 
     * @param fromLine 
     * @throws
     * @returns 
     */
    static fetchLog(date: string, fromLine = 0): LogLine[] {

        // return lines from n to end
        if (date == this.currentDate) {
            // console.debug(`Fetching ${this.lines.length} lines starting from ${fromLine} from memory`);
            return this.lines.slice(fromLine);
        }

        const filename = `${date}.log`;
        const filepath = path.join(BaseConfigDataFolder.logs, filename);
        const jsonlinename = `${filepath}.jsonline`;

        if (!fs.existsSync(filepath)) {
            throw new Error(`File not found: ${filepath}`);
        }

        const lines = fs.readFileSync(jsonlinename, "utf8").split("\n");
        const parsed_lines: LogLine[] = lines.map(line => line.length > 0 ? JSON.parse(line) : null).filter(line => line !== null);
        // console.debug(`Fetched ${parsed_lines.length} lines from ${jsonlinename}`);
        return parsed_lines;
    }

}