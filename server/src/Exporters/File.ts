import { Job } from "@/Core/Job";
import { log, LOGLEVEL } from "@/Core/Log";
import { xClearInterval, xInterval } from "@/Helpers/Timeout";
import fs from "node:fs";
import path from "node:path";
import sanitize from "sanitize-filename";
import { BaseExporter } from "./Base";

/**
 * Basic file exporter to copy the VOD to a directory on the local filesystem.
 */
export class FileExporter extends BaseExporter {
    public type = "File";
    public directory = "";
    public supportsDirectories = true;
    private final_path = "";

    public setDirectory(directory: string): void {
        if (!directory) throw new Error("No directory");
        this.directory = directory;
    }

    public override async export(): Promise<boolean | string> {
        if (!this.filename) throw new Error("No filename");
        if (!this.extension) throw new Error("No extension");
        if (!this.getFormattedTitle()) throw new Error("No title");

        const finalFilename =
            sanitize(this.getFormattedTitle()) + "." + this.extension;

        this.final_path = path.join(this.directory, finalFilename);

        if (fs.existsSync(this.final_path)) {
            throw new Error(`File already exists: ${this.final_path}`);
        }

        log(
            LOGLEVEL.INFO,
            "FileExporter.export",
            `Exporting ${this.filename} to ${this.final_path}...`
        );

        const job = Job.create(
            `FileExporter_${path.basename(this.final_path)}`
        );
        job.dummy = true;
        job.save();

        const filesize = fs.statSync(this.filename).size;

        const ticker = xInterval(() => {
            if (!fs.existsSync(this.final_path)) return;
            if (!job) {
                xClearInterval(ticker);
                return;
            }
            job.setProgress(fs.statSync(this.final_path).size / filesize);
            // hope there won't be any leaks...
        }, 5000);

        await fs.promises.copyFile(this.filename, this.final_path);

        job.clear();

        xClearInterval(ticker);

        return fs.existsSync(this.final_path) ? this.final_path : false;
    }

    public override async verify(): Promise<boolean> {
        return await new Promise<boolean>((resolve, reject) => {
            // resolve(fs.existsSync(this.final_path));
            fs.access(this.final_path, fs.constants.F_OK, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(true);
                }
            });
        });
    }
}
