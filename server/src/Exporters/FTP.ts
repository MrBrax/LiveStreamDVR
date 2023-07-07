import { Helper } from "../Core/Helper";
import path from "node:path";
import sanitize from "sanitize-filename";
import { BaseExporter } from "./Base";
import { execSimple, startJob } from "../Helpers/Execute";

export class FTPExporter extends BaseExporter {

    public type = "FTP";

    public directory = "";
    public host = "";
    public username = "";
    public password = "";

    public remote_file = "";

    // public supportsDirectories = true;

    setDirectory(directory: string): void {
        this.directory = directory;
    }

    setHost(host: string): void {
        this.host = host;
    }

    setUsername(username: string): void {
        this.username = username;
    }

    setPassword(password: string): void {
        this.password = password;
    }

    export(): Promise<boolean | string> {

        return new Promise<boolean | string>((resolve, reject) => {
            if (!this.filename) throw new Error("No filename");
            if (!this.extension) throw new Error("No extension");
            if (!this.host) throw new Error("No host");

            // anonymous
            // if (!this.username) throw new Error("No username");
            // if (!this.password) throw new Error("No password");

            // if (!this.directory) throw new Error("No directory");
            if (!this.getFormattedTitle()) throw new Error("No title");

            const final_filename = sanitize(this.getFormattedTitle()) + "." + this.extension;

            const filesystem_path = path.join(this.directory, final_filename);
            const linux_path = filesystem_path.replace(/\\/g, "/");
            const web_path = encodeURIComponent(linux_path);

            this.remote_file = linux_path;

            const local_name = this.filename.replace(/\\/g, "/").replace(/^C:/, "");
            const local_path = local_name.includes(" ") ? `'${local_name}'` : local_name;

            let ftp_url = `ftp://${this.host}/${web_path}`;
            if (this.username && this.password) {
                ftp_url = `ftp://${this.username}:${this.password}@${this.host}/${web_path}`;
            }

            if (ftp_url.includes(" ")) ftp_url = `'${ftp_url}'`;

            const bin = "curl";

            const args = [
                "-v",
                "-g",
                "-T",
                local_path,
                ftp_url,
            ];
            //

            console.log(`${bin} ${args.join(" ")}`);

            const job = startJob("FTPExporter_" + path.basename(this.filename), bin, args);
            if (!job) {
                throw new Error("Failed to start job");
            }

            job.on("log", (p, data) => {
                console.log(p, data);
            }).on("output", (p, data) => {
                console.log(p, data);
            });

            job.on("error", (err) => {
                console.error("sftp error", err);
                reject(err);
            });

            job.on("clear", (code: number) => {
                if (code !== 0) {
                    reject(new Error(`Failed to clear, code ${code}`));
                } else {
                    resolve(linux_path);
                }
            });

        });

    }

    // verify that the file exists over ftp
    async verify(): Promise<boolean> {

        const web_path = encodeURIComponent(this.remote_file);

        const bin = "curl";
        const args = [
            "--list-only",
            `ftp://${this.username}:${this.password}@${this.host}/${path.dirname(web_path)}`,
        ];

        const job = await execSimple(bin, args, "ftp file check");

        const output = job.stdout.toString();

        if (output.includes(path.basename(this.remote_file))) {
            return true;
        }

        throw new Error("Failed to verify file, probably doesn't exist");

    }

}