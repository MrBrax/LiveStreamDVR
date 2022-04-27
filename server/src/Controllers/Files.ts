
import { DataRoot } from "../Core/BaseConfig";
import express from "express";
import path from "path";
import fs from "fs";
import sanitize from "sanitize-filename";
import chalk from "chalk";

const allowedDataPaths = [
    "storage",
    "logs",
];

const validatePath = (nastyPath: string) => {

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
    if (!allowedDataPaths.some(allowedPath => nastyPath.startsWith(path.join(DataRoot, allowedPath)))) {
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

};

// console.debug("C:\\", validatePath("C:\\"));
// console.debug("C:\\storage", validatePath("C:\\storage"));
// console.debug("/", validatePath("/"));
// console.debug("/storage", validatePath("/storage"));
// console.debug(path.join(DataRoot, ".."), validatePath(path.join(DataRoot, "..")));
// console.debug(path.join(DataRoot, "\u0000"), validatePath(path.join(DataRoot, "\u0000")));
// console.debug(path.join(DataRoot, "CON1"), validatePath(path.join(DataRoot, "CON1")));
// console.debug(path.join(DataRoot, "storage", "saved_vods"), validatePath(path.join(DataRoot, "storage", "saved_vods")));
// console.debug(path.join(DataRoot, "cache"), validatePath(path.join(DataRoot, "cache")));
// console.debug(path.join(DataRoot, "logs"), validatePath(path.join(DataRoot, "logs")));

export function ListFiles(req: express.Request, res: express.Response): void {

    const user_path = req.query.path as string;

    if (user_path == undefined) {
        res.status(400).send({
            status: "ERROR",
            message: "Path is not defined"
        });
        return;
    }

    const full_path = path.join(DataRoot, user_path);

    const validation = validatePath(full_path);
    if (validation !== true) {
        res.status(400).send({
            status: "ERROR",
            message: validation,
        });
        return;
    }

    const raw_files = fs.readdirSync(full_path);

    const files = raw_files.map((file) => {
        return {
            name: file,
            size: fs.statSync(path.join(full_path, file)).size,
            date: fs.statSync(path.join(full_path, file)).mtime,
            is_dir: fs.lstatSync(path.join(full_path, file)).isDirectory(),
        };
    });

    res.send({
        status: "OK",
        data: {
            files: files,
        },
    });

}

export function DeleteFile(req: express.Request, res: express.Response): void {

    const user_path = req.query.path as string;
    const file_name = req.query.name as string;

    if (user_path == undefined) {
        res.status(400).send({
            status: "ERROR",
            message: "Path is not defined",
        });
        return;
    }

    const full_path = path.join(DataRoot, user_path);

    const validation = validatePath(full_path);
    if (validation !== true) {
        res.status(400).send({
            status: "ERROR",
            message: validation,
        });
        return;
    }

    const sanitized_file_name = sanitize(file_name);

    const full_file_path = path.join(full_path, sanitized_file_name);

    if (!fs.existsSync(full_file_path)) {
        res.status(400).send({
            status: "ERROR",
            message: "File does not exist",
        });
        return;
    }

    fs.unlinkSync(full_file_path);
    console.log(chalk.bgRedBright.whiteBright(`Deleting file: ${full_file_path}`));

    res.send({
        status: "OK",
        message: "File deleted",
    });

}