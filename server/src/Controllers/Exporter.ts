import express from "express";
import path from "node:path";
import sanitize from "sanitize-filename";
import { ApiErrorResponse, ApiResponse } from "../../../common/Api/Api";
import { ExporterOptions } from "../../../common/Exporter";
import { BaseConfigDataFolder, DataRoot } from "../Core/BaseConfig";
import { LiveStreamDVR } from "../Core/LiveStreamDVR";
import { FileExporter } from "../Exporters/File";
import { FTPExporter } from "../Exporters/FTP";
import { RCloneExporter } from "../Exporters/RClone";
import { SFTPExporter } from "../Exporters/SFTP";
import { YouTubeExporter } from "../Exporters/YouTube";
import { validatePath } from "./Files";

export type Exporter = FileExporter | YouTubeExporter | SFTPExporter | FTPExporter | RCloneExporter;


export function GetExporter(name: string, mode: string, options: ExporterOptions): Exporter {

    let exporter: Exporter | undefined;

    let output_directory = "";
    if (options.directory) {
        const dircheck = validatePath(options.directory);
        if (dircheck !== true && name == "file") {
            console.error(`Invalid path: ${options.directory}`);
            throw new Error(dircheck.toString());
        }
        output_directory = options.directory;
    }

    console.log("Create exporter", name, mode, options);

    try {
        if (name == "file") {
            exporter = new FileExporter();
            if (exporter instanceof FileExporter) { // why does typescript need this??
                exporter.setDirectory(output_directory || BaseConfigDataFolder.saved_vods);
            }
        } else if (name == "sftp") {
            if (!output_directory) throw new Error("No directory set");
            if (!options.host) throw new Error("No host set");
            if (!options.username) throw new Error("No username set");
            exporter = new SFTPExporter();
            if (exporter instanceof SFTPExporter) { // why does typescript need this??
                exporter.setDirectory(output_directory);
                exporter.setHost(options.host);
                exporter.setUsername(options.username);
            }
        } else if (name == "ftp") {
            if (!output_directory) throw new Error("No directory set");
            if (!options.host) throw new Error("No host set");
            if (!options.username) throw new Error("No username set");
            if (!options.password) throw new Error("No password set");
            exporter = new FTPExporter();
            if (exporter instanceof FTPExporter) { // why does typescript need this??
                exporter.setDirectory(output_directory);
                exporter.setHost(options.host);
                exporter.setUsername(options.username);
                exporter.setPassword(options.password);
            }
        } else if (name == "youtube") {
            if (!options.category) throw new Error("No category set");
            if (!options.privacy) throw new Error("No privacy level set");
            exporter = new YouTubeExporter();
            if (exporter instanceof YouTubeExporter) { // why does typescript need this??
                exporter.setDescription(options.description || "");
                exporter.setTags(options.tags ? (options.tags as string).split(",").map(tag => tag.trim()) : []);
                exporter.setCategory(options.category);
                exporter.setPrivacy(options.privacy);
                if (options.playlist_id) exporter.setPlaylist(options.playlist_id);
            }
        } else if (name == "rclone") {
            if (!output_directory) throw new Error("No directory set");
            if (!options.remote) throw new Error("No remote set");
            exporter = new RCloneExporter();
            if (exporter instanceof RCloneExporter) { // why does typescript need this??
                exporter.setDirectory(output_directory);
                exporter.setRemote(options.remote);
            }
        }
    } catch (error) {
        throw new Error("Exporter creation error: " + (error as Error).message);
    }

    if (!exporter) {
        throw new Error("Unknown exporter");
    }

    if (mode === "vod") {

        if (!options.vod) {
            throw new Error("No VOD chosen");
        }

        const vod = LiveStreamDVR.getInstance().getVodByUUID(options.vod);

        if (!vod) {
            throw new Error(`Vod not found: ${options.vod}`);
        }

        if (!vod.is_finalized) {
            throw new Error("Vod is not finalized");
        }

        if (!vod.segments || vod.segments.length == 0) {
            throw new Error("Vod has no segments");
        }

        exporter.loadVOD(vod);

    } else if (mode == "file") {

        const input_folder = options.file_folder;
        const input_name = options.file_name;

        if (!input_folder || !input_name) {
            throw new Error("Missing input file");
        }

        const sanitized_input_name = sanitize(input_name);

        const full_input_dir = path.join(DataRoot, input_folder);
        const full_input_path = path.join(full_input_dir, sanitized_input_name);

        const failpath = validatePath(full_input_dir);
        if (failpath !== true) {
            throw new Error(failpath.toString());
        }

        exporter.loadFile(full_input_path);

    } else {
        throw new Error("Unknown mode");
    }

    if (options.file_source) {
        try {
            exporter.setSource(options.file_source);
        } catch (error) {
            throw new Error((error as Error).message ? `Set source error: ${(error as Error).message}` : "Unknown error occurred while setting source");
        }
    }

    if (options.vod) {
        if (options.title_template) exporter.setTemplate(options.title_template);
        if (options.title) exporter.setOutputFilename(options.title);
    } else {
        if (options.title_template) exporter.setTemplate(options.title_template);
        if (options.title) exporter.setTemplate(options.title);
    }

    return exporter;

}

export async function ExportFile(req: express.Request, res: express.Response): Promise<void> {

    const mode = req.query.mode as string;
    const input_exporter = req.query.exporter as string;

    if (!input_exporter) {
        res.status(400).send({
            status: "ERROR",
            message: "No exporter specified",
        } as ApiErrorResponse);
        return;
    }

    if (mode == "file" && process.env.TCD_ENABLE_FILES_API !== "1") {
        res.status(500).send({
            status: "ERROR",
            message: "Files API is disabled on this server. Enable with the TCD_ENABLE_FILES_API environment variable.",
        } as ApiErrorResponse);
        return;
    }

    let exporter: Exporter | undefined;

    try {
        exporter = GetExporter(input_exporter, mode, req.body);
    } catch (error) {
        res.status(400).send({
            status: "ERROR",
            message: "Invalid exporter returned: " + (error as Error).message,
        } as ApiErrorResponse);
        return;
    }

    // FIXME: DRY this up, more sanitization of the input

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

    if (exporter.vod && verify) {
        exporter.vod.exportData.exported_at = new Date().toISOString();
        exporter.vod.saveJSON("export successful");
    }

    res.send({
        status: "OK",
        message: `Export successful: ${verify}`,
    } as ApiResponse);

    return;

}