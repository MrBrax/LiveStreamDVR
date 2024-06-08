import { execSimple, startJob } from "@/Helpers/Execute";
import path from "node:path";
import sanitize from "sanitize-filename";
import { FileExporter } from "./File";

/**
 * Basic SFTP exporter to transfer the VOD to a remote SFTP server.
 * Uses scp to transfer the file.
 */
export class SFTPExporter extends FileExporter {
    public type = "SFTP";

    public host = "";
    public username = "";

    public remote_file = "";

    public supportsDirectories = true;

    public setHost(host: string): void {
        this.host = host;
    }

    public setUsername(username: string): void {
        this.username = username;
    }

    public export(): Promise<boolean | string> {
        return new Promise<boolean | string>((resolve, reject) => {
            if (!this.filename) throw new Error("No filename");
            if (!this.extension) throw new Error("No extension");
            if (!this.host) throw new Error("No host");
            if (!this.directory) throw new Error("No directory");
            if (!this.getFormattedTitle()) throw new Error("No title");

            const finalFilename =
                sanitize(this.getFormattedTitle()) + "." + this.extension;

            const filesystemPath = path.join(
                this.getFormattedDirectory(),
                finalFilename
            );
            const linuxPath = filesystemPath.replace(/\\/g, "/");
            let remotePath = `${this.host}:'${linuxPath}'`;
            if (this.username) {
                remotePath = `${this.username}@${remotePath}`;
            }

            this.remote_file = linuxPath;

            const localName = this.filename
                .replace(/\\/g, "/")
                .replace(/^C:/, "");
            const localPath = localName.includes(" ")
                ? `'${localName}'`
                : localName;

            const bin = "scp";

            const args = [
                "-p",
                "-v",
                "-B",
                // "-r",
                localPath,
                remotePath,
            ];

            const job = startJob(
                "SFTPExporter_" + path.basename(this.filename),
                bin,
                args
            );
            if (!job) {
                throw new Error("Failed to start job");
            }

            job.on("process_error", (err) => {
                console.error("sftp error", err);
                reject(err);
            });

            job.on("clear", (code) => {
                if (code !== 0) {
                    reject(new Error(`Failed to clear, code ${code}`));
                } else {
                    resolve(linuxPath);
                }
            });
        });
    }

    // verify that the file exists over ssh
    public async verify(): Promise<boolean> {
        const bin = "ssh";
        const args = [
            "-q",
            `${this.username}@${this.host}`,
            "test",
            "-e",
            `'${this.remote_file}'`,
        ];

        const job = await execSimple(bin, args, "ssh file check");

        if (job.code === 0) return true;

        throw new Error("Failed to verify file, probably doesn't exist");
    }
}
