import { xClearTimeout, xTimeout } from "@/Helpers/Timeout";
import type { WinstonLogLine } from "@common/Log";
import { addColors, createLogger, format, transports } from "winston";
import "winston-daily-rotate-file";
import { AppName, BaseConfigDataFolder } from "./BaseConfig";
import { ClientBroker } from "./ClientBroker";
import { Config } from "./Config";

const { combine, timestamp, label, printf } = format;

export enum LOGLEVEL {
    ERROR = "error",
    WARNING = "warn",
    INFO = "info",
    DEBUG = "debug",
    FATAL = "fatal",
    SUCCESS = "success",
    EXEC = "exec",
}

const winstonCustomlevels = {
    levels: {
        fatal: 0,
        error: 1,
        warn: 2,
        success: 3,
        info: 4,
        debug: 5,
        exec: 6,
    },
    colors: {
        fatal: "red",
        error: "red",
        warn: "yellow",
        success: "green",
        info: "blue",
        debug: "gray",
        exec: "redBright",
    },
};

/*
export interface LogLine {
    module: string;
    time: number;
    level: LOGLEVEL;
    text: string;
    pid?: number;
    metadata?: unknown;
    g?: string; // git hash
}
*/

// let currentDate = "";
// let lines: LogLine[] = [];

const websocket_buffer: WinstonLogLine[] = [];
let websocket_timer: NodeJS.Timeout | undefined;

/*
export const LogColor = {
    [LOGLEVEL.ERROR]: chalk.red,
    [LOGLEVEL.WARNING]: chalk.yellow,
    [LOGLEVEL.INFO]: chalk.blue,
    [LOGLEVEL.DEBUG]: chalk.gray,
    [LOGLEVEL.FATAL]: chalk.red,
    [LOGLEVEL.SUCCESS]: chalk.green,
    [LOGLEVEL.EXEC]: chalk.redBright,
};

export const LogLevel = {
    [LOGLEVEL.INFO]: "INFO",
    [LOGLEVEL.SUCCESS]: "INFO",
    [LOGLEVEL.DEBUG]: "DEBUG",
    [LOGLEVEL.WARNING]: "ERROR",
    [LOGLEVEL.ERROR]: "ERROR",
    [LOGLEVEL.FATAL]: "ERROR",
    [LOGLEVEL.EXEC]: "EXEC",
};
*/

const winstonLogFormat = printf(
    ({ level, message, module, metadata, timestamp }) => {
        return `${timestamp} | ${module} <${level}> ${message}`;
        // do not print metadata to console
    }
);

const jsonLogTransport = new transports.DailyRotateFile({
    filename: `${AppName}-%DATE%.jsonl`,
    dirname: BaseConfigDataFolder.logs,
    datePattern: "YYYY-MM-DD",
    // zippedArchive: true,
    maxSize: "20m",
    maxFiles: "14d",
    json: true,
    format: format.combine(
        format.timestamp(),
        format.metadata(),
        format.json()
    ),
});

const textLogTransport = new transports.DailyRotateFile({
    filename: `${AppName}-%DATE%.log`,
    dirname: BaseConfigDataFolder.logs,
    datePattern: "YYYY-MM-DD",
    // zippedArchive: true,
    maxSize: "20m",
    maxFiles: "14d",
    format: format.combine(format.timestamp(), winstonLogFormat),
});

const logger = createLogger({
    level: "info",
    levels: winstonCustomlevels.levels,
    format: format.json(),
    transports: [
        new transports.Console({
            format: format.combine(
                format.colorize(),
                // format.simple()
                format.timestamp(),
                winstonLogFormat
            ),
        }),
        jsonLogTransport,
        textLogTransport,
    ],
    handleExceptions: true,
    handleRejections: true,
    // exitOnError: false,
});

export function getLogger() {
    return logger;
}

addColors(winstonCustomlevels.colors);

jsonLogTransport.on("rotate", function (oldFilename, newFilename) {
    console.log(`Rotated log file from ${oldFilename} to ${newFilename}`);
});

export const censoredLogWords: Set<string> = new Set();

