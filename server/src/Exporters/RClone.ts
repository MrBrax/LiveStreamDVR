import { TwitchHelper } from "../Providers/Twitch";
import path from "node:path";
import fs from "node:fs";
import sanitize from "sanitize-filename";
import { BaseExporter } from "./Base";
import { BaseConfigDataFolder } from "../Core/BaseConfig";
import { Helper } from "../Core/Helper";

export class RCloneExporter extends BaseExporter {

    public type = "RClone";

    public directory = "";
    // public host = "";

    public remote_file = "";
    public remote = "";

    public supportsDirectories = true;

    setDirectory(directory: string): void {
        this.directory = directory;
    }

    setRemote(remote: string): void {
        this.remote = remote;
    }

    export(): Promise<boolean | string> {

        return new Promise<boolean | string>((resolve, reject) => {
            if (!this.filename) throw new Error("No filename");
            if (!this.extension) throw new Error("No extension");
            // if (!this.host) throw new Error("No host");
            if (!this.directory) throw new Error("No directory");
            if (!this.remote) throw new Error("No remote");
            if (!this.getFormattedTitle()) throw new Error("No title");
            if (!fs.existsSync(path.join(BaseConfigDataFolder.config, "rclone.conf"))) {
                throw new Error("rclone.conf not found. Place it in the config folder.");
            }

            const final_filename = sanitize(this.getFormattedTitle()) + "." + this.extension;

            const filesystem_path = path.join(this.directory, final_filename);
            const linux_path = filesystem_path.replace(/\\/g, "/");
            // const escaped_remote_path = linux_path.includes(" ") ? `'${linux_path}'` : linux_path;
            const remote_path = `${this.remote}:${linux_path}`;

            this.remote_file = linux_path;

            // const local_name = this.filename.replace(/\\/g, "/").replace(/^C:/, "");
            // const local_path = local_name; // local_name.includes(" ") ? `'${local_name}'` : local_name;

            const bin = "rclone";

            const args = [
                "--config", path.join(BaseConfigDataFolder.config, "rclone.conf"),
                "--progress",
                "--verbose",
                "copyto",
                this.filename,
                remote_path,
            ];

            const job = Helper.startJob("RCloneExporter_" + path.basename(this.filename), bin, args);
            if (!job) {
                reject(new Error("Failed to start job"));
                return;
            }

            job.on("error", (err) => {
                console.error("rclone error", err);
                reject(err);
            });

            job.on("log", (stream, text) => {
                const percent = text.match(/([0-9]+)%/);
                if (percent) {
                    job.setProgress(parseInt(percent[1])/100);
                }
            });

            job.on("clear", (code: number) => {
                if (code !== 0) {
                    if (job.stderr.join("").includes("didn't find section in config file")) {
                        reject(new Error(`Could not find remote '${this.remote}' in config file`));
                    } else if (job.stderr.join("").includes("The system cannot find the path specified.")) {
                        reject(new Error("The system cannot find the path specified."));
                    } else {
                        reject(new Error(`Failed to clear, code ${code}`));
                    }
                } else {
                    resolve(linux_path);
                }
            });

        });
        
    }

    // verify that the file exists over ssh
    async verify(): Promise<boolean> {

        const dirname = path.dirname(this.remote_file).includes(" ") ? `'${path.dirname(this.remote_file)}'` : path.dirname(this.remote_file);

        const bin = "rclone";
        const args = [
            "lsjson",
            "--max-depth", "1",
            `${this.remote}:${dirname}`,
        ];

        const job = await Helper.execSimple(bin, args, "rclone file check");

        const output: {
            Path: string;
            Name: string;
            Size: number;
            MimeType: string;
            ModTime: string;
            IsDir: string;
        }[] = JSON.parse(job.stdout.join("").trim());

        if (output && output.find(f => f.Name == path.basename(this.remote_file) && f.Size > 0)) {
            return true;
        }

        throw new Error("Failed to verify file, probably doesn't exist");

        return false;

    }

}