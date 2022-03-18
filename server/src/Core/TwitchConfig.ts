import axios from "axios";
import chalk from "chalk";
import fs from "fs";
import { SettingField } from "../../../common/Config";
import { AppName, BaseConfigFolder, BaseConfigPath } from "./BaseConfig";
import { KeyValue } from "./KeyValue";
import { TwitchAutomatorJob } from "./TwitchAutomatorJob";
import { TwitchChannel } from "./TwitchChannel";
import { TwitchGame } from "./TwitchGame";
import { TwitchHelper } from "./TwitchHelper";
import { LOGLEVEL, TwitchLog } from "./TwitchLog";
import { TwitchWebhook } from "./TwitchWebhook";

export class TwitchConfig {

    static config: Record<string, string | number | boolean | string[]>;
    private static _writeConfig = false;

    static readonly streamerCacheTime = 2592000 * 1000; // 30 days

    static readonly settingsFields: Array<SettingField<string> | SettingField<number> | SettingField<boolean>> = [
        { "key": "bin_dir", "group": "Binaries", "text": "Python binary directory", "type": "string", "required": true, "help": "No trailing slash", "stripslash": true },
        { "key": "ffmpeg_path", "group": "Binaries", "text": "FFmpeg path", "type": "string", "required": true },
        { "key": "mediainfo_path", "group": "Binaries", "text": "Mediainfo path", "type": "string", "required": true },
        { "key": "twitchdownloader_path", "group": "Binaries", "text": "TwitchDownloaderCLI path", "type": "string" },

        { "key": "basepath", "group": "Advanced", "text": "Base path", "type": "string", "help": "No trailing slash. For reverse proxy etc", "stripslash": true },
        { "key": "instance_id", "group": "Basic", "text": "Instance ID", "type": "string" },

        {
            "key": "app_url",
            "group": "Basic",
            "text": "App URL",
            "type": "string",
            "required": true,
            "help": "Must use HTTPS on port 443 (aka no port visible). No trailing slash. E.g. https://twitchautomator.example.com",
            // 'pattern': '^https:\/\/',
            "stripslash": true,
        },

        { "key": "webhook_url", "group": "Basic", "text": "Webhook URL", "type": "string", "help": "For external scripting" },
        { "key": "password", "group": "Interface", "text": "Password", "type": "string", "help": "Keep blank for none. Username is admin" },
        { "key": "password_secure", "group": "Interface", "text": "Force HTTPS for password", "type": "boolean", "default": true },
        { "key": "websocket_enabled", "group": "Interface", "text": "Websockets enabled", "type": "boolean" },
        { "key": "websocket_server_address", "group": "Interface", "text": "Websocket server address override", "type": "string" },
        { "key": "websocket_client_address", "group": "Interface", "text": "Websocket client address override", "type": "string" },
        { "key": "storage_per_streamer", "group": "Basic", "text": "Gigabytes of storage per streamer", "type": "number", "default": 100 },
        { "key": "hls_timeout", "group": "Advanced", "text": "HLS Timeout in seconds (ads)", "type": "number", "default": 200 },
        { "key": "vods_to_keep", "group": "Basic", "text": "VODs to keep per streamer", "type": "number", "default": 5 },
        { "key": "keep_deleted_vods", "group": "Basic", "text": "Keep Twitch deleted VODs", "type": "boolean", "default": false },
        { "key": "keep_favourite_vods", "group": "Basic", "text": "Keep favourite VODs", "type": "boolean", "default": false },
        { "key": "keep_muted_vods", "group": "Basic", "text": "Keep muted VODs", "type": "boolean", "default": false },
        { "key": "download_retries", "group": "Advanced", "text": "Download/capture retries", "type": "number", "default": 5 },
        { "key": "sub_lease", "group": "Advanced", "text": "Subscription lease", "type": "number", "default": 604800 },
        { "key": "api_client_id", "group": "Basic", "text": "Twitch client ID", "type": "string", "required": true },
        { "key": "api_secret", "group": "Basic", "text": "Twitch secret", "type": "string", "secret": true, "required": true, "help": "Keep blank to not change" },

        // { 'key': 'hook_callback', 		'text': 'Hook callback', 									'type': 'string', 'required': true },
        // {'key': 'timezone', 				'group': 'Interface',	'text': 'Timezone', 										'type': 'array',		'default': 'UTC', 'help': 'This only affects the GUI, not the values stored', 'deprecated': true},

        { "key": "vod_container", "group": "Video", "text": "VOD container (not tested)", "type": "array", "choices": ["mp4", "mkv", "mov"], "default": "mp4" },

        // {'key': 'burn_preset', 			'group': 'Video',		'text': 'Burning h264 preset', 							    'type': 'array',		'choices': {'ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow', 'placebo'}, 'default': 'slow'},
        // {'key': 'burn_crf', 				'group': 'Video',		'text': 'Burning h264 crf', 								'type': 'number',		'default': 26, 'help': 'Essentially a quality control. Lower is higher quality.'},

        { "key": "disable_ads", "group": "Basic", "text": "Try to remove ads from captured file", "type": "boolean", "default": true, "help": "This removes the \"Commercial break in progress\", but stream is probably going to be cut off anyway" },
        { "key": "debug", "group": "Developer", "text": "Debug", "type": "boolean", "default": false, "help": "Verbose logging, extra file outputs, more information available. Not for general use." },
        { "key": "app_verbose", "group": "Developer", "text": "Verbose app output", "type": "boolean", "help": "Only verbose output" },
        { "key": "channel_folders", "group": "Basic", "text": "Channel folders", "type": "boolean", "default": true, "help": "Store VODs in subfolders instead of root" },
        { "key": "chat_compress", "group": "Advanced", "text": "Compress chat with gzip (untested)", "type": "boolean" },
        { "key": "relative_time", "group": "Interface", "text": "Relative time", "type": "boolean", "help": "\"1 hour ago\" instead of 2020-01-01" },
        { "key": "low_latency", "group": "Advanced", "text": "Low latency (untested)", "type": "boolean" },
        // {'key': 'youtube_dlc', 			'group': 'Advanced',	'text': 'Use youtube-dlc instead of the regular one', 	        'type': 'boolean'},
        // {'key': 'youtube_dl_alternative', 'group': 'Advanced',	'text': 'The alternative to youtube-dl to use', 			    'type': 'string'},
        { "key": "pipenv_enabled", "group": "Advanced", "text": "Use pipenv", "type": "boolean", "default": false },
        { "key": "chat_dump", "group": "Basic", "text": "Dump chat during capture", "type": "boolean", "default": false, "help": "Dump chat from IRC with an external python script. This isn't all that stable." },
        { "key": "ts_sync", "group": "Video", "text": "Try to force sync remuxing (not recommended)", "type": "boolean", "default": false },
        { "key": "encode_audio", "group": "Video", "text": "Encode audio stream", "type": "boolean", "default": false, "help": "This may help with audio syncing." },
        { "key": "fix_corruption", "group": "Video", "text": "Try to fix corruption in remuxing (not recommended)", "type": "boolean", "default": false, "help": "This may help with audio syncing." },
        { "key": "playlist_dump", "group": "Advanced", "text": "Use playlist dumping (experimental)", "type": "boolean", "default": false },
        { "key": "process_wait_method", "group": "Advanced", "text": "Process wait method", "type": "number", "default": 1 },

        { "key": "eventsub_secret", "group": "Advanced", "text": "EventSub secret", "type": "string", "required": true },

        { "key": "ca_path", "group": "Advanced", "text": "Path to certificate PEM file", "type": "string" },

        { "key": "api_metadata", "group": "Basic", "text": "Get extra metadata when updating chapter.", "type": "boolean", "help": "Makes extra API requests." },

        { "key": "error_handler", "group": "Advanced", "text": "Use app logging to catch PHP errors", "type": "boolean" },

        { "key": "file_permissions", "group": "Advanced", "text": "Set file permissions", "type": "boolean", "help": "Warning, can mess up permissions real bad." },
        { "key": "file_chmod", "group": "Advanced", "text": "File chmod", "type": "number", "default": 775 },
        { "key": "file_chown_user", "group": "Advanced", "text": "File chown user", "type": "string", "default": "nobody" },
        { "key": "file_chown_group", "group": "Advanced", "text": "File chown group", "type": "string", "default": "nobody" },

        { "key": "checkmute_method", "group": "Basic", "text": "Method to use when checking for muted vods", "type": "array", "default": "api", "choices": ["api", "streamlink"], "help": "Streamlink is more accurate but is kind of a weird solution." },

        { "key": "server_port", "group": "Basic", "text": "Server port", "type": "number", "default": 8080 },

    ];