export async function getLogLines({
    from,
    to,
    limit,
    start,
    order = "asc",
}: {
    from: Date;
    to: Date;
    limit?: number;
    start?: number;
    order?: "desc" | "asc";
}): Promise<Record<string, WinstonLogLine[]>> {
    return await new Promise((resolve, reject) => {
        logger.query(
            {
                from: from,
                until: to,
                limit: limit,
                start: start,
                order: order,
                fields: ["message", "level", "module", "metadata", "timestamp"],
            },
            function (err, results) {
                if (err) {
                    reject(err);
                }
                resolve(results);
            }
        );
    });
}

export function readTodaysLog(): void {
    return;
    /*
    console.log(chalk.blue("Read today's log..."));
    const today = format(new Date(), "yyyy-MM-dd");
    const filename = `${today}.log`;
    const filepath = path.join(BaseConfigDataFolder.logs, filename);
    const jsonlinename = `${filepath}.jsonline`;

    if (!fs.existsSync(filepath)) {
        return;
    }

    const newLines = fs.readFileSync(jsonlinename, "utf8").split("\n");
    try {
        lines = newLines
            .map((line) => (line.length > 0 ? JSON.parse(line) : null))
            .filter((line) => line !== null);
    } catch (error) {
        console.error(
            chalk.bgRed.whiteBright(
                "Error parsing log data, skipping log read."
            ),
            error
        );
        return;
    }
    console.log(
        chalk.green(`✔ Parsed ${lines.length} lines from ${jsonlinename}`)
    );
    currentDate = today;
    */
}

/**
 * Log a message to the log file. Do NOT call before loading the config.
 *
 * @param level
 * @param module
 * @param text
 * @param metadata
 * @test disable
 * @returns
 */
export function log(
    level: LOGLEVEL,
    module: string,
    text: string,
    metadata?: any
): void {
    const logData: WinstonLogLine = {
        level: level,
        message: text,
        module: module,
        timestamp: new Date().toISOString(),
        metadata: metadata,
    };

    logger.log(logData);

    /*
    if (!Config.debug && level == LOGLEVEL.DEBUG) return;

    // if testing, don't log
    if (process.env.NODE_ENV == "test") {
        console.log(chalk.yellow("[TEST]"), level, module, text);
        return;
    }

    // check if folder exists
    if (!fs.existsSync(BaseConfigDataFolder.logs)) {
        throw new Error(
            `Log folder '${BaseConfigDataFolder.logs}' does not exist!`
        );
    }

    if (!currentDate) {
        console.error(
            chalk.bgRed.whiteBright("😤 Log called before date was set!")
        );
    }

    // clear old logs from memory
    nextLog();

    // today's filename in Y-m-d format
    const date = new Date();

    const loglevel_category = LogLevel[level];

    const filename_combined = format(date, "yyyy-MM-dd") + ".log";
    const filename_separate = format(date, "yyyy-MM-dd") + "." + level + ".log";
    const filename_level =
        format(date, "yyyy-MM-dd") + "." + loglevel_category + ".jsonline";

    const filepath_combined = path.join(
        BaseConfigDataFolder.logs,
        filename_combined
    );
    const filepath_separate = path.join(
        BaseConfigDataFolder.logs,
        filename_separate
    );
    const filepath_level = path.join(BaseConfigDataFolder.logs, filename_level);

    // console.debug(`Logging to ${filepath_separate}`);

    const jsonlinename_combined = `${filepath_combined}.jsonline`;
    const jsonlinename_separate = `${filepath_separate}.jsonline`;
    const jsonlinename_level = `${filepath_level}.jsonline`;

    const dateFormat = "yyyy-MM-dd HH:mm:ss.SSS";
    const dateString = format(date, dateFormat);

    for (const word of censoredLogWords) {
        text = text.replace(word, "*".repeat(word.length));
    }

    let ident = "";
    if (process.pid) ident += process.pid;
    if (Config.getInstance().gitHash)
        ident += `+${Config.getInstance().gitHash?.substring(0, 4)}`;

    // write cleartext
    const textOutput = `TXT ${dateString} ${ident} | ${module} <${level}> ${text}`;
    fs.appendFileSync(filepath_combined, `${textOutput}\n`);
    // fs.appendFileSync(filepath_separate, textOutput + "\n");
    // fs.appendFileSync(filepath_level, textOutput + "\n");

    // if docker, output to stdout
    // if (TwitchConfig.getInstance().cfg("docker")) {
    //     console.log(textOutput);
    // }

    if (Config && Config.debug) {
        const mem = process.memoryUsage();
        console.log(
            LogColor[level](
                `${dateString} | ${formatBytes(mem.heapUsed)}/${formatBytes(
                    mem.heapTotal
                )}/${formatBytes(mem.rss)} | ${module} <${level}> ${text}`
            )
        );
    } else {
        console.log(
            LogColor[level](`${dateString} | ${module} <${level}> ${text}`)
        );
    }

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
        console.error(
            chalk.bgRed.whiteBright("😤 Error stringifying log data!"),
            log_data
        );
        log(LOGLEVEL.ERROR, `Log.${module}`, "Error stringifying log data!");
        return;
    }

    // write jsonline
    fs.appendFileSync(jsonlinename_combined, `${stringy_log_data}\n`);
    // fs.appendFileSync(jsonlinename_separate, stringy_log_data + "\n");
    // fs.appendFileSync(jsonlinename_level, stringy_log_data + "\n");
    lines.push(log_data);
    */
    // send over websocket, probably extremely slow
    if (
        Config.getInstance().initialised &&
        Config.getInstance().cfg<boolean>("websocket_log")
    ) {
        websocket_buffer.push(logData);

        if (websocket_timer) xClearTimeout(websocket_timer);
        websocket_timer = xTimeout(() => {
            // console.debug(
            //     `Sending ${websocket_buffer.length} lines over websocket`
            // );
            ClientBroker.broadcast({
                server: true,
                action: "log",
                data: websocket_buffer,
            });
            websocket_buffer.length = 0;
            websocket_timer = undefined;
        }, 5000);
    }

    // if (metadata instanceof Error) {
    //     console.error(metadata);
    // }

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
    *

    */
}

