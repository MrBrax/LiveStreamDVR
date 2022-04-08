export class TwitchHelper {
    public static formatDuration(duration_seconds: number) {
        const hours = Math.floor(duration_seconds / (60 * 60));
        const minutes = Math.floor((duration_seconds - hours * 60 * 60) / 60);
        const seconds = Math.floor(duration_seconds - hours * 60 * 60 - minutes * 60);
        return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
}
