import path from "path";
import fs from "fs";
import { TwitchConfig } from "./TwitchConfig";
import { format } from "date-fns";
import axios from "axios";

export enum LOGLEVEL {
    ERROR = "ERROR",
	WARNING = "WARNING",
	INFO = "INFO",
	DEBUG = "DEBUG",
	FATAL = "FATAL",
	SUCCESS = "SUCCESS",
}

interface LogLine {
    module: string;
    date: number;
    level: LOGLEVEL;
    text: string;
    metadata?: any;
}

export class TwitchHelper {

    static config_folder 	= path.join(__dirname, "..", "..", "config");
	static public_folder 	= path.join(__dirname, "..", "..", "public");
	static logs_folder 		= path.join(__dirname, "..", "..", "logs");
	static cache_folder 	= path.join(__dirname, "..", "..", "cache");
	static cron_folder 		= path.join(__dirname, "..", "..", "cache", "cron");
	static pids_folder 		= path.join(__dirname, "..", "..", "cache", "pids");
	static vod_folder 		= path.join(__dirname, "..", "..", "public", "vods");

    static accessToken = "";

	static accessTokenFile = path.join(this.cache_folder, "oauth.bin");

	static accessTokenExpire = 60 * 60 * 24 * 60; // 60 days
	static accessTokenRefresh = 60 * 60 * 24 * 30; // 30 days

    static logAdvanced(level: LOGLEVEL, module: string, text: string, metadata?: any) {
        if (!TwitchConfig.cfg("debug") && level == LOGLEVEL.DEBUG) return;

        // check if folder exists
        if (!fs.existsSync(TwitchHelper.logs_folder)) {
            throw new Error("Log folder does not exist!");
        }

        // today's filename in Y-m-d format
        const date = new Date();
        const filename = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}.log`;
        const filepath = path.join(TwitchHelper.logs_folder, filename);
        const jsonlinename = filepath + ".jsonline";

        const dateFormat = "yyyy-MM-dd HH:mm:ss.SSS";
        const dateString = format(date, dateFormat);

        // write cleartext
        const textOutput = `${dateString} | ${module} <${level}> ${text}`;
        fs.appendFileSync(filepath, textOutput + "\n");

        // if docker, output to stdout
        if (TwitchConfig.cfg("docker")) {
            console.log(textOutput);
        }

        console.log(textOutput);

        let log_data: LogLine = {
			"module": module,
			"date": Date.now(),
			"level": level,
			"text": text
        };

		if (metadata !== undefined) log_data['metadata'] = metadata;

        // write jsonline
        fs.appendFileSync(jsonlinename, JSON.stringify(log_data) + "\n");

    }

    static async getAccessToken(force = false): Promise<string> {
        // token should last 60 days, delete it after 30 just to be sure
		if (fs.existsSync(this.accessTokenFile)) {
			
            /*
			if (time() > filemtime(this.accessTokenFile) + TwitchHelper::$accessTokenRefresh) {
				this.logAdvanced(LOGLEVEL.INFO, "helper", "Deleting old access token");
				unlink(this.accessTokenFile);
			}
            */
            if (Date.now() > fs.statSync(this.accessTokenFile).mtimeMs + this.accessTokenRefresh) {
                this.logAdvanced(LOGLEVEL.INFO, "helper", "Deleting old access token");
                fs.unlinkSync(this.accessTokenFile);
            }
		}

		if (!force && fs.existsSync(this.accessTokenFile)) {
			this.logAdvanced(LOGLEVEL.DEBUG, "helper", "Fetched access token from cache");
			return fs.readFileSync(this.accessTokenFile, "utf8");
		}

		if (!TwitchConfig.cfg('api_secret') || !TwitchConfig.cfg('api_client_id')) {
			this.logAdvanced(LOGLEVEL.ERROR, "helper", "Missing either api secret or client id, aborting fetching of access token!");
			throw new Error("Missing either api secret or client id, aborting fetching of access token!");
		}


		// oauth2
		const oauth_url = 'https://id.twitch.tv/oauth2/token';

        /*
		try {
			$response = $client->post($oauth_url, [
				'query' => [
					'client_id' => TwitchConfig::cfg('api_client_id'),
					'client_secret' => TwitchConfig::cfg('api_secret'),
					'grant_type' => 'client_credentials'
				],
				'headers' => [
					'Client-ID: ' . TwitchConfig::cfg('api_client_id')
				]
			]);
		} catch (\Throwable $th) {
			this.logAdvanced(LOGLEVEL.FATAL, "helper", "Tried to get oauth token but server returned: " . $th->getMessage());
			sleep(5);
			return false;
		}
        */

        const response = await axios.post(oauth_url, {
            'client_id': TwitchConfig.cfg('api_client_id'),
            'client_secret': TwitchConfig.cfg('api_secret'),
            'grant_type': 'client_credentials'
        }, {
            headers: {
                'Client-ID': TwitchConfig.cfg('api_client_id')
            }
        });

        if (response.status != 200) {
            this.logAdvanced(LOGLEVEL.FATAL, "helper", "Tried to get oauth token but server returned: " + response.statusText);
            throw new Error("Tried to get oauth token but server returned: " + response.statusText);
        }

        const json = response.data;

		if (!json || !json.access_token) {
			this.logAdvanced(LOGLEVEL.ERROR, "helper", `Failed to fetch access token: ${json}`);
			throw new Error(`Failed to fetch access token: ${json}`);
		}

		const access_token = json.access_token;

		this.accessToken = access_token;

		fs.writeFileSync(this.accessTokenFile, access_token);

		this.logAdvanced(LOGLEVEL.INFO, "helper", "Fetched new access token");

		return access_token;
    }

}