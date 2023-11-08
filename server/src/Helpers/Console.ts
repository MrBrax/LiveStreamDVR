import { Config } from "@/Core/Config";
import chalk from "chalk";
import { formatBytes } from "./Format";

/**
 * Logs a progress message to the console, optionally including memory usage information.
 * @param text - The message to log.
 */
export function progressOutput(text: string) {
    if (Config.debug) {
        const mem = process.memoryUsage();
        console.log(
            chalk.bgGreen.whiteBright(
                `${text} [${formatBytes(mem.heapUsed)}/${formatBytes(
                    mem.heapTotal
                )}]`
            )
        );
    } else {
        console.log(chalk.bgGreen.whiteBright(text));
    }
}

/**
 * Logs debug information to the console if debug mode is enabled.
 * @param args - The arguments to log to the console.
 */
export function debugLog(...args: unknown[]) {
    if (Config && Config.debug) {
        console.debug(
            chalk.redBright(`[debug/${new Date().toISOString()}]`),
            ...args
        );
    }
}
