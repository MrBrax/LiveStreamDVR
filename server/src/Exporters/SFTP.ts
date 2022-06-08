import { Helper } from "Core/Helper";
import fs from "fs";
import path from "path";
import sanitize from "sanitize-filename";
import { BaseExporter } from "./Base";

export class SFTPExporter extends BaseExporter {

    public type = "SFTP";

    public directory = "";
    public host = "";
    public username = "";

    public remote_file = "";

    setDirectory(directory: string): void {
        this.directory = directory;
    }

    setHost(host: string): void {
        this.host = host;
    }

    setUsername(username: string): void {
        this.username = username;
    }

    export(): Promise<boolean> {

        return new Promise<boolean>((resolve, reject) => {
            if (!this.vod) throw new Error("No VOD loaded");
            if (!this.filename) throw new Error("No filename");
            if (!this.template_filename) throw new Error("No template filename");
            if (!this.extension) throw new Error("No extension");
            if (!this.vod.started_at) throw new Error("No started_at");
            if (!this.vod.video_metadata) throw new Error("No video_metadata");
            if (!this.host) throw new Error("No host");
            if (!this.directory) throw new Error("No directory");

            const final_filename = sanitize(this.getFormattedTitle()) + "." + this.extension;

            const filesystem_path = path.join(this.directory, final_filename);
            const linux_path = filesystem_path.replace(/\\/g, "/");
            let remote_path = `${this.host}:'${linux_path}'`;
            if (this.username) {
                remote_path = `${this.username}@${remote_path}`;
            }

            this.remote_file = linux_path;

            const local_name = this.filename.replace(/\\/g, "/").replace(/^C:/, "");
            const local_path = local_name.includes(" ") ? `'${local_name}'` : local_name;

            const bin = "scp";

            const args = [
                "-p",
                "-v",
                "-B",
                // "-r",
                local_path,
                remote_path,
            ];

            const job = Helper.startJob("SFTPExporter_" + this.vod.basename, bin, args);
            if (!job) {
                throw new Error("Failed to start job");
            }

            job.on("error", (err) => {
                console.error("sftp error", err);
                reject(err);
            });

            job.on("clear", (code: number) => {
                if (code !== 0) {
                    reject(new Error(`Failed to clear, code ${code}`));
                } else {
                    resolve(true);
                }
            });

        });
        
    }

    async verify(): Promise<boolean> {

        return true; // no way to verify over ssh
    
        /*
        if (!this.remote_file) return false;

        const bin = "ssh";

        const args = [
            "-q",
            `${this.username}@${this.host}`,
            `"test -e ${this.remote_file} && echo FOUND"`,
        ];

        const job = await Helper.execSimple(bin, args, "ssh file check");
        
        console.log("ssh result", job);

        if (job.stdout.includes("FOUND") || job.stderr.includes("FOUND")) {
            return true;
        } else {
            return false;
        }
        */

        // return job.code === 0;
    }

}