import { format } from "date-fns";
import fs from "fs";
import { formatString } from "Helpers/Format";
import path from "path";
import sanitize from "sanitize-filename";
import { BaseExporter } from "./Base";

export class FileExporter extends BaseExporter {

    public type = "File";

    public directory = "";

    private final_path = "";

    setDirectory(directory: string): void {
        this.directory = directory;
    }

    async export(): Promise<boolean> {
        if (!this.vod) throw new Error("No VOD loaded");
        if (!this.filename) throw new Error("No filename");
        if (!this.template_filename) throw new Error("No template filename");
        if (!this.extension) throw new Error("No extension");
        if (!this.vod.started_at) throw new Error("No started_at");
        if (!this.vod.video_metadata) throw new Error("No video_metadata");

        const final_filename = sanitize(this.getFormattedTitle()) + "." + this.extension;

        this.final_path = path.join(this.directory, final_filename);

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