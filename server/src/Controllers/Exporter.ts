import express from "express";
import path from "path";
import sanitize from "sanitize-filename";
import { ApiErrorResponse, ApiResponse } from "../../../common/Api/Api";
import { BaseConfigDataFolder, DataRoot } from "../Core/BaseConfig";
import { TwitchVOD } from "../Core/TwitchVOD";
import { FileExporter } from "../Exporters/File";
import { FTPExporter } from "../Exporters/FTP";
import { SFTPExporter } from "../Exporters/SFTP";
import { YouTubeExporter } from "../Exporters/YouTube";
import { validatePath } from "./Files";

type Exporter = FileExporter | YouTubeExporter | SFTPExporter;

export async function ExportFile(req: express.Request, res: express.Response): Promise<void> {

    const mode = req.query.mode;
    const input_exporter = req.body.exporter;
    let exporter: Exporter | undefined;

    if (!input_exporter) {
        res.status(400).send({
            status: "ERROR",
            message: "No exporter specified",
        } as ApiErrorResponse);
        return;
    }

    // FIXME: DRY this up, more sanitization of the input

    if (mode === "vod") {

        const vod = TwitchVOD.getVod(req.body.vod);

        if (!vod) {
            res.status(400).send({
                status: "ERROR",
                message: "Vod not found",
            } as ApiErrorResponse);
            return;
        }

        if (!vod.is_finalized) {
            res.status(400).send({
                status: "ERROR",
                message: "Vod is not finalized",
            } as ApiErrorResponse);
            return;
        }

        if (!vod.segments || vod.segments.length == 0) {
            res.status(400).send({
                status: "ERROR",
                message: "Vod has no segments",
            } as ApiErrorResponse);
            return;
        }

        try {
            if (input_exporter == "file") {
                exporter = new FileExporter();
                if (exporter instanceof FileExporter) { // why does typescript need this??
                    exporter.loadVOD(vod);
                    exporter.setDirectory(req.body.directory || BaseConfigDataFolder.saved_vods);
                }
            } else if (input_exporter == "sftp") {
                exporter = new SFTPExporter();
                if (exporter instanceof SFTPExporter) { // why does typescript need this??
                    exporter.loadVOD(vod);
                    exporter.setDirectory(req.body.directory);
                    exporter.setHost(req.body.host);
                    exporter.setUsername(req.body.username);
                }
            } else if (input_exporter == "ftp") {
                exporter = new FTPExporter();
                if (exporter instanceof FTPExporter) { // why does typescript need this??
                    exporter.loadVOD(vod);
                    exporter.setDirectory(req.body.directory);
                    exporter.setHost(req.body.host);
                    exporter.setUsername(req.body.username);
                    exporter.setPassword(req.body.password);
                }
            
            } else if (input_exporter == "youtube") {
                exporter = new YouTubeExporter();
                if (exporter instanceof YouTubeExporter) { // why does typescript need this??
                    exporter.loadVOD(vod);
                    exporter.setDescription(req.body.description);
                    exporter.setTags(req.body.tags ? (req.body.tags as string).split(",").map(tag => tag.trim()) : []);
                    exporter.setCategory(req.body.category);
                    exporter.setPrivacy(req.body.privacy);
                }
            }
        } catch (error) {
            res.status(400).send({
                status: "ERROR",
                message: (error as Error).message || "Unknown error occurred while creating exporter",
            } as ApiErrorResponse);
            return;
        }

    } else if (mode == "file") {

        if (process.env.TCD_ENABLE_FILES_API !== "1") {
            res.status(404).send({ status: "ERROR", message: "Files API is disabled on this server. Enable with the TCD_ENABLE_FILES_API environment variable." });
            return;
        }

        const input_folder  = req.body.file_folder;
        const input_name    = req.body.file_name;

        if (!input_folder || !input_name) {
            res.status(400).send({
                status: "ERROR",
                message: "Missing input file",
            } as ApiErrorResponse);
            return;
        }

        const sanitized_input_name = sanitize(input_name);

        const full_input_dir = path.join(DataRoot, input_folder);
        const full_input_path = path.join(full_input_dir, sanitized_input_name);

        const failpath = validatePath(full_input_dir);
        if (failpath !== true) {
            res.status(400).send({
                status: "ERROR",
                message: failpath,
            } as ApiErrorResponse);
            return;
        }

        let output_directory = "";
        if (req.body.directory) {
            const dircheck = validatePath(req.body.directory);
            if (dircheck !== true) {
                res.status(400).send({
                    status: "ERROR",
                    message: dircheck,
                } as ApiErrorResponse);
                return;
            }
            output_directory = req.body.directory;
        }

        try {
            if (input_exporter == "file") {
                exporter = new FileExporter();
                if (exporter instanceof FileExporter) { // why does typescript need this??
                    exporter.loadFile(full_input_path);
                    exporter.setDirectory(output_directory || BaseConfigDataFolder.saved_vods);
                }
            } else if (input_exporter == "sftp") {
                exporter = new SFTPExporter();
                if (exporter instanceof SFTPExporter) { // why does typescript need this??
                    exporter.loadFile(full_input_path);
                    exporter.setDirectory(output_directory);
                    exporter.setHost(req.body.host);
                    exporter.setUsername(req.body.username);
                }
            } else if (input_exporter == "ftp") {
                exporter = new SFTPExporter();
                if (exporter instanceof FTPExporter) { // why does typescript need this??
                    exporter.loadFile(full_input_path);
                    exporter.setDirectory(output_directory);
                    exporter.setHost(req.body.host);
                    exporter.setUsername(req.body.username);
                    exporter.setPassword(req.body.password);
                }
            } else if (input_exporter == "youtube") {
                exporter = new YouTubeExporter();
                if (exporter instanceof YouTubeExporter) { // why does typescript need this??
                    exporter.loadFile(full_input_path);
                    exporter.setDescription(req.body.description);
                    exporter.setTags(req.body.tags ? (req.body.tags as string).split(",").map(tag => tag.trim()) : []);
                    exporter.setCategory(req.body.category);
                    exporter.setPrivacy(req.body.privacy);
                }
            }
        } catch (error) {
            res.status(400).send({
                status: "ERROR",
                message: (error as Error).message || "Unknown error occurred while creating exporter",
            } as ApiErrorResponse);
            return;
        }

    } else {
        res.status(400).send({
            status: "ERROR",
            message: "Unknown mode",
        } as ApiErrorResponse);
        return;
    }

    if (!exporter) {
        res.status(400).send({
            status: "ERROR",
            message: "Unknown exporter",
        } as ApiErrorResponse);
        return;
    }

    if (req.body.file_source) {
        try {
            exporter.setSource(req.body.file_source);
        } catch (error) {
            res.status(400).send({
                status: "ERROR",
                message: (error as Error).message ? `Set source error: ${(error as Error).message}` : "Unknown error occurred while setting source",
            } as ApiErrorResponse);
            return;
        }
    }

    if (req.body.title_template) exporter.setTemplate(req.body.title_template);
    if (req.body.title) exporter.setOutputFilename(req.body.title);

    let success;
    try {
        success = await exporter.export();
    } catch (error) {
        res.status(400).send({
            status: "ERROR",
            message: (error as Error).message ? `Export error: ${(error as Error).message}` : "Unknown error occurred while exporting vod",
        } as ApiErrorResponse);
        return;
    }

    if (!success) {
        res.status(400).send({
            status: "ERROR",
            message: "Export failed",
        } as ApiErrorResponse);
        return;
    }

    let verify;
    try {
        verify = await exporter.verify();
    } catch (error) {
        res.status(400).send({
            status: "ERROR",
            message: (error as Error).message ? `Verify error: ${(error as Error).message}` : "Unknown error occurred while verifying export",
        } as ApiErrorResponse);
        return;
    }

    res.send({
        status: "OK",
        message: typeof success == "string" ? `Export successful: ${success}` : "Export successful",
    } as ApiResponse);

    return;

}