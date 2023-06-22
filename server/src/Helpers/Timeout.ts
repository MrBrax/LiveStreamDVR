/**
 * Vanilla NodeJS Timeout and Interval functions, but with automatic unref() to prevent the process from being kept alive.
 * Multiple times have I forgotten to clearTimeout() my timeouts and intervals, and it's a pain to debug since there's no error thrown.
 * Jest in particular is a pain to debug, since it has arguments to troubleshooting timeouts and intervals, but they don't work.
 */
import { Config } from "../Core/Config";
const timeouts: NodeJS.Timeout[] = [];
const intervals: NodeJS.Timeout[] = [];

export function xTimeout(callback: (...args: any[]) => void, ms: number, ...args: any[]): NodeJS.Timeout {
    const timeout = setTimeout(callback, ms, ...args);
    timeouts.push(timeout);
    timeout.unref(); // Don't keep the process running just for this timeout
    if (Config.debug) console.debug(`Timeout ${timeout} created`);
    return timeout;
}

export function xInterval(callback: (...args: any[]) => void, ms: number, ...args: any[]): NodeJS.Timeout {
    const interval = setInterval(callback, ms, ...args);
    intervals.push(interval);
    interval.unref(); // Don't keep the process running just for this interval
    if (Config.debug) console.debug(`Interval ${interval} created`);
    return interval;
}

export function clearAllTimeoutsAndIntervals(): void {
    timeouts.forEach(timeout => {
        clearTimeout(timeout);
        if (Config.debug) console.debug(`Timeout ${timeout} cleared`);
    });
    intervals.forEach(interval => {
        clearInterval(interval);
        if (Config.debug) console.debug(`Interval ${interval} cleared`);
    });
}