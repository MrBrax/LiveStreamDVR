import { execSimple, startJob } from "@/Helpers/Execute";
import path from "node:path";
import sanitize from "sanitize-filename";
import { FileExporter } from "./File";

/**
 * Basic FTP exporter to transfer the VOD to a remote FTP server.
 * Uses curl to transfer the file.
 */
export class FTPExporter extends FileExporter {
    public type = "FTP";

    // public directory = "";
    public host = "";
    public username = "";
    public password = "";

    public remote_file = "";

    // public supportsDirectories = true;

    public setHost(host: string): void {
        this.host = host;
    }

    public setUsername(username: string): void {
        this.username = username;
    }

    public setPassword(password: string): void {
        this.password = password;
    }

    public export(): Promise<boolean | string> {
        return new Promise<boolean | string>((resolve, reject) => {
            if (!this.filename) throw new Error("No filename");
            if (!this.extension) throw new Error("No extension");
            if (!this.host) throw new Error("No host");

            // anonymous
            // if (!this.username) throw new Error("No username");
            // if (!this.password) throw new Error("No password");

            // if (!this.directory) throw new Error("No directory");
            if (!this.getFormattedTitle()) throw new Error("No title");

            const finalFilename =
                sanitize(this.getFormattedTitle()) + "." + this.extension;

            const filesystemPath = path.join(
                this.getFormattedDirectory(),
                finalFilename
            );
            const linuxPath = filesystemPath.replace(/\\/g, "/");
            const webPath = encodeURIComponent(linuxPath);

            this.remote_file = linuxPath;

            const localName = this.filename
                .replace(/\\/g, "/")
                .replace(/^C:/, "");
            const localPath = localName.includes(" ")
                ? `'${localName}'`
                : localName;

            let ftpUrl = `ftp://${this.host}/${webPath}`;
            if (this.username && this.password) {
                ftpUrl = `ftp://${this.username}:${this.password}@${this.host}/${webPath}`;
            }

            if (ftpUrl.includes(" ")) ftpUrl = `'${ftpUrl}'`;

            const bin = "curl";

            const args = ["-v", "-g", "-T", localPath, ftpUrl];
            //

            console.log(`${bin} ${args.join(" ")}`);

            const job = startJob(
                "FTPExporter_" + path.basename(this.filename),
                bin,
                args
            );
            if (!job) {
                throw new Error("Failed to start job");
            }

            job.on("log", (p, data) => {
                console.log(p, data);
            });

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

    // verify that the file exists over ftp
    public async verify(): Promise<boolean> {
        const webPath = encodeURIComponent(this.remote_file);

        const bin = "curl";
        const args = [
            "--list-only",
            `ftp://${this.username}:${this.password}@${
                this.host
            }/${path.dirname(webPath)}`,
        ];

        const job = await execSimple(bin, args, "ftp file check");

        const output = job.stdout.toString();

        if (output.includes(path.basename(this.remote_file))) {
            return true;
        }

        throw new Error("Failed to verify file, probably doesn't exist");
    }
}
