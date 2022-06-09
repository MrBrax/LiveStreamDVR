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

    async export(): Promise<boolean> {
        if (!this.filename) throw new Error("No filename");
        if (!this.extension) throw new Error("No extension");
        if (!this.getFormattedTitle()) throw new Error("No title");

        const final_filename = sanitize(this.getFormattedTitle()) + "." + this.extension;

        this.final_path = path.join(this.directory, final_filename);

        Log.logAdvanced(LOGLEVEL.INFO, "FileExporter", `Exporting ${this.filename} to ${this.final_path}...`);

        await fs.promises.copyFile(this.filename, this.final_path);
        return fs.existsSync(this.final_path);
    }

    async verify(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            const exists = fs.existsSync(this.final_path);
            resolve(exists);
        });
    }

}