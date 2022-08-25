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

type Exporter = FileExporter | YouTubeExporter | SFTPExporter | FTPExporter;

interface ExporterOptions {
    vod?: string;
    directory?: string;
    host?: string;
    username?: string;
    password?: string;
    description?: string;
    tags?: string;
    category?: string;
    privacy?: "public" | "private" | "unlisted";
    file_folder?: string;
    file_name?: string;
    file_source?: "segment" | "downloaded" | "burned";
    title_template?: string;
    title?: string;
}

export function GetExporter(name: string, mode: string, options: ExporterOptions): Exporter {

    let exporter: Exporter | undefined;

    if (mode === "vod") {

        if (!options.vod) {
            throw new Error("No VOD chosen");
        }

        const vod = TwitchVOD.getVod(options.vod);

        if (!vod) {
            throw new Error("Vod not found");
        }

        if (!vod.is_finalized) {
            throw new Error("Vod is not finalized");
        }

        if (!vod.segments || vod.segments.length == 0) {
            throw new Error("Vod has no segments");
        }

        try {
            if (name == "file") {
                exporter = new FileExporter();
                if (exporter instanceof FileExporter) { // why does typescript need this??
                    exporter.loadVOD(vod);
                    exporter.setDirectory(options.directory || BaseConfigDataFolder.saved_vods);
                }
            } else if (name == "sftp") {
                if (!options.directory) throw ("No directory set");
                if (!options.host) throw ("No host set");
                if (!options.username) throw ("No username set");
                exporter = new SFTPExporter();
                if (exporter instanceof SFTPExporter) { // why does typescript need this??
                    exporter.loadVOD(vod);
                    exporter.setDirectory(options.directory);
                    exporter.setHost(options.host);
                    exporter.setUsername(options.username);
                }
            } else if (name == "ftp") {
                if (!options.directory) throw ("No directory set");
                if (!options.host) throw ("No host set");
                if (!options.username) throw ("No username set");
                if (!options.password) throw ("No password set");
                exporter = new FTPExporter();
                if (exporter instanceof FTPExporter) { // why does typescript need this??
                    exporter.loadVOD(vod);
                    exporter.setDirectory(options.directory);
                    exporter.setHost(options.host);
                    exporter.setUsername(options.username);
                    exporter.setPassword(options.password);
                }
            } else if (name == "youtube") {
                if (!options.category) throw ("No category set");
                if (!options.privacy) throw ("No privacy level set");
                exporter = new YouTubeExporter();
                if (exporter instanceof YouTubeExporter) { // why does typescript need this??
                    exporter.loadVOD(vod);
                    exporter.setDescription(options.description || "");
                    exporter.setTags(options.tags ? (options.tags as string).split(",").map(tag => tag.trim()) : []);
                    exporter.setCategory(options.category);
                    exporter.setPrivacy(options.privacy);
                }
            }
        } catch (error) {
            throw new Error("Exporter creation error: " + (error as Error).message);
        }

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

        let output_directory = "";
        if (options.directory) {
            const dircheck = validatePath(options.directory);
            if (dircheck !== true) {
                throw new Error(dircheck.toString());
            }
            output_directory = options.directory;
        }

        try {
            if (name == "file") {
                exporter = new FileExporter();
                if (exporter instanceof FileExporter) { // why does typescript need this??
                    exporter.loadFile(full_input_path);
                    exporter.setDirectory(output_directory || BaseConfigDataFolder.saved_vods);
                }
            } else if (name == "sftp") {
                if (!options.directory) throw ("No directory set");
                if (!options.host) throw ("No host set");
                if (!options.username) throw ("No username set");
                exporter = new SFTPExporter();
                if (exporter instanceof SFTPExporter) { // why does typescript need this??
                    exporter.loadFile(full_input_path);
                    exporter.setDirectory(output_directory);
                    exporter.setHost(options.host);
                    exporter.setUsername(options.username);
                }
            } else if (name == "ftp") {
                if (!options.directory) throw ("No directory set");
                if (!options.host) throw ("No host set");
                if (!options.username) throw ("No username set");
                if (!options.password) throw ("No password set");
                exporter = new SFTPExporter();
                if (exporter instanceof FTPExporter) { // why does typescript need this??
                    exporter.loadFile(full_input_path);
                    exporter.setDirectory(output_directory);
                    exporter.setHost(options.host);
                    exporter.setUsername(options.username);
                    exporter.setPassword(options.password);
                }
            } else if (name == "youtube") {
                if (!options.category) throw ("No category set");
                if (!options.privacy) throw ("No privacy level set");
                exporter = new YouTubeExporter();
                if (exporter instanceof YouTubeExporter) { // why does typescript need this??
                    exporter.loadFile(full_input_path);
                    exporter.setDescription(options.description || "");
                    exporter.setTags(options.tags ? (options.tags as string).split(",").map(tag => tag.trim()) : []);
                    exporter.setCategory(options.category);
                    exporter.setPrivacy(options.privacy);
                }
            }
        } catch (error) {
            throw new Error("Exporter creation error: " + (error as Error).message);
        }

    } else {
        throw new Error("Unknown mode");
    }

    if (!exporter) {
        throw new Error("Unknown exporter");
    }

    if (options.file_source) {
        try {
            exporter.setSource(options.file_source);
        } catch (error) {
            throw new Error((error as Error).message ? `Set source error: ${(error as Error).message}` : "Unknown error occurred while setting source");
        }
    }

    if (options.title_template) exporter.setTemplate(options.title_template);
    if (options.title) exporter.setOutputFilename(options.title);

    return exporter;

}

export async function ExportFile(req: express.Request, res: express.Response): Promise<void> {

    const mode = req.query.mode as string;
    const input_exporter = req.body.exporter;

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

    res.send({
        status: "OK",
        message: typeof success == "string" ? `Export successful: ${success}` : "Export successful",
    } as ApiResponse);

    return;

}