import chalk from "chalk";
import { format } from "date-fns";
import fs from "fs";
import path from "path";
import { BaseConfigFolder } from "./BaseConfig";
import { TwitchConfig } from "./TwitchConfig";

export enum LOGLEVEL {
    ERROR = "ERROR",
    WARNING = "WARNING",
    INFO = "INFO",
    DEBUG = "DEBUG",
    FATAL = "FATAL",
    SUCCESS = "SUCCESS",
}

interface LogLine {
    module: string;
    date: number;
    level: LOGLEVEL;
    text: string;
    metadata?: any;
}

export class TwitchLog {

    public static currentDate = "";
    public static lines: LogLine[] = [];

    static readonly LOG_COLORS = {
        [LOGLEVEL.ERROR]: chalk.red,
        [LOGLEVEL.WARNING]: chalk.yellow,
        [LOGLEVEL.INFO]: chalk.blue,
        [LOGLEVEL.DEBUG]: chalk.gray,
        [LOGLEVEL.FATAL]: chalk.red,
        [LOGLEVEL.SUCCESS]: chalk.green,
    };

    static readTodaysLog() {
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
        // console.log(`Parsed ${lines.length} lines from ${jsonlinename}`);
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

        // clear old logs from memory
        const today = format(new Date(), "yyyy-MM-dd");
        if (today != TwitchLog.currentDate) {
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

    }

    static fetchLog(date: string, fromLine = 0) {

        if (date == this.currentDate) {
            return this.lines.slice(fromLine);
        }

        const filename = `${date}.log`;
        const filepath = path.join(BaseConfigFolder.logs, filename);
        const jsonlinename = `${filepath}.jsonline`;

        if (!fs.existsSync(filepath)) {
            throw new Error(`File not found: ${filepath}`);
        }

        const lines = fs.readFileSync(jsonlinename, "utf8").split("\n");
        return lines.map(line => line.length > 0 ? JSON.parse(line) : null).filter(line => line !== null);
    }

}