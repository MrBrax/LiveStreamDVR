import fs from "node:fs";
import path from "node:path";

export function directorySize(dir: string): number {
    let size = 0;
    for (const file of fs.readdirSync(dir)) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            size += directorySize(filePath);
        } else {
            size += stat.size;
        }
    }
    return size;
}

/*
export function sanitizeAbsolutePath(dir: string): string {
    
}

export function sanitizeRelativePath(dir: string): string {

    dir = path.normalize(dir);

    // linux
    if (dir.startsWith("/")) {
        dir = dir.substring(1);
    }

    // windows
    if (dir.match(/^[a-zA-Z]:\\/)) {
        dir = dir.substring(3);
    }




    
}

export function sanitizeFilename(filename: string): string {
    return filename.replace(/[\\/:*?"<>|]/g, "_");
}
*/

export function validateAbsolutePath(dir: string): boolean {
    return path.isAbsolute(dir) && !dir.match(/\0/);
}

export function validateRelativePath(dir: string): boolean {
    return (
        !path.isAbsolute(dir) &&
        // windows drive
        !dir.match(/^[a-zA-Z]:\\/) &&
        // linux root
        !dir.startsWith("/") &&
        // parent directory, but double dots can be part of the filename
        !dir.match(/[^\\]\\\.\.($|\\)/) &&
        !dir.startsWith("..\\") &&
        !dir.startsWith("../") &&
        // current directory
        !dir.match(/[^\\]\\\.($|\\)/) &&
        // null character
        !dir.match(/\0/)
    );
}

export function validateFilename(filename: string): boolean {
    return !/[\\/:*?"<>|\0]/.test(filename);
}

/**
 * Replaces any invalid characters in a file path with an underscore. Does not prevent directory traversal.
 * @param dir - The file path to sanitize.
 * @returns The sanitized file path.
 */
export function sanitizePath(dir: string): string {
    return dir.replace(/[:*?"<>|\0]/g, "_");
}
