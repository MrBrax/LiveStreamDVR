/**
 * Vanilla NodeJS Timeout and Interval functions, but with automatic unref() to prevent the process from being kept alive.
 * Multiple times have I forgotten to clearTimeout() my timeouts and intervals, and it's a pain to debug since there's no error thrown.
 * Jest in particular is a pain to debug, since it has arguments to troubleshooting timeouts and intervals, but they don't work.
 */
import { Config } from "../Core/Config";

interface ExtendedTimeout {
    id: NodeJS.Timeout;
    src: string | undefined;
    created: Date;
}

// timeouts that run by themselves and not clearTimeout will never be removed from this array, potentially causing a memory leak, making this problem worse??
const timeouts: ExtendedTimeout[] = [];
const intervals: ExtendedTimeout[] = [];

export function xTimeout(callback: (...args: any[]) => void, ms: number, ...args: any[]): NodeJS.Timeout {
    const src = new Error().stack?.split("\n")[2].trim();
    const timeout = setTimeout(callback, ms, ...args);
    timeouts.push({ id: timeout, src, created: new Date() });
    timeout.unref(); // Don't keep the process running just for this timeout
    if (Config && Config.debug) {
        console.debug(`Timeout ${timeout} created at ${src}`);
    }
    return timeout;
}

export function xInterval(callback: (...args: any[]) => void, ms: number, ...args: any[]): NodeJS.Timeout {
    const src = new Error().stack?.split("\n")[2].trim();
    const interval = setInterval(callback, ms, ...args);
    intervals.push({ id: interval, src, created: new Date() });
    interval.unref(); // Don't keep the process running just for this interval
    if (Config && Config.debug) {
        console.debug(`Interval ${interval} created at ${src}`);
    }
    return interval;
}

export function xClearTimeout(timeout: NodeJS.Timeout): void {
    clearTimeout(timeout);
    const index = timeouts.findIndex(t => t.id === timeout);
    if (index > -1) {
        timeouts.splice(index, 1);
        if (Config && Config.debug) {
            const src = new Error().stack?.split("\n")[2].trim();
            console.debug(`Timeout ${timeout} cleared at ${src}`);
        }
    }
}

export function xClearInterval(interval: NodeJS.Timeout): void {
    clearInterval(interval);
    const index = intervals.findIndex(t => t.id === interval);
    if (index > -1) {
        intervals.splice(index, 1);
        if (Config && Config.debug) {
            const src = new Error().stack?.split("\n")[2].trim();
            console.debug(`Interval ${interval} cleared at ${src}`);
        }
    }
}

export function clearAllTimeoutsAndIntervals(): void {
    timeouts.forEach(timeout => {
        clearTimeout(timeout.id);
        if (Config && Config.debug) console.debug(`Timeout ${timeout} cleared`);
    });
    intervals.forEach(interval => {
        clearInterval(interval.id);
        if (Config && Config.debug) console.debug(`Interval ${interval} cleared`);
    });
}

/*
const debugInterval = xInterval(() => {
    // console.debug(`Timeouts: ${timeouts.length}, Intervals: ${intervals.length}`);
    console.debug(`Timeouts: ${timeouts.length}`);
    for (const timeout of timeouts) {
        console.debug(` - ${timeout.id} - ${timeout.created} - ${timeout.src}`);
    }
    if (!Config || !Config.debug) {
        xClearInterval(debugInterval);
        console.debug("Debug mode disabled, stopping debug interval");
    }
}, 20000);
*/