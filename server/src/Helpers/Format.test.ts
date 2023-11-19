import {
    formatBits,
    formatBytes,
    formatDuration,
    formatSubtitleDuration,
    getNiceDuration,
} from "./Format";

import { formatString } from "@common/Format";

import {
    validateAbsolutePath,
    validateFilename,
    validateRelativePath,
} from "./Filesystem";

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
describe("Format Helpers", () => {
    describe("formatString", () => {
        it("should replace placeholders with values from replacements object", () => {
            const string = "Hello {name}, your age is {age}.";
            const replacements = { name: "John", age: "30" };
            expect(formatString(string, replacements)).toEqual(
                "Hello John, your age is 30."
            );
        });

        it("should replace multiple placeholders with values from replacements object", () => {
            const string =
                "Hello {name}, your age is {age}. You live in {city}.";
            const replacements = { name: "John", age: "30", city: "New York" };
            expect(formatString(string, replacements)).toEqual(
                "Hello John, your age is 30. You live in New York."
            );
        });

        it("should replace placeholders with empty string if hideEmpty is true and value is undefined", () => {
            const string = "Hello {name}, your age is {age}.";
            const replacements = { name: "John" };
            expect(formatString(string, replacements, true)).toEqual(
                "Hello John, your age is ."
            );
        });

        it("should not replace placeholders with empty string if hideEmpty is false and value is undefined", () => {
            const string = "Hello {name}, your age is {age}.";
            const replacements = { name: "John" };
            expect(formatString(string, replacements)).toEqual(
                "Hello John, your age is {age}."
            );
        });

        it("should not replace placeholders if replacements object does not contain the key", () => {
            const string = "Hello {name}, your age is {age}.";
            const replacements = { name: "John", city: "New York" };
            expect(formatString(string, replacements)).toEqual(
                "Hello John, your age is {age}."
            );
        });
    });
});

/*
describe("Sanitize", () => {
    it("should sanitize absolute directory path", () => {
        expect(sanitizeAbsolutePath(path.join("C:\\", "test", "test"))).toEqual(
            "C:\\test\\test"
        );
        expect(
            sanitizeAbsolutePath(path.join("C:\\", "test", "test\\"))
        ).toEqual("C:\\test\\test");
        expect(
            sanitizeAbsolutePath(path.join("C:\\", "test", "test\\\\"))
        ).toEqual("C:\\test\\test");
        expect(sanitizeAbsolutePath(path.join("C:\\", "test/test"))).toEqual(
            "C:\\test\\test"
        );
    });

    it("should sanitize relative directory path", () => {
        expect(sanitizeRelativePath(path.join("test", "test"))).toEqual(
            path.join("test", "test")
        );
        expect(sanitizeRelativePath(path.join("test", "test\\"))).toEqual(
            path.join("test", "test")
        );
        expect(sanitizeRelativePath(path.join("test", "test\\\\"))).toEqual(
            path.join("test", "test")
        );
        expect(sanitizeRelativePath(path.join("test/test"))).toEqual(
            path.join("test", "test")
        );
    });

    it("should sanitize filename", () => {
        expect(sanitizeFilename("test")).toEqual("test");
        expect(sanitizeFilename("test.txt")).toEqual("test.txt");
        expect(sanitizeFilename("../test.txt")).toEqual("test.txt");
        expect(sanitizeFilename("test/test.txt")).toEqual("testtest.txt");
        expect(sanitizeFilename("C:\\test\\test.txt")).toEqual("Ctesttest.txt");
        expect(sanitizeFilename("/test/test.txt")).toEqual("testtest.txt");
    });
});
*/

describe("Validate", () => {
    describe("validateAbsolutePath", () => {
        it("should validate absolute directory path", () => {
            expect(validateAbsolutePath("C:\\test\\test")).toEqual(true);
            expect(validateAbsolutePath("C:\\test\\test\\")).toEqual(true);
            expect(validateAbsolutePath("C:\\test\\test\\\\")).toEqual(true);
            expect(validateAbsolutePath("C:\\test/test")).toEqual(true);
            expect(validateAbsolutePath("C:\\\0\\test")).toEqual(false);
        });

        it("should not validate relative directory path", () => {
            expect(validateAbsolutePath("test\\test")).toEqual(false);
            expect(validateAbsolutePath("test\\test\\")).toEqual(false);
            expect(validateAbsolutePath("test\\test\\\\")).toEqual(false);
            expect(validateAbsolutePath("test/test")).toEqual(false);
        });
    });

    describe("validateRelativePath", () => {
        it("should not validate absolute directory path", () => {
            expect(validateRelativePath("C:\\test\\test")).toEqual(false);
            expect(validateRelativePath("C:\\test\\test\\")).toEqual(false);
            expect(validateRelativePath("C:\\test\\test\\\\")).toEqual(false);
            expect(validateRelativePath("C:\\test/test")).toEqual(false);
            expect(validateRelativePath("/test/test")).toEqual(false);
            expect(validateRelativePath("/test\0/test")).toEqual(false);
        });

        it("should validate relative directory path", () => {
            expect(validateRelativePath("test\\test")).toEqual(true);
            expect(validateRelativePath("test\\test\\")).toEqual(true);
            expect(validateRelativePath("test\\test\\\\")).toEqual(true);
            expect(validateRelativePath("test/test")).toEqual(true);
        });

        it("should fail relative directory path with ..", () => {
            expect(validateRelativePath("..\\test")).toEqual(false);
            expect(validateRelativePath("..\\test\\")).toEqual(false);
            expect(validateRelativePath("..\\test\\\\")).toEqual(false);
            expect(validateRelativePath("../test/test")).toEqual(false);
            expect(validateRelativePath("test../test")).toEqual(true);
        });
    });

    describe("validateFilename", () => {
        it("should validate filename", () => {
            expect(validateFilename("test")).toEqual(true);
            expect(validateFilename("test.txt")).toEqual(true);
            expect(validateFilename("test..txt")).toEqual(true);
            expect(validateFilename("../test.txt")).toEqual(false);
            expect(validateFilename("test/test.txt")).toEqual(false);
            expect(validateFilename("C:\\test\\test.txt")).toEqual(false);
            expect(validateFilename("/test/test.txt")).toEqual(false);
            expect(
                validateFilename("file_[1]_(super).{brackets}-dash.test.txt")
            ).toEqual(true);
            expect(validateFilename("\0test.txt")).toEqual(false);
        });
    });
});
