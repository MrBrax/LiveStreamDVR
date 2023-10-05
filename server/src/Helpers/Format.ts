export function getNiceDuration(duration: number) {
    // format 1d 2h 3m 4s

    const days = Math.floor(duration / (60 * 60 * 24));
    const hours = Math.floor((duration - days * 60 * 60 * 24) / (60 * 60));
    const minutes = Math.floor(
        (duration - days * 60 * 60 * 24 - hours * 60 * 60) / 60
    );
    const seconds =
        duration - days * 60 * 60 * 24 - hours * 60 * 60 - minutes * 60;

    let str = "";

    if (days > 0) str += days + "d ";
    if (hours > 0) str += hours + "h ";
    if (minutes > 0) str += minutes + "m ";
    if (seconds > 0) str += seconds + "s";

    return str.trim();
}

/**
 * Format in HH:MM:SS
 * @param duration_seconds
 */
export function formatDuration(duration_seconds: number) {
    const hours = Math.floor(duration_seconds / (60 * 60));
    const minutes = Math.floor((duration_seconds - hours * 60 * 60) / 60);
    const seconds = Math.floor(
        duration_seconds - hours * 60 * 60 - minutes * 60
    );
    return `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function formatSubtitleDuration(duration_seconds: number) {
    const hours = Math.floor(duration_seconds / (60 * 60));
    const minutes = Math.floor((duration_seconds - hours * 60 * 60) / 60);
    const seconds = Math.floor(
        duration_seconds - hours * 60 * 60 - minutes * 60
    );
    const milliseconds = Math.floor(
        (duration_seconds - hours * 60 * 60 - minutes * 60 - seconds) * 1000
    );
    return `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${milliseconds
        .toString()
        .padStart(3, "0")}`;
}

// https://stackoverflow.com/a/2510459
export function formatBytes(bytes: number, precision = 2): string {
    const units = ["B", "KB", "MB", "GB", "TB"];

    bytes = Math.max(bytes, 0);
    let pow = Math.floor((bytes ? Math.log(bytes) : 0) / Math.log(1024));
    pow = Math.min(pow, units.length - 1);

    // Uncomment one of the following alternatives
    bytes /= Math.pow(1024, pow);
    // $bytes /= (1 << (10 * $pow));

    // return round($bytes, $precision) . ' ' . $units[$pow];
    return `${bytes.toFixed(precision)} ${units[pow]}`;
}

export function formatBits(bits: number, precision = 2): string {
    return formatBytes(bits * 8, precision).replace(/([a-zA-Z])B/, "$1b");
}
