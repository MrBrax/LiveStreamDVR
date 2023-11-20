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

const jsonLogger = createLogger({
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
    ],
    handleExceptions: true,
    handleRejections: true,
    // exitOnError: false,
});

const textLogger = createLogger({
    level: "info",
    levels: winstonCustomlevels.levels,
    transports: [textLogTransport],
});

export function getLogger() {
    return jsonLogger;
}

addColors(winstonCustomlevels.colors);

jsonLogTransport.on("rotate", function (oldFilename, newFilename) {
    console.log(`Rotated JSON log file from ${oldFilename} to ${newFilename}`);
});

textLogTransport.on("rotate", function (oldFilename, newFilename) {
    console.log(`Rotated text log file from ${oldFilename} to ${newFilename}`);
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
        jsonLogger.query(
            {
                from: from,
                until: to,
                limit: limit,
                start: start,
                order: order,
                fields: ["message", "level", "module", "metadata", "timestamp"],
            },
            (err, results: Record<string, WinstonLogLine[]>) => {
                if (err) {
                    reject(err);
                }

                // TODO: hacky way to filter out logs that are not in the time range, why does query not do this?
                const transport = Object.keys(results)[0];
                results[transport] = results[transport].filter(
                    (result: WinstonLogLine) =>
                        result.metadata &&
                        new Date(result.metadata.timestamp) >= from &&
                        new Date(result.metadata.timestamp) <= to
                );

                resolve(results);
            }
        );
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
    const winstonLogData = {
        level: level,
        message: text,
        module: module,
        timestamp: new Date().toISOString(),
        metadata: metadata,
    };

    const websocketLogData = {
        level: level,
        message: text,
        metadata: {
            ...metadata,
            module: module,
            timestamp: new Date().toISOString(),
        },
    };

    jsonLogger.log(winstonLogData);
    textLogger.log(winstonLogData); // hack to get query working

    // send over websocket, probably extremely slow
    if (
        Config.getInstance().initialised &&
        Config.getInstance().cfg<boolean>("websocket_log")
    ) {
        websocket_buffer.push(websocketLogData);

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
    jsonLogger.level = state ? "debug" : "info";
    textLogger.level = state ? "debug" : "info";
}
