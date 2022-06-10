import { Job } from "Core/Job";
import { Log, LOGLEVEL } from "Core/Log";
import fs from "fs";
import path from "path";
import sanitize from "sanitize-filename";
import { BaseExporter } from "./Base";

export class FileExporter extends BaseExporter {

    public type = "File";

    public directory = "";

    private final_path = "";

    setDirectory(directory: string): void {
        if (!directory) throw new Error("No directory");
        this.directory = directory;
    }

    async export(): Promise<boolean | string> {
        if (!this.filename) throw new Error("No filename");
        if (!this.extension) throw new Error("No extension");
        if (!this.getFormattedTitle()) throw new Error("No title");

        const final_filename = sanitize(this.getFormattedTitle()) + "." + this.extension;

        this.final_path = path.join(this.directory, final_filename);

        if (fs.existsSync(this.final_path)) {
            throw new Error(`File already exists: ${this.final_path}`);
        }

        Log.logAdvanced(LOGLEVEL.INFO, "FileExporter", `Exporting ${this.filename} to ${this.final_path}...`);

        const job = Job.create(`FileExporter_${path.basename(this.final_path)}`);
        job.dummy = true;
        job.save();

        const filesize = fs.statSync(this.filename).size;

        const ticker = setInterval(() => {
            if (!fs.existsSync(this.final_path)) return;
            if (!job) {
                clearInterval(ticker);
                return;
            }
            job.setProgress(fs.statSync(this.final_path).size / filesize);
            // hope there won't be any leaks...
        }, 5000);

        await fs.promises.copyFile(this.filename, this.final_path);

        job.clear();

        clearInterval(ticker);

        return fs.existsSync(this.final_path) ? this.final_path : false;
    }

    async verify(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            const exists = fs.existsSync(this.final_path);
            resolve(exists);
        });
    }

}