    static cfg<T>(key: string, defaultValue?: T): T {

        if (!this.config) {
            console.error("Config not loaded", key, defaultValue);
            throw new Error("Config not loaded");
        }

        if (!this.settingExists(key)) {
            TwitchLog.logAdvanced(LOGLEVEL.WARNING, "config", `Setting '${key}' does not exist.`);
            console.warn(chalk.red(`Setting '${key}' does not exist.`));
        }

        // return from env if set
        if (process.env[key]) {
            return <T><unknown>process.env[key];
        }

        // return default value if not set
        if (this.config[key] === undefined) {
            if (defaultValue !== undefined) {
                return defaultValue;
            } else {
                return <T><unknown>undefined;
            }
        }

        return <T><unknown>this.config[key];
    }

    static loadConfig() {

        console.log(chalk.blue("Loading config..."));

        if (!fs.existsSync(BaseConfigPath.config)) {
            console.error("Config file not found, creating new one");
            // throw new Error("Config file does not exist: " + this.configFile);
            this.generateConfig();
        }

        const data = fs.readFileSync(BaseConfigPath.config, "utf8");

        this.config = JSON.parse(data);

        this.config.app_name = AppName;

        for (const key in this.config) {
            if (key !== "app_name" && !this.settingExists(key)) {
                console.warn(chalk.yellow(`Saved setting '${key}' does not exist, deprecated? Discarding.`));
                delete this.config[key];
            }
        }

        console.log(chalk.green(`✔ ${Object.keys(this.config).length} settings loaded.`));

    }

