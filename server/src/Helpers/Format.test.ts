import {
    formatBits,
    formatBytes,
    formatDuration,
    formatSubtitleDuration,
    getNiceDuration,
} from "./Format";

describe("Format Helpers", () => {
    describe("formatDuration", () => {
        it("should format duration in HH:MM:SS", () => {
            expect(formatDuration(3600)).toEqual("01:00:00");
            expect(formatDuration(3661)).toEqual("01:01:01");
            expect(formatDuration(0)).toEqual("00:00:00");
        });
    });

    describe("formatSubtitleDuration", () => {
        it("should format duration in HH:MM:SS.mmm", () => {
            expect(formatSubtitleDuration(3600)).toEqual("01:00:00.000");
            expect(formatSubtitleDuration(3661.123)).toEqual("01:01:01.123");
            expect(formatSubtitleDuration(0)).toEqual("00:00:00.000");
        });
    });

    describe("formatBytes", () => {
        it("should format bytes in B, KB, MB, GB, TB", () => {
            expect(formatBytes(1024)).toEqual("1.00 KB");
            expect(formatBytes(1024 * 1024)).toEqual("1.00 MB");
            expect(formatBytes(1024 * 1024 * 1024)).toEqual("1.00 GB");
            expect(formatBytes(1024 * 1024 * 1024 * 1024)).toEqual("1.00 TB");
            expect(formatBytes(0)).toEqual("0.00 B");
        });
    });

    describe("formatBits", () => {
        it("should format bits in B, KB, MB, GB, TB", () => {
            expect(formatBits(1024)).toEqual("8.00 Kb");
            expect(formatBits(1024 * 1024)).toEqual("8.00 Mb");
            expect(formatBits(1024 * 1024 * 1024)).toEqual("8.00 Gb");
            expect(formatBits(1024 * 1024 * 1024 * 1024)).toEqual("8.00 Tb");
            expect(formatBits(0)).toEqual("0.00 B");
        });
    });

    describe("getNiceDuration", () => {
        it("should format duration in d h m s", () => {
            expect(getNiceDuration(86400)).toEqual("1d");
            expect(getNiceDuration(90061)).toEqual("1d 1h 1m 1s");
            expect(getNiceDuration(3600)).toEqual("1h");
            expect(getNiceDuration(61)).toEqual("1m 1s");
            expect(getNiceDuration(0)).toEqual("");
        });
    });
});
