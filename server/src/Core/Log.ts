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
    // json: false,
});

const logger = createLogger({
    level: "info",
    levels: winstonCustomlevels.levels,
    // format: format.json(),
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
        const query = {
            from: from,
            until: to,
            limit: limit,
            start: start,
            order: order,
            fields: ["message", "level", "module", "metadata", "timestamp"],
        };

        logger.query(query, function (err, results) {
            if (err) {
                reject(err);
            }
            resolve(results);
        });
    });
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
}

export function setLogDebug(state: boolean): void {
    console.log(`Setting debug to ${state}`);
    logger.level = state ? "debug" : "info";
}
