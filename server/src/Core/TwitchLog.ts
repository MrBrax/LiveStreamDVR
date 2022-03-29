import chalk from "chalk";
import { format } from "date-fns";
import fs from "fs";
import path from "path";
import { BaseConfigFolder } from "./BaseConfig";
import { ClientBroker } from "./ClientBroker";
import { TwitchConfig } from "./TwitchConfig";

export enum LOGLEVEL {
    ERROR = "ERROR",
    WARNING = "WARNING",
    INFO = "INFO",
    DEBUG = "DEBUG",
    FATAL = "FATAL",
    SUCCESS = "SUCCESS",
}

export interface LogLine {
    module: string;
    date: number;
    level: LOGLEVEL;
    text: string;
    metadata?: any;
}

export class TwitchLog {

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
    };

    static readTodaysLog() {
        console.log(chalk.blue("Read today's log..."));
        const today = format(new Date(), "yyyy-MM-dd");
        const filename = `${today}.log`;
        const filepath = path.join(BaseConfigFolder.logs, filename);
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
    static logAdvanced(level: LOGLEVEL, module: string, text: string, metadata?: any) {
        if (!TwitchConfig.cfg("debug") && level == LOGLEVEL.DEBUG) return;

        // if testing, don't log
        if (process.env.NODE_ENV == "test") return;

        // check if folder exists
        if (!fs.existsSync(BaseConfigFolder.logs)) {
            throw new Error("Log folder does not exist!");
        }

        if (!TwitchLog.currentDate) {
            console.error(chalk.bgRed.whiteBright("😤 Log called before date was set!"));
        }

        // clear old logs from memory
        const today = format(new Date(), "yyyy-MM-dd");
        if (today != TwitchLog.currentDate) {
            console.log(chalk.yellow(`Clearing log memory from ${TwitchLog.currentDate} to ${today}`));
            TwitchLog.currentDate = today;
            TwitchLog.lines = [];
        }

        // today's filename in Y-m-d format
        const date = new Date();
        const filename = format(date, "yyyy-MM-dd") + ".log";
        const filepath = path.join(BaseConfigFolder.logs, filename);
        const jsonlinename = `${filepath}.jsonline`;

        const dateFormat = "yyyy-MM-dd HH:mm:ss.SSS";
        const dateString = format(date, dateFormat);

        // write cleartext
        const textOutput = `${dateString} | ${module} <${level}> ${text}`;
        fs.appendFileSync(filepath, textOutput + "\n");

        // if docker, output to stdout
        // if (TwitchConfig.cfg("docker")) {
        //     console.log(textOutput);
        // }

        console.log(
            this.LOG_COLORS[level](`${dateString} | ${module} <${level}> ${text}`)
        );

        const log_data: LogLine = {
            "module": module,
            "date": Date.now(),
            "level": level,
            "text": text,
        };

        if (metadata !== undefined) log_data.metadata = metadata;

        // write jsonline
        fs.appendFileSync(jsonlinename, JSON.stringify(log_data) + "\n");
        this.lines.push(log_data);

        // send over websocket, probably extremely slow
        if (TwitchConfig.cfg<boolean>("websocket_log")) {
            
            this.websocket_buffer.push(log_data);

            if (!TwitchLog.websocket_timer) {
                TwitchLog.websocket_timer = setTimeout(() => {
                    console.debug(`Sending ${this.websocket_buffer.length} lines over websocket, no timer`);
                    ClientBroker.broadcast({
                        action: "log",
                        data: this.websocket_buffer,
                    });
                    this.websocket_buffer = [];
                    TwitchLog.websocket_timer = undefined;
                }, 5000);
            } else {
                clearTimeout(TwitchLog.websocket_timer);
                TwitchLog.websocket_timer = setTimeout(() => {
                    console.debug(`Sending ${this.websocket_buffer.length} lines over websocket, timer exists`);
                    ClientBroker.broadcast({
                        action: "log",
                        data: this.websocket_buffer,
                    });
                    this.websocket_buffer = [];
                    TwitchLog.websocket_timer = undefined;
                }, 5000);
            }  

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
        const filepath = path.join(BaseConfigFolder.logs, filename);
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