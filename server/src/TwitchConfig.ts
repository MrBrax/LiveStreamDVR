import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { TwitchChannel } from './TwitchChannel';
import { LOGLEVEL, TwitchHelper } from './TwitchHelper';

export interface SettingField {
	key: string;
	group: string;
	text: string;
	type: string;
	default?: any;
	choices?: any[];
	help?: string;
	required?: boolean;
	stripslash?: boolean;
	secret?: boolean;
}

export type VideoQuality = "best" | "1080p60" | "1080p" | "720p60" | "720p" | "480p" | "360p" | "160p" | "140p" | "worst";

export interface ChannelConfig {
	login: string;
	quality: VideoQuality[];
	match: string[];
	download_chat: boolean;
	burn_chat: boolean;
	no_capture: boolean;
}

export class TwitchConfig {
    
    static config: Record<string, any>;
	static channels_config: ChannelConfig[] = [];

	static channels: TwitchChannel[] = [];

    static configPath 			= path.join(__dirname, '..', '..', 'config', 'config.json');
	static channelPath 			= path.join(__dirname, '..', '..', 'config', 'channels.json');
	static gameDbPath 			= path.join(__dirname, "..", '..', "cache" , "games_v2.json");
	static historyPath 			= path.join(__dirname, "..", '..', "cache" , "history.json");
	static streamerCachePath 	= path.join(__dirname, "..", '..', "cache" , "streamers_v2.json");

	static streamerCacheTime 	= 2592000; // 30 days