/*
function nextLog(): void {
    const today = format(new Date(), "yyyy-MM-dd");
    if (today != currentDate) {
        console.log(
            chalk.yellow(`Clearing log memory from ${currentDate} to ${today}`)
        );
        currentDate = today;
        lines = [];
        log(
            LOGLEVEL.INFO,
            "log.nextLog",
            `Starting new log file for ${today}, git hash ${
                Config.getInstance().gitHash
            }`
        );
    }
}
*/

/**
 * Fetch n lines from a log file.
 * @param date
 * @param fromLine
 * @throws
 * @returns
 */
/*
export function fetchLog(date: string, fromLine = 0): LogLine[] {
    // return lines from n to end
    if (date == currentDate) {
        // console.debug(`Fetching ${this.lines.length} lines starting from ${fromLine} from memory`);
        return lines.slice(fromLine);
    }

    const filename = `${date}.log`;
    const filepath = path.join(BaseConfigDataFolder.logs, filename);
    const jsonlinename = `${filepath}.jsonline`;

    if (!fs.existsSync(filepath)) {
        throw new Error(`File not found: ${filepath}`);
    }

    const newLines = fs.readFileSync(jsonlinename, "utf8").split("\n");
    const parsed_lines: LogLine[] = newLines
        .map((line) => (line.length > 0 ? JSON.parse(line) : null))
        .filter((line) => line !== null);
    // console.debug(`Fetched ${parsed_lines.length} lines from ${jsonlinename}`);
    return parsed_lines;
}

export function measureLogMemoryUsage(): void {
    // return Buffer.byteLength(JSON.stringify(lines), "utf8");
    const mem = process.memoryUsage();
    console.log(
        `Memory usage: ${formatBytes(mem.heapUsed)}/${formatBytes(
            mem.heapTotal
        )}/${formatBytes(mem.rss)}`
    );
    const linesUsage = Buffer.byteLength(JSON.stringify(lines), "utf8");
    console.log(`Log memory usage: ${formatBytes(linesUsage)}`);
}
*/

export function setLogDebug(state: boolean): void {
    console.log(`Setting debug to ${state}`);
    logger.level = state ? "debug" : "info";
}
