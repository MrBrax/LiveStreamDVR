import { BaseConfigDataFolder, DataRoot } from "@/Core/BaseConfig";
import chalk from "chalk";
import type express from "express";
import fs from "node:fs";
import path from "node:path";
import sanitize from "sanitize-filename";

const allowedDataPaths = ["storage", "logs"];

/**
 * Validates a given path to ensure it meets certain criteria.
 *
 * @param nastyPath - The path to be validated.
 * @returns A string indicating the validation error, or `true` if the path is valid.
 */
export function validatePath(nastyPath: string): string | boolean {
    // sanitize user path
    nastyPath = nastyPath.normalize();

    // null and other control characters
    // eslint-disable-next-line no-control-regex
    if (nastyPath.match(/[\x00-\x1f\x80-\x9f]/g)) {
        return "Path contains invalid characters";
    }

    // don't traverse up the tree
    if (!nastyPath.startsWith(DataRoot)) {
        return "Path is not valid";
    }

    // only allow paths that are in the allowed paths
    if (
        !allowedDataPaths.some((allowedPath) =>
            nastyPath.startsWith(path.join(DataRoot, allowedPath))
        )
    ) {
        return "Access denied";
    }

    // check if path exists
    if (!fs.existsSync(nastyPath)) {
        return "Path does not exist";
    }

    // check if user path is a directory
    if (!fs.lstatSync(nastyPath).isDirectory()) {
        return "Path is not a directory";
    }

    return true;
}

function isPublic(file_path: string): boolean {
    if (file_path.startsWith(BaseConfigDataFolder.logs)) {
        return process.env.TCD_EXPOSE_LOGS_TO_PUBLIC === "1";
    }
    return true;
}

export function ListFiles(req: express.Request, res: express.Response): void {
    if (process.env.TCD_ENABLE_FILES_API !== "1") {
        res.api(404, {
            status: "ERROR",
            message:
                "Files API is disabled on this server. Enable with the TCD_ENABLE_FILES_API environment variable.",
        });
        return;
    }

    const user_path = req.query.path as string;

    if (user_path == undefined) {
        res.api(400, {
            status: "ERROR",
            message: "Path is not defined",
        });
        return;
    }

    const full_path = path.join(DataRoot, user_path);

    const validation = validatePath(full_path);
    if (validation !== true) {
        res.api(400, {
            status: "ERROR",
            message: validation,
        });
        return;
    }

    const raw_files = fs.readdirSync(full_path);

    const files = raw_files
        .filter((file) => {
            return !file.startsWith(".");
        })
        .map((file) => {
            return {
                name: file,
                size: fs.statSync(path.join(full_path, file)).size,
                date: fs.statSync(path.join(full_path, file)).mtime,
                is_dir: fs.lstatSync(path.join(full_path, file)).isDirectory(),
                is_public: isPublic(path.join(full_path, file)),
                extension: path.extname(file).substring(1),
            };
        });

    res.api(200, {
        status: "OK",
        data: {
            files: files,
        },
    });
}

export function DeleteFile(req: express.Request, res: express.Response): void {
    if (process.env.TCD_ENABLE_FILES_API !== "1") {
        res.api(403, {
            status: "ERROR",
            message:
                "Files API is disabled on this server. Enable with the TCD_ENABLE_FILES_API environment variable.",
        });
        return;
    }

    const user_path = req.query.path as string;
    const file_name = req.query.name as string;

    if (user_path == undefined) {
        res.api(400, {
            status: "ERROR",
            message: "Path is not defined",
        });
        return;
    }

    const full_path = path.join(DataRoot, user_path);

    const validation = validatePath(full_path);
    if (validation !== true) {
        res.api(400, {
            status: "ERROR",
            message: validation,
        });
        return;
    }

    const sanitized_file_name = sanitize(file_name);

    const full_file_path = path.join(full_path, sanitized_file_name);

    if (!fs.existsSync(full_file_path)) {
        res.api(400, {
            status: "ERROR",
            message: "File does not exist",
        });
        return;
    }

    fs.unlinkSync(full_file_path);
    console.log(
        chalk.bgRedBright.whiteBright(`Deleting file: ${full_file_path}`)
    );

    res.api(200, {
        status: "OK",
        message: "File deleted",
    });
}
