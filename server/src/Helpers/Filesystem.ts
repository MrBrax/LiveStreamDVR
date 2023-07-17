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