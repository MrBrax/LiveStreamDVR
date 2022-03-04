import path from "path";
import fs from "fs";
import { TwitchConfig } from "./TwitchConfig";
import { format } from "date-fns";
import axios, { Axios } from "axios";
import chalk from "chalk";
import { BaseConfigFolder } from "./BaseConfig";

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

	static axios: Axios;

    static accessToken = "";

	static readonly accessTokenFile = path.join(BaseConfigFolder.cache, "oauth.bin");

	static readonly accessTokenExpire = 60 * 60 * 24 * 60; // 60 days
	static readonly accessTokenRefresh = 60 * 60 * 24 * 30; // 30 days

	static readonly PHP_DATE_FORMAT = "yyyy-MM-dd HH:mm:ss.SSSSSS";
	static readonly TWITCH_DATE_FORMAT = "yyyy-MM-dd'T'HH:mm:ss'Z'";
	static readonly TWITCH_DATE_FORMAT_MS = "yyyy-MM-dd'T'HH:mm:ss'.'SSS'Z'";

	static readonly LOG_COLORS = {
		[LOGLEVEL.ERROR]: chalk.red,
		[LOGLEVEL.WARNING]: chalk.yellow,
		[LOGLEVEL.INFO]: chalk.blue,
		[LOGLEVEL.DEBUG]: chalk.gray,
		[LOGLEVEL.FATAL]: chalk.red,
		[LOGLEVEL.SUCCESS]: chalk.green,
	};

	static readonly SUBSTATUS = {
		NONE: "0",
		WAITING: "1",
		SUBSCRIBED: "2",
		FAILED: "3",
	};

    static logAdvanced(level: LOGLEVEL, module: string, text: string, metadata?: any) {
        if (!TwitchConfig.cfg("debug") && level == LOGLEVEL.DEBUG) return;

        // check if folder exists
        if (!fs.existsSync(BaseConfigFolder.logs)) {
            throw new Error("Log folder does not exist!");
        }

        // today's filename in Y-m-d format
        const date = new Date();
        const filename = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}.log`;
        const filepath = path.join(BaseConfigFolder.logs, filename);
        const jsonlinename = filepath + ".jsonline";

        const dateFormat = "yyyy-MM-dd HH:mm:ss.SSS";
        const dateString = format(date, dateFormat);

        // write cleartext
        const textOutput = `${dateString} | ${module} <${level}> ${text}`;
        fs.appendFileSync(filepath, textOutput + "\n");

        // if docker, output to stdout
        // if (TwitchConfig.cfg("docker")) {
        //     console.log(textOutput);
        // }

		console.log(
			TwitchHelper.LOG_COLORS[level](`${dateString} | ${module} <${level}> ${text}`)
		);
        

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

    public static vodFolder(username: string = "")
	{
		return BaseConfigFolder.vod + (TwitchConfig.cfg("channel_folders") && username !== "" ? path.sep + username : '');
	}

	public static JSDateToPHPDate(date: Date){
		return {
			date: format(date, this.PHP_DATE_FORMAT),
			timezone_type: 3,
			timezone: 'UTC',
		};
	}

	public static getNiceDuration(duration: number){
		// format 1d 2h 3m 4s

		const days = Math.floor(duration / (60 * 60 * 24));
		const hours = Math.floor((duration - (days * 60 * 60 * 24)) / (60 * 60));
		const minutes = Math.floor((duration - (days * 60 * 60 * 24) - (hours * 60 * 60)) / 60);
		const seconds = duration - (days * 60 * 60 * 24) - (hours * 60 * 60) - (minutes * 60);

		let str = "";

		if (days > 0) str += days + "d ";
		if (hours > 0) str += hours + "h ";
		if (minutes > 0) str += minutes + "m ";
		if (seconds > 0) str += seconds + "s";

		return str.trim();
		
	}

	public static path_mediainfo()
	{

		if (TwitchConfig.cfg('mediainfo_path')) return TwitchConfig.cfg('mediainfo_path');

		// const path = this.whereis("mediainfo", "mediainfo.exe");
		// if (path) {
		// 	TwitchConfig.setConfig('mediainfo_path', path);
		// 	TwitchConfig.saveConfig("path resolver");
		// 	return path;
		// }

		return false;
	}

	public static async eventSubUnsubscribe(subscription_id: string)
	{

		this.logAdvanced(LOGLEVEL.INFO, "helper", "Unsubscribing from eventsub id {$subscription_id}");

		let response;

		try {
			// $response = $this->$guzzler->request("DELETE", "/helix/eventsub/subscriptions?id={$subscription_id}");
			response = await this.axios.delete(`/helix/eventsub/subscriptions?id=${subscription_id}`);
		} catch (th) {
			this.logAdvanced(LOGLEVEL.FATAL, "helper", `Unsubscribe from eventsub ${subscription_id} error: ${th}`);
			return false;
		}

		this.logAdvanced(LOGLEVEL.SUCCESS, "helper", `Unsubscribed from eventsub ${subscription_id} successfully`);

		return true;
		
	}

	static webhook(data: any) {
		throw new Error("Method not implemented.");
	}

}