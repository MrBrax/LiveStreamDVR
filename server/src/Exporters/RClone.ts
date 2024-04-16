import { BaseConfigDataFolder } from "@/Core/BaseConfig";
import { execSimple, startJob } from "@/Helpers/Execute";
import fs from "node:fs";
import path from "node:path";
import sanitize from "sanitize-filename";
import { z } from "zod";
import { FileExporter } from "./File";

// export const rCloneExporterConfigSchema = z.object({
//     type: z.literal("RClone"),
//     directory: z.string(),
//     remote: z.string(),
// });

const rCloneLsJsonSchema = z.array(
    z.object({
        Path: z.string(),
        Name: z.string(),
        Size: z.number(),
        MimeType: z.string(),
        ModTime: z.string(),
        IsDir: z.string(),
    })
);

export class RCloneExporter extends FileExporter {
    public type = "RClone";

    // public host = "";

    public remote_file = "";
    public remote = "";

    public supportsDirectories = true;

    public static async getRemotes(): Promise<string[]> {
        let result;
        try {
            result = await execSimple(
                "rclone",
                ["listremotes"],
                "rclone list remotes"
            );
        } catch (error) {
            throw new Error("Failed to list remotes");
        }

        const output = result.stdout.join("").trim();

        return output
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length > 0)
            .map((l) => l.replace(/:$/, ""));
    }

    public setDirectory(directory: string): void {
        this.directory = directory;
    }

    public setRemote(remote: string): void {
        this.remote = remote;
    }

    public export(): Promise<boolean | string> {
        return new Promise<boolean | string>((resolve, reject) => {
            if (!this.filename) throw new Error("No filename");
            if (!this.extension) throw new Error("No extension");
            // if (!this.host) throw new Error("No host");
            if (!this.directory) throw new Error("No directory");
            if (!this.remote) throw new Error("No remote");
            if (!this.getFormattedTitle()) throw new Error("No title");
            if (
                !fs.existsSync(
                    path.join(BaseConfigDataFolder.config, "rclone.conf")
                )
            ) {
                throw new Error(
                    "rclone.conf not found. Place it in the config folder."
                );
            }

            const finalFilename =
                sanitize(this.getFormattedTitle()) + "." + this.extension;

            const filesystemPath = path.join(
                this.getFormattedDirectory(),
                finalFilename
            );
            const linuxPath = filesystemPath.replace(/\\/g, "/");
            // const escaped_remote_path = linux_path.includes(" ") ? `'${linux_path}'` : linux_path;
            const remotePath = `${this.remote}:${linuxPath}`;

            this.remote_file = linuxPath;

            // const local_name = this.filename.replace(/\\/g, "/").replace(/^C:/, "");
            // const local_path = local_name; // local_name.includes(" ") ? `'${local_name}'` : local_name;

            const bin = "rclone";

            const args = [
                "--config",
                path.join(BaseConfigDataFolder.config, "rclone.conf"),
                "--progress",
                "--verbose",
                "copyto",
                this.filename,
                remotePath,
            ];

            const job = startJob(
                "RCloneExporter_" + path.basename(this.filename),
                bin,
                args
            );
            if (!job) {
                reject(new Error("Failed to start job"));
                return;
            }

            job.on("process_error", (err) => {
                console.error("rclone error", err);
                reject(err);
            });

            job.on("log", (stream, text) => {
                const percent = text.match(/([0-9]+)%/);
                if (percent) {
                    job.setProgress(parseInt(percent[1]) / 100);
                }
            });

            job.on("clear", (code) => {
                if (code !== 0) {
                    if (
                        job.stderr
                            .join("")
                            .includes("didn't find section in config file")
                    ) {
                        reject(
                            new Error(
                                `Could not find remote '${this.remote}' in config file`
                            )
                        );
                    } else if (
                        job.stderr
                            .join("")
                            .includes(
                                "The system cannot find the path specified."
                            )
                    ) {
                        reject(
                            new Error(
                                "The system cannot find the path specified."
                            )
                        );
                    } else {
                        reject(new Error(`Failed to clear, code ${code}`));
                    }
                } else {
                    resolve(linuxPath);
                }
            });
        });
    }

    // verify that the file exists over ssh
    public async verify(): Promise<boolean> {
        const dirname = path.dirname(this.remote_file).includes(" ")
            ? `'${path.dirname(this.remote_file)}'`
            : path.dirname(this.remote_file);

        const bin = "rclone";
        const args = [
            "lsjson",
            "--max-depth",
            "1",
            `${this.remote}:${dirname}`,
        ];

        const job = await execSimple(bin, args, "rclone file check");

        const output = rCloneLsJsonSchema.parse(
            JSON.parse(job.stdout.join("").trim())
        );

        if (
            output &&
            output.find(
                (f) => f.Name == path.basename(this.remote_file) && f.Size > 0
            )
        ) {
            return true;
        }

        throw new Error("Failed to verify file, probably doesn't exist");
    }
}