    static generateConfig() {

        console.log("Generating config");

        const example: Record<string, string | boolean | number | string[]> = {};
        for (const field of this.settingsFields) {
            if (field["default"]) example[field["key"]] = field["default"];
        }
        // example["favourites"] = [];
        // example["streamers"] = [];

        this.config = example;
        this.saveConfig();

    }

    static settingExists(key: string): boolean {
        return this.getSettingField(key) !== undefined;
    }

    static getSettingField(key: string): SettingField<string> | SettingField<number> | SettingField<boolean> | undefined {
        return this.settingsFields.find(field => field["key"] === key);
    }

    static setConfig(key: string, value: any): void {

        const setting = this.getSettingField(key);

        if (!setting) {
            throw new Error("Setting does not exist: " + key);
        } else {

            // remove ending slash
            if (setting.stripslash && typeof value === "string") {
                value = value.replace(/\/$/, "");
            }

            // check type
            if (setting.type === "number") {
                value = parseInt(value);
            } else if (setting.type === "boolean") {
                value = value === true;
            }

            this.config[key] = value;
            // TwitchConfig.saveConfig();

        }
    }

    static saveConfig(source = "unknown"): boolean {

        this._writeConfig = true;

        // back up config
        this.backupConfig();

        // save
        fs.writeFileSync(BaseConfigPath.config, JSON.stringify(this.config, null, 4));

        console.log(`Saved config from ${source}`);

        this._writeConfig = false;

        return fs.existsSync(BaseConfigPath.config) && fs.statSync(BaseConfigPath.config).size > 0;

    }

    static backupConfig() {
        if (fs.existsSync(BaseConfigPath.config)) {
            fs.copyFileSync(BaseConfigPath.config, `${BaseConfigPath.config}.${Date.now()}.bak`);
        }
    }

    static async setupAxios() {

        const token = await TwitchHelper.getAccessToken();
        if (!token) {
            TwitchLog.logAdvanced(LOGLEVEL.FATAL, "config", "Could not get access token!");
            throw new Error("Could not get access token!");
        }

        TwitchHelper.axios = axios.create({
            baseURL: "https://api.twitch.tv",
            headers: {
                "Client-ID": TwitchConfig.cfg("api_client_id"),
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token,
            },
        });
    }

    static createFolders() {

        for (const folder of Object.values(BaseConfigFolder)) {
            if (!fs.existsSync(folder)) {
                fs.mkdirSync(folder);
                console.log(chalk.green(`Created folder: ${folder}`));
            }
        }

    }

    /**
     * Initialise entire application, like loading config, creating folders, etc.
     */
    static async init() {

        // Main load
        console.log(chalk.green("Initialising..."));
        console.log(chalk.magenta(`Environment: ${process.env.NODE_ENV}`));

        if (TwitchConfig.config && Object.keys(TwitchConfig.config).length > 0) {
            // throw new Error("Config already loaded, has init been called twice?");
            console.error(chalk.red("Config already loaded, has init been called twice?"));
            return false;
        }

        TwitchConfig.createFolders();

        KeyValue.load();

        TwitchConfig.loadConfig();

        await TwitchConfig.setupAxios();

        TwitchLog.readTodaysLog();

        TwitchLog.logAdvanced(
            LOGLEVEL.SUCCESS,
            "config",
            `The time is ${new Date().toISOString()}.` +
            " Current topside temperature is 93 degrees, with an estimated high of one hundred and five." +
            " The Black Mesa compound is maintained at a pleasant 68 degrees at all times."
        );

        TwitchGame.populateGameDatabase();
        TwitchGame.populateFavouriteGames();
        TwitchChannel.loadChannelsConfig();
        TwitchChannel.loadChannelsCache();
        await TwitchChannel.loadChannels();
        TwitchAutomatorJob.loadJobsFromCache();

        // monitor config for external changes
        fs.watch(BaseConfigFolder.config, (eventType, filename) => {
            console.log(`Config file changed: ${eventType} ${filename}`);
            TwitchLog.logAdvanced(LOGLEVEL.WARNING, "config", "Config file changed externally");
            // TwitchConfig.loadConfig();
        });

        TwitchWebhook.dispatch("init", {
            "hello": "world",
        });

        TwitchLog.logAdvanced(LOGLEVEL.SUCCESS, "config", "Loading config stuff done.");

    }

}