    static settingsFields: SettingField[] = [
		{'key': 'bin_dir', 				'group': 'Binaries',	'text': 'Python binary directory', 						'type': 'string',		'required': true, 'help': 'No trailing slash', 'stripslash': true},
		{'key': 'ffmpeg_path', 			'group': 'Binaries',	'text': 'FFmpeg path', 									'type': 'string',		'required': true},
		{'key': 'mediainfo_path', 		'group': 'Binaries',	'text': 'Mediainfo path', 								'type': 'string',		'required': true},
		{'key': 'twitchdownloader_path',	'group': 'Binaries',	'text': 'TwitchDownloaderCLI path', 						'type': 'string'},

		{'key': 'basepath', 				'group': 'Advanced',	'text': 'Base path', 										'type': 'string',		'help': 'No trailing slash. For reverse proxy etc', 'stripslash': true},
		{'key': 'instance_id', 			'group': 'Basic',		'text': 'Instance ID', 									'type': 'string'},

		{
			'key': 'app_url',
			'group': 'Basic',
			'text': 'App URL',
			'type': 'string',
			'required': true,
			'help': 'Must use HTTPS on port 443 (aka no port visible). No trailing slash. E.g. https://twitchautomator.example.com',
			// 'pattern': '^https:\/\/',
			'stripslash': true
		},

		{'key': 'webhook_url', 			    'group': 'Basic',		'text': 'Webhook URL', 									    'type': 'string',		'help': 'For external scripting'},
		{'key': 'password', 				'group': 'Interface',	'text': 'Password', 										'type': 'string',		'help': 'Keep blank for none. Username is admin'},
		{'key': 'password_secure', 		    'group': 'Interface',	'text': 'Force HTTPS for password', 						'type': 'boolean',	'default': true},
		{'key': 'websocket_enabled', 		'group': 'Interface',	'text': 'Websockets enabled', 							    'type': 'boolean'},
		{'key': 'websocket_server_address', 'group': 'Interface',	'text': 'Websocket server address override', 				'type': 'string'},
		{'key': 'websocket_client_address', 'group': 'Interface',	'text': 'Websocket client address override', 				'type': 'string'},
		{'key': 'storage_per_streamer', 	'group': 'Basic',		'text': 'Gigabytes of storage per streamer', 				'type': 'number',		'default': 100},
		{'key': 'hls_timeout', 			    'group': 'Advanced',	'text': 'HLS Timeout in seconds (ads)', 					'type': 'number',		'default': 200},
		{'key': 'vods_to_keep', 			'group': 'Basic',		'text': 'VODs to keep per streamer', 						'type': 'number',		'default': 5},
		{'key': 'keep_deleted_vods', 		'group': 'Basic',		'text': 'Keep Twitch deleted VODs', 						'type': 'boolean',	'default': false},
		{'key': 'keep_favourite_vods', 	    'group': 'Basic',		'text': 'Keep favourite VODs', 							    'type': 'boolean',	'default': false},
		{'key': 'keep_muted_vods', 		    'group': 'Basic',		'text': 'Keep muted VODs', 								    'type': 'boolean',	'default': false},
		{'key': 'download_retries', 		'group': 'Advanced',	'text': 'Download/capture retries', 						'type': 'number',		'default': 5},
		{'key': 'sub_lease', 				'group': 'Advanced',	'text': 'Subscription lease', 							    'type': 'number',		'default': 604800},
		{'key': 'api_client_id', 			'group': 'Basic',		'text': 'Twitch client ID', 								'type': 'string',		'required': true},
		{'key': 'api_secret', 			    'group': 'Basic',		'text': 'Twitch secret', 									'type': 'string',		'secret': true, 'required': true, 'help': 'Keep blank to not change'},

		// { 'key': 'hook_callback', 		'text': 'Hook callback', 									'type': 'string', 'required': true },
		// {'key': 'timezone', 				'group': 'Interface',	'text': 'Timezone', 										'type': 'array',		'default': 'UTC', 'help': 'This only affects the GUI, not the values stored', 'deprecated': true},

		{'key': 'vod_container', 			'group': 'Video',		'text': 'VOD container (not tested)', 					    'type': 'array',		'choices': ['mp4', 'mkv', 'mov'], 'default': 'mp4'},

		// {'key': 'burn_preset', 			'group': 'Video',		'text': 'Burning h264 preset', 							    'type': 'array',		'choices': {'ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow', 'placebo'}, 'default': 'slow'},
		// {'key': 'burn_crf', 				'group': 'Video',		'text': 'Burning h264 crf', 								'type': 'number',		'default': 26, 'help': 'Essentially a quality control. Lower is higher quality.'},

		{'key': 'disable_ads', 			    'group': 'Basic',		'text': 'Try to remove ads from captured file',			        'type': 'boolean',	'default': true, 'help': 'This removes the "Commercial break in progress", but stream is probably going to be cut off anyway'},
		{'key': 'debug', 					'group': 'Developer',	'text': 'Debug', 											    'type': 'boolean',	'default': false, 'help': 'Verbose logging, extra file outputs, more information available. Not for general use.'},
		{'key': 'app_verbose', 			    'group': 'Developer',	'text': 'Verbose app output', 							        'type': 'boolean',	'help': 'Only verbose output'},
		{'key': 'channel_folders', 		    'group': 'Basic',		'text': 'Channel folders', 								        'type': 'boolean',	'default': true, 'help': 'Store VODs in subfolders instead of root'},
		{'key': 'chat_compress', 			'group': 'Advanced',	'text': 'Compress chat with gzip (untested)', 			        'type': 'boolean'},
		{'key': 'relative_time', 			'group': 'Interface',	'text': 'Relative time', 									    'type': 'boolean',	'help': '"1 hour ago" instead of 2020-01-01'},
		{'key': 'low_latency', 			    'group': 'Advanced',	'text': 'Low latency (untested)', 						        'type': 'boolean'},
		// {'key': 'youtube_dlc', 			'group': 'Advanced',	'text': 'Use youtube-dlc instead of the regular one', 	        'type': 'boolean'},
		// {'key': 'youtube_dl_alternative', 'group': 'Advanced',	'text': 'The alternative to youtube-dl to use', 			    'type': 'string'},
		{'key': 'pipenv_enabled', 		    'group': 'Advanced',	'text': 'Use pipenv', 									        'type': 'boolean',	'default': false},
		{'key': 'chat_dump', 				'group': 'Basic',		'text': 'Dump chat during capture', 						    'type': 'boolean',	'default': false, 'help': "Dump chat from IRC with an external python script. This isn't all that stable."},
		{'key': 'ts_sync', 				    'group': 'Video',		'text': 'Try to force sync remuxing (not recommended)', 		'type': 'boolean',	'default': false},
		{'key': 'encode_audio', 			'group': 'Video',		'text': 'Encode audio stream', 									'type': 'boolean',	'default': false, 'help': 'This may help with audio syncing.'},
		{'key': 'fix_corruption', 		    'group': 'Video',		'text': 'Try to fix corruption in remuxing (not recommended)',	'type': 'boolean',	'default': false, 'help': 'This may help with audio syncing.'},
		{'key': 'playlist_dump', 			'group': 'Advanced',	'text': 'Use playlist dumping (experimental)',			        'type': 'boolean',	'default': false},
		{'key': 'process_wait_method', 	    'group': 'Advanced',	'text': 'Process wait method',							        'type': 'number',	'default': 1},

		{'key': 'eventsub_secret', 		    'group': 'Advanced',	'text': 'EventSub secret', 								    'type': 'string',		'required': true},

		{'key': 'ca_path', 				    'group': 'Advanced',	'text': 'Path to certificate PEM file', 					'type': 'string'},

		{'key': 'api_metadata', 			'group': 'Basic',		'text': 'Get extra metadata when updating chapter.', 		'type': 'boolean', 'help': 'Makes extra API requests.'},

		{'key': 'error_handler', 			'group': 'Advanced',	'text': 'Use app logging to catch PHP errors', 			'type': 'boolean'},

		{'key': 'file_permissions',		    'group': 'Advanced',    'text': 'Set file permissions', 	'type': 'boolean', 'help': 'Warning, can mess up permissions real bad.'},
		{'key': 'file_chmod',				'group': 'Advanced',    'text': 'File chmod', 				'type': 'number', 'default': 775},
		{'key': 'file_chown_user',		    'group': 'Advanced',    'text': 'File chown user', 		    'type': 'string', 'default': 'nobody'},
		{'key': 'file_chown_group',		    'group': 'Advanced',    'text': 'File chown group', 		'type': 'string', 'default': 'nobody'},

		{'key': 'checkmute_method',	        'group': 'Basic',	    'text': 'Method to use when checking for muted vods',	'type': 'array', 'default': 'api', 'choices': ['api', 'streamlink'],	'help': 'Streamlink is more accurate but is kind of a weird solution.'},
	];

    constructor() {
        // this.config = {};
        // this.loadConfig();
    }

	static cfg<T>(key: string, defaultValue?: T): T {

		// return from env if set
		if (process.env[key]) {
			return process.env[key] as unknown as T;
		}

		// return default value if not set
		if(this.config[key] === undefined) {
			if (defaultValue !== undefined) {
				return defaultValue;
			} else {
				return undefined as unknown as T;
			}
		}

		return this.config[key];
	}

    static loadConfig() {

        console.log('Loading config');

        if (!fs.existsSync(this.configPath)) {
            console.log('Config file not found, creating new one');
            // throw new Error("Config file does not exist: " + this.configFile);
            this.generateConfig();
        }

        const data = fs.readFileSync(this.configPath, 'utf8');

        this.config = JSON.parse(data);        

    }

    static generateConfig() {

        console.log('Generating config');

        let example: Record<string, any> = {};
		for (let field of this.settingsFields) {
			example[field['key']] = field['default'] ? field['default'] : null;
		}
		example['favourites'] = [];
		example['streamers'] = [];

		this.config = example;
		this.saveConfig();

    }

	static settingExists(key: string): boolean {
		return this.getSettingField(key) !== undefined;
	}

	static getSettingField(key: string): any {
		return this.settingsFields.find(field => field['key'] === key);
	}

	static setConfig(key: string, value: any) {
		
		if (!this.settingExists(key)) {
			throw new Error("Setting does not exist: " + key);
		}

		const setting = this.getSettingField(key);

		// remove ending slash
		if (setting.stripslash) {
			value = value.replace(/\/$/, '');
		}

		// check type
		if (setting.type === 'number') {
			value = parseInt(value);
		} else if (setting.type === 'boolean') {
			value = value === true;
		}

		this.config[key] = value;
		// TwitchConfig.saveConfig();
	}

	static saveConfig(source = 'unknown') {

		// back up config
		fs.copyFileSync(this.configPath, this.configPath + '.bak');
		
		// save
		fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 4));

		console.log(`Saved config from ${source}`);
    }

	static loadChannelsConfig()
	{
		if (!fs.existsSync(this.channelPath)) {
			return false;
		}

		const data = fs.readFileSync(this.channelPath, 'utf8');
		this.channels_config = JSON.parse(data);
	}

	static async loadChannels()
	{
		if (this.channels_config.length > 0) {
			for(let channel of this.channels_config) {
				
				let ch: TwitchChannel;
				
				try {
					ch = await TwitchChannel.loadFromLogin(channel.login, true);
				} catch (th) {
					TwitchHelper.logAdvanced(LOGLEVEL.FATAL, "config", `Channel ${channel.login} could not be loaded due to an exception, please check logs.`);
					continue;
				}
				
				if (ch) {
					this.channels.push(ch);
				} else {
					TwitchHelper.logAdvanced(LOGLEVEL.FATAL, "config", `Channel ${channel.login} could not be loaded, please check logs.`);
				}
			}
		}
	}

	// todo: redis or something
	static getCache(key: string)
	{
		/*
		$key = str_replace("/", "", $key);
		if (!file_exists(TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . "kv" . DIRECTORY_SEPARATOR . $key)) return false;
		return file_get_contents(TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . "kv" . DIRECTORY_SEPARATOR . $key);
		*/

		key = key.replace(/\//g, '');

		const keyPath = path.join(TwitchHelper.cache_folder, 'kv', key);

		if (!fs.existsSync(keyPath)) {
			return false;
		}

		return fs.readFileSync(keyPath, 'utf8');

	}

	static setCache(key: string, value: string)
	{
		/*
		$key = str_replace("/", "", $key);
		if ($value === null) {
			if (file_exists(TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . "kv" . DIRECTORY_SEPARATOR . $key)) {
				unlink(TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . "kv" . DIRECTORY_SEPARATOR . $key);
			}
			return;
		}
		file_put_contents(TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . "kv" . DIRECTORY_SEPARATOR . $key, $value);
		*/

		key = key.replace(/\//g, '');

		const keyPath = path.join(TwitchHelper.cache_folder, 'kv', key);

		if (value === null) {
			if (fs.existsSync(keyPath)) {
				fs.unlinkSync(keyPath);
			}
			return;
		}

		fs.writeFileSync(keyPath, value);
	}

	static async setupAxios() {
		axios.defaults.headers.common['Client-ID'] = TwitchConfig.cfg('api_client_id');
		axios.defaults.headers.common['Authorization'] = "Bearer " + await TwitchHelper.getAccessToken();
		axios.defaults.baseURL = "https://api.twitch.tv";
	}

}

TwitchConfig.loadConfig();
TwitchConfig.loadChannelsConfig();
TwitchConfig.setupAxios();