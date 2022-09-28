import axios, { AxiosResponse } from "axios";
import chalk from "chalk";
import crypto from "crypto";
import fs from "fs";
import minimist from "minimist";
import path from "path";
import express from "express";
import { SettingField } from "../../../common/Config";
import { ClipBasenameFields, VodBasenameFields } from "../../../common/ReplacementsConsts";
import { AppRoot, BaseConfigDataFolder, BaseConfigFolder, BaseConfigPath, DataRoot, HomeRoot } from "./BaseConfig";
import { ClientBroker } from "./ClientBroker";
import { TwitchHelper } from "../Providers/Twitch";
import { KeyValue } from "./KeyValue";
import { Log, LOGLEVEL } from "./Log";
import { Scheduler } from "./Scheduler";
import { Job } from "./Job";
import { TwitchChannel } from "./Providers/Twitch/TwitchChannel";
import { TwitchGame } from "./Providers/Twitch/TwitchGame";
import { YouTubeHelper } from "../Providers/YouTube";
import { LiveStreamDVR } from "./LiveStreamDVR";
import { YouTubeChannel } from "./Providers/YouTube/YouTubeChannel";
import { Helper } from "./Helper";

const argv = minimist(process.argv.slice(2));

export class Config {

    initialised = false;
    config: Record<string, string | number | boolean | string[]> | undefined;
    private _writeConfig = false;
    watcher: fs.FSWatcher | undefined;

    forceDebug = false;

    gitHash?: string;

    sessionParser?: express.RequestHandler;


    static readonly streamerCacheTime = 2592000 * 1000; // 30 days
    static readonly settingsFields: Array<SettingField<string> | SettingField<number> | SettingField<boolean>> = [
        { "key": "bin_dir", "group": "Binaries", "text": "Python binary directory", "type": "string", "required": true, "help": "No trailing slash", "stripslash": true },
        { "key": "ffmpeg_path", "group": "Binaries", "text": "FFmpeg path", "type": "string", "required": true },
        { "key": "mediainfo_path", "group": "Binaries", "text": "Mediainfo path", "type": "string", "required": true },
        { "key": "twitchdownloader_path", "group": "Binaries", "text": "TwitchDownloaderCLI path", "type": "string" },
        { "key": "node_path", "group": "Binaries", "text": "NodeJS path", "type": "string" },

        { "key": "server_port", "group": "Basic", "text": "Server port", "type": "number", "default": 8080 },
        { "key": "basepath", "group": "Basic", "text": "Base path", "type": "string", "help": "No trailing slash. For reverse proxy etc", "stripslash": true },
        { "key": "instance_id", "group": "Basic", "text": "Instance ID", "type": "string", "help": "Unique ID for this instance. Used for hook callbacks." },
        { "key": "trust_proxy", "group": "Basic", "text": "Trust proxy", "type": "boolean", "default": false, "help": "If server is behind a reverse proxy, enable this.", restart_required: true },

        {
            "key": "app_url",
            "group": "Basic",
            "text": "App URL",
            "type": "string",
            "required": true,
            "help": "Must use HTTPS on port 443 (aka no port visible). No trailing slash. E.g. https://livestreamdvr.example.com . Enter 'debug' to not use, no recordings can be made.",
            // 'pattern': '^https:\/\/',
            "stripslash": true,
            "guest": true,
        },

        {
            "key": "isolated_mode",
            "group": "Basic",
            "text": "Isolated mode",
            "type": "boolean",
            "help": "Enable this if your server is not exposed to the internet, aka no EventSub support.",
        },

        { "key": "motd", "group": "Interface", "text": "MOTD", "type": "text", "help": "Shown at the top of the dashboard", guest: true },
        { "key": "password", "group": "Interface", "text": "Password", "type": "string", "help": "Keep blank for none. Username is admin" },
        { "key": "guest_mode", "group": "Interface", "text": "Guest mode", "type": "boolean", "default": false, "help": "Allow guests to access the interface.", guest: true },
        // { "key": "password_secure", "group": "Interface", "text": "Force HTTPS for password", "type": "boolean", "default": true },

        { "key": "webhook_url", "group": "Notifications", "text": "Webhook URL", "type": "string", "help": "For external scripting" },
        { "key": "websocket_enabled", "group": "Notifications", "text": "Websockets enabled", "type": "boolean", "default": true, "help": "Requires a restart.", "guest": true },
        // { "key": "websocket_server_address", "group": "Notifications", "text": "Websocket server address override", "type": "string" },
        { "key": "websocket_client_address", "group": "Notifications", "text": "Websocket client address override", "type": "string", "guest": true },
        { "key": "websocket_log", "group": "Notifications", "text": "Send logs over websocket", "type": "boolean" },

        { "key": "channel_folders", "group": "Storage", "text": "Channel folders", "type": "boolean", "default": true, "help": "Store VODs in subfolders instead of root", guest: true, deprecated: true },
        { "key": "vod_folders", "group": "Storage", "text": "VOD folders", "type": "boolean", "default": true, "help": "Store VODs in subfolders instead of root", guest: true },
        { "key": "storage_per_streamer", "group": "Storage", "text": "Gigabytes of storage per streamer", "type": "number", "default": 100 },
        { "key": "vods_to_keep", "group": "Storage", "text": "VODs to keep per streamer", "type": "number", "default": 5, "help": "This is in addition to kept VODs from muted/favourite etc." },
        { "key": "keep_deleted_vods", "group": "Storage", "text": "Keep Twitch deleted VODs", "type": "boolean", "default": false },
        { "key": "keep_favourite_vods", "group": "Storage", "text": "Keep favourite VODs", "type": "boolean", "default": false },
        { "key": "keep_muted_vods", "group": "Storage", "text": "Keep muted VODs", "type": "boolean", "default": false },
        { "key": "keep_commented_vods", "group": "Storage", "text": "Keep commented VODs", "type": "boolean", "default": false },
        { "key": "delete_only_one_vod", "group": "Storage", "text": "Delete only one VOD when cleaning up like old times", "type": "boolean", "default": false },

        { "key": "hls_timeout", "group": "Capture", "text": "HLS Timeout in seconds (ads)", "type": "number", "default": 200 },
        { "key": "download_retries", "group": "Capture", "text": "Download/capture retries", "type": "number", "default": 5 },
        { "key": "low_latency", "group": "Capture", "text": "Low latency (untested)", "type": "boolean" },
        { "key": "disable_ads", "group": "Capture", "text": "Try to remove ads from captured file", "type": "boolean", "default": true, "help": "This removes the \"Commercial break in progress\", but stream is probably going to be cut off anyway" },

        { "key": "capture.use_cache", "group": "Capture", "text": "Use cache", "type": "boolean", "default": false, "help": "Use cache directory for in-progress captures" },

        // { "key": "sub_lease", "group": "Advanced", "text": "Subscription lease", "type": "number", "default": 604800 },
        { "key": "api_client_id", "group": "Basic", "text": "Twitch client ID", "type": "string", "required": true },
        { "key": "api_secret", "group": "Basic", "text": "Twitch secret", "type": "string", "secret": true, "required": true, "help": "Keep blank to not change" },

        { "key": "youtube.client_id",       "group": "YouTube", "text": "YouTube client ID", "type": "string" },
        { "key": "youtube.client_secret",   "group": "YouTube", "text": "YouTube secret", "type": "string", "secret": true },

        // { 'key': 'hook_callback', 		'text': 'Hook callback', 									'type': 'string', 'required': true },
        // {'key': 'timezone', 				'group': 'Interface',	'text': 'Timezone', 										'type': 'array',		'default': 'UTC', 'help': 'This only affects the GUI, not the values stored', 'deprecated': true},

        { "key": "vod_container", "group": "Video", "text": "VOD container (not tested)", "type": "array", "choices": ["mp4", "mkv", "mov"], "default": "mp4" },

        // {'key': 'burn_preset', 			'group': 'Video',		'text': 'Burning h264 preset', 							    'type': 'array',		'choices': {'ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow', 'placebo'}, 'default': 'slow'},
        // {'key': 'burn_crf', 				'group': 'Video',		'text': 'Burning h264 crf', 								'type': 'number',		'default': 26, 'help': 'Essentially a quality control. Lower is higher quality.'},

        { "key": "debug", "group": "Developer", "text": "Debug", "type": "boolean", "default": false, "help": "Verbose logging, extra file outputs, more information available. Not for general use.", "guest": true },
        { "key": "app_verbose", "group": "Developer", "text": "Verbose app output", "type": "boolean", "help": "Only verbose output" },
        { "key": "dump_payloads", "group": "Developer", "text": "Dump payloads", "type": "boolean", "default": false },
        { "key": "debug.catch_global_exceptions", "group": "Developer", "text": "Catch global exceptions", "type": "boolean", "default": false },

        { "key": "chat_compress", "group": "Advanced", "text": "Compress chat with gzip (untested)", "type": "boolean" },
        // { "key": "relative_time", "group": "Interface", "text": "Relative time", "type": "boolean", "help": "\"1 hour ago\" instead of 2020-01-01" },

        // {'key': 'youtube_dlc', 			'group': 'Advanced',	'text': 'Use youtube-dlc instead of the regular one', 	        'type': 'boolean'},
        // {'key': 'youtube_dl_alternative', 'group': 'Advanced',	'text': 'The alternative to youtube-dl to use', 			    'type': 'string'},
        { "key": "pipenv_enabled", "group": "Advanced", "text": "Use pipenv", "type": "boolean", "default": false, deprecated: true },
        { "key": "chat_dump", "group": "Basic", "text": "Dump chat during capture for all channels", "type": "boolean", "default": false, "help": "Dump chat from IRC, forgoing saved vod chat.", "deprecated": "Use the setting per channel instead" },
        { "key": "ts_sync", "group": "Video", "text": "Try to force sync remuxing (not recommended)", "type": "boolean", "default": false },
        { "key": "encode_audio", "group": "Video", "text": "Encode audio stream", "type": "boolean", "default": false, "help": "This may help with audio syncing." },
        { "key": "fix_corruption", "group": "Video", "text": "Try to fix corruption in remuxing (not recommended)", "type": "boolean", "default": false, "help": "This may help with audio syncing." },
        { "key": "playlist_dump", "group": "Advanced", "text": "Use playlist dumping (experimental)", "type": "boolean", "default": false },
        // { "key": "process_wait_method", "group": "Advanced", "text": "Process wait method", "type": "number", "default": 1 },

        { "key": "eventsub_secret", "group": "Advanced", "text": "EventSub secret", "type": "string", "required": true },

        // { "key": "ca_path", "group": "Advanced", "text": "Path to certificate PEM file", "type": "string" },

        { "key": "api_metadata", "group": "Basic", "text": "Get extra metadata when updating chapter (viewer count).", "type": "boolean", "help": "Makes extra API requests." },

        // { "key": "error_handler", "group": "Advanced", "text": "Use app logging to catch PHP errors", "type": "boolean" },

        { "key": "file_permissions", "group": "Advanced", "text": "Set file permissions", "type": "boolean", "help": "Warning, can mess up permissions real bad.", "default": false },
        { "key": "file_chmod", "group": "Advanced", "text": "File chmod", "type": "number", "default": 775 },
        { "key": "file_chown_uid", "group": "Advanced", "text": "File chown uid", "type": "number", "default": 100 },
        { "key": "file_chown_gid", "group": "Advanced", "text": "File chown gid", "type": "number", "default": 100 },

        { "key": "checkmute_method", "group": "Basic", "text": "Method to use when checking for muted vods", "type": "array", "default": "streamlink", "choices": ["api", "streamlink"], "help": "Bugged as of 2022-03-29: https://github.com/twitchdev/issues/issues/501" },

        { "key": "telegram_enabled", "group": "Notifications", "text": "Enable Telegram notifications", "type": "boolean", "default": false },
        { "key": "telegram_token", "group": "Notifications", "text": "Telegram token", "type": "string" },
        { "key": "telegram_chat_id", "group": "Notifications", "text": "Telegram chat id", "type": "string" },
        { "key": "discord_enabled", "group": "Notifications", "text": "Enable Discord notifications", "type": "boolean", "default": false },
        { "key": "discord_webhook", "group": "Notifications", "text": "Discord webhook", "type": "string" },

        { "key": "schedule_muted_vods", "group": "Schedules", "text": "Check muted vods", "type": "boolean", "default": true },
        { "key": "schedule_deleted_vods", "group": "Schedules", "text": "Check deleted vods", "type": "boolean", "default": true },
        { "key": "schedule_match_vods", "group": "Schedules", "text": "Match vods", "type": "boolean", "default": false },

        { "key": "create_video_chapters", "group": "Video", "text": "Create video chapters", "type": "boolean", "default": true },
        { "key": "create_kodi_nfo", "group": "Video", "text": "Create kodi nfo", "type": "boolean", "default": false, "help": "Requires server restart or channels reset." },

        {
            "key": "filename_clip",
            "group": "Video",
            "text": "Clip filename",
            "type": "template",
            "default": "{broadcaster} - {title} [{id}] [{quality}]",
            "help": "Clip filename",
            "replacements": ClipBasenameFields,
            "context": "{template}.mp4",
        },

        {
            "key": "filename_vod",
            "group": "Video",
            "text": "Vod filename",
            "type": "template",
            "default": "{login}_{date}_{id}",
            "help": "Vod filename.",
            "replacements": VodBasenameFields,
            "context": "{template}.json, {template}.mp4",
        },

        {
            "key": "filename_vod_folder",
            "group": "Video",
            "text": "Vod folder name",
            "type": "template",
            "default": "{login}_{date}_{id}",
            "help": "Vod folder filename.",
            "replacements": VodBasenameFields,
            "context": "/vods/{login}/{template}/",
        },

        { "key": "min_chapter_duration", "group": "Video", "text": "Minimum chapter duration", "type": "number", "default": 0, "help": "Minimum duration in seconds for a chapter. Shorter chapters will be removed." },

        { "key": "chatdump_notext", "group": "Basic", "text": "Don't write plain text chat file when dumping chat", "type": "boolean", "default": false },

        { "key": "no_vod_convert", "group": "Video", "text": "Don't convert VODs", "type": "boolean", "default": false },

        { "key": "exporter.default.exporter",       "group": "Exporter", "text": "Default exporter", "type": "array", "default": "file", "choices": ["file", "sftp", "ftp", "rclone", "youtube"], "help": "Default exporter for exporter." },
        { "key": "exporter.default.directory",      "group": "Exporter", "text": "Default directory", "type": "string" },
        { "key": "exporter.default.host",           "group": "Exporter", "text": "Default host", "type": "string" },
        { "key": "exporter.default.username",       "group": "Exporter", "text": "Default username", "type": "string" },
        { "key": "exporter.default.password",       "group": "Exporter", "text": "Default password", "type": "string", "help": "This is stored unencrypted." },
        { "key": "exporter.default.description",    "group": "Exporter", "text": "Default description", "type": "string", "help": "YouTube description." },
        { "key": "exporter.default.tags",           "group": "Exporter", "text": "Default tags", "type": "string", "help": "YouTube tags." },
        { "key": "exporter.default.remote",         "group": "Exporter", "text": "Default remote", "type": "string", "help": "For RClone." },
        { "key": "exporter.auto.enabled",           "group": "Exporter", "text": "Enable auto exporter", "type": "boolean", "default": false, "help": "Enable auto exporter. Not implemented yet." },

        { "key": "scheduler.clipdownload.enabled",  "group": "Scheduler (Clip Download)", "text": "Enable clip download scheduler", "type": "boolean", "default": false },
        { "key": "scheduler.clipdownload.channels", "group": "Scheduler (Clip Download)", "text": "Channels to download clips from", "type": "string", "help": "Separate by commas." },
        { "key": "scheduler.clipdownload.amount",   "group": "Scheduler (Clip Download)", "text": "Amount of clips to download", "type": "number", "default": 1 },
        { "key": "scheduler.clipdownload.age",      "group": "Scheduler (Clip Download)", "text": "Age of clips to download", "type": "number", "default": 1 * 24 * 60 * 60, "help": "In seconds." },

        { "key": "reencoder.enabled", "group": "Reencoder", "text": "Enable reencoder", "type": "boolean", "default": false },

        {
            "key": "reencoder.video_codec",
            "group": "Reencoder",
            "text": "Codec",
            "type": "array",
            "default": "libx264",
            "choices": [
                "libx264",
                "h264_nvenc",
                "h264_qsv",
                "h264_videotoolbox",
                "hevc_nvenc",
            ],
            "help": "Video codec to use for reencoding. If you want to use CUDA, select h264_nvenc or hevc_nvenc and enable Hardware Acceleration.",
        },

        {
            "key": "reencoder.preset",
            "group": "Reencoder",
            "text": "Preset",
            "type": "array",
            "default": "medium",
            "choices": [
                "ultrafast",
                "superfast",
                "veryfast",
                "faster",
                "fast",
                "medium",
                "slow",
                "slower",
                "veryslow",
                "placebo",

                // nvenc presets
                "hp",
                "hq",
                "bd",
                "ll",
                "llhq",
                "llhp",
                "lossless",
                "losslesshp",
                "p1",
                "p2",
                "p3",
                "p4",
                "p5",
                "p6",
                "p7",
            ],
        },

        {
            "key": "reencoder.tune",
            "group": "Reencoder",
            "text": "Tune",
            "type": "array",
            "default": "hq",
            "choices": [
                "hq",
                "ll",
                "ull",
                "lossless",
            ],
        },

        { "key": "reencoder.crf", "group": "Reencoder", "text": "CRF", "type": "number", "default": 23, "help": "CRF to use for reencoding. Lower is better." },
        { "key": "reencoder.resolution", "group": "Reencoder", "text": "Resolution", "type": "number", "help": "Scale to this vertical resolution. Leave blank to keep original resolution." },
        { "key": "reencoder.hwaccel", "group": "Reencoder", "text": "Hardware acceleration", "type": "boolean", "help": "Preset is used instead of crf if this is enabled." },
        { "key": "reencoder.delete_source", "group": "Reencoder", "text": "Delete source", "type": "boolean", "help": "Delete source after reencoding." },

        { "key": "localvideos.enabled", "group": "Local Videos", "text": "Enable local videos", "type": "boolean", "default": false },

        /*
            renderChat: false,
            burnChat: false,
            renderTest: false,
            burnTest: false,
            chatWidth: 300,
            chatHeight: 300,
            vodSource: "captured",
            chatSource: "captured",
            chatFont: "Inter",
            chatFontSize: 12,
            burnHorizontal: "left",
            burnVertical: "top",
            ffmpegPreset: "slow",
            ffmpegCrf: 26,
        */
        { key: "chatburn.default.chat_width",       group: "Chat burn", text: "Chat width", type: "number", default: 300 },
        { key: "chatburn.default.auto_chat_height", group: "Chat burn", text: "Chat auto height", type: "boolean", default: true },
        { key: "chatburn.default.chat_height",      group: "Chat burn", text: "Chat height", type: "number", default: 300 },
        { key: "chatburn.default.chat_font",        group: "Chat burn", text: "Chat font", type: "string", default: "Inter" },
        { key: "chatburn.default.chat_font_size",   group: "Chat burn", text: "Chat font size", type: "number", default: 12 },
        { key: "chatburn.default.horizontal",       group: "Chat burn", text: "Chat horizontal position", type: "array", choices: ["left", "right"], default: "left" },
        { key: "chatburn.default.vertical",         group: "Chat burn", text: "Chat vertical position", type: "array", choices: ["top", "bottom"], default: "top" },
        { key: "chatburn.default.preset",           group: "Chat burn", text: "Burning ffmpeg preset", type: "string", default: "slow" },
        { key: "chatburn.default.crf",              group: "Chat burn", text: "Burning ffmpeg crf", type: "number", default: 26 },

        { key: "thumbnail_format", group: "Thumbnails", text: "Thumbnail format", type: "array", choices: ["jpg", "png", "webp"], default: "jpg" },

    ];

    static MigrateOptions = [
        { from: "youtube_client_id", to: "youtube.client_id" },
        { from: "youtube_client_secret", to: "youtube.client_secret" },
    ];

    static readonly AudioContainer = "m4a";

    static readonly SeasonFormat = "yyyyMM";

    static instance: Config | undefined;
    static getInstance(): Config {
        if (this.instance === undefined) {
            this.instance = new Config();
        }
        return this.instance;
    }

    static getCleanInstance(): Config {
        return new Config();
    }

    static destroyInstance() {
        this.instance = undefined;
    }

    cfg<T>(key: string, defaultValue?: T): T {

        if (this.config === undefined) {
            console.error("Config not loaded", key, defaultValue);
            throw new Error("Config not loaded");
        }

        if (!Config.settingExists(key)) {
            Log.logAdvanced(LOGLEVEL.WARNING, "config", `Setting '${key}' does not exist.`);
            console.warn(chalk.red(`Setting '${key}' does not exist.`));
        }

        // return from env if set
        if (process.env[`TCD_${key.toUpperCase()}`] !== undefined) {
            const val: string | undefined = process.env[`TCD_${key.toUpperCase()}`];
            if (val === undefined) {
                return <T>defaultValue; // should not happen
            }
            const field = Config.getSettingField(key);
            if (field && field.type === "number") {
                return <T><unknown>parseInt(val);
            } else if (field && field.type === "boolean") {
                return <T><unknown>(val === "true" || val === "1");
            } else {
                return <T><unknown>val;
            }
        }

        // return default value if not set
        if (this.config[key] === undefined) {
            const field = Config.getSettingField(key);
            if (defaultValue !== undefined) {
                return defaultValue; // user defined default
            } else if (field && field.default !== undefined) {
                return <T><unknown>field.default; // field default value
            } else {
                return <T><unknown>undefined; // last resort
            }
        }

        return <T><unknown>this.config[key]; // return value

    }

    loadConfig() {

        console.log(chalk.blue("Loading config..."));

        if (!fs.existsSync(BaseConfigPath.config)) {
            console.error("Config file not found, creating new one");
            // throw new Error("Config file does not exist: " + this.configFile);
            this.generateConfig();
        }

        const data = fs.readFileSync(BaseConfigPath.config, "utf8");

        this.config = JSON.parse(data);

        if (this.config) {
            for (const field of Config.MigrateOptions) {
                if (this.config[field.from] !== undefined) {
                    this.config[field.to] = this.config[field.from];
                    // delete this.config[field.from];
                    Log.logAdvanced(LOGLEVEL.INFO, "config", `Migrated setting '${field.from}' to '${field.from}'.`);
                }
            }
        }

        // delete invalid settings
        for (const key in this.config) {
            if (!Config.settingExists(key)) {
                console.warn(chalk.yellow(`Saved setting '${key}' does not exist, deprecated? Discarding.`));
                delete this.config[key];
            }
        }

        if (!this.config) {
            throw new Error("Config is empty even after reading it");
        }

        let changed = false;
        for (const setting of Config.settingsFields) {
            if (this.config[setting.key] === undefined) {
                this.config[setting.key] = setting.default as any;
                console.log(chalk.yellow(`Setting '${setting.key}' not configured, using default value '${setting.default}'.`));
                changed = true;
            }
        }

        if (changed) {
            this.saveConfig("missing default values");
        }

        if (!this.config) throw new Error("Config is empty");

        console.log(chalk.green(`✔ ${Object.keys(this.config).length} settings loaded.`));

        for (const env_var of Object.keys(process.env)) {
            if (env_var.startsWith("TCD_")) {
                const val = this.cfg(env_var.substring(4).toLowerCase());
                console.log(chalk.green(`Overriding setting '${env_var.substring(4)}' with environment variable: '${val}'`));
            }
        }

    }

    generateConfig() {

        console.log("Generating config");

        const example: Record<string, string | boolean | number | string[]> = {};
        for (const field of Config.settingsFields) {
            if (field["default"] !== undefined) example[field["key"]] = field["default"];
        }
        // example["favourites"] = [];
        // example["streamers"] = [];

        this.config = example;
        this.saveConfig("generate config");

    }

    static settingExists(key: string): boolean {
        return this.getSettingField(key) !== undefined;
    }

    static getSettingField(key: string): SettingField<string> | SettingField<number> | SettingField<boolean> | undefined {
        return this.settingsFields.find(field => field["key"] === key);
    }

    setConfig<T extends number | string | boolean>(key: string, value: T): void {

        if (!this.config) {
            throw new Error("Config not loaded");
        }

        const setting = Config.getSettingField(key);

        if (!setting) {
            throw new Error("Setting does not exist: " + key);
        } else {

            let newValue: number | string | boolean = value;

            if (setting.stripslash && typeof newValue === "string") {
                newValue = newValue.replace(/\/$/, "");
            }

            if (setting.type === "number" && typeof newValue === "string") {
                newValue = parseInt(newValue);
            }

            if (setting.type === "boolean" && typeof newValue === "string") {
                newValue = newValue === "true" || newValue === "1";
            }

            this.config[key] = newValue;

            /*

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
            */

        }
    }

    saveConfig(source = "unknown"): boolean {

        this._writeConfig = true;
        this.stopWatchingConfig();

        // back up config
        this.backupConfig();

        // save
        fs.writeFileSync(BaseConfigPath.config, JSON.stringify(this.config, null, 4));

        this._writeConfig = false;

        const success = fs.existsSync(BaseConfigPath.config) && fs.statSync(BaseConfigPath.config).size > 0;

        if (success) {
            Log.logAdvanced(LOGLEVEL.SUCCESS, "config", `Saved config from ${source}`);
        } else {
            Log.logAdvanced(LOGLEVEL.ERROR, "config", `Failed to save config from ${source}`);
        }

        this.startWatchingConfig();

        this.postSaveConfig();

        return success;

    }

    postSaveConfig() {
        this.setupAxios();
        Scheduler.restartScheduler();
        YouTubeHelper.setupClient();
    }

    backupConfig() {
        if (fs.existsSync(BaseConfigPath.config)) {
            fs.copyFileSync(BaseConfigPath.config, `${BaseConfigPath.config}.${Date.now()}.bak`);
        }
    }

    async setupAxios() {

        console.log(chalk.blue("Setting up axios..."));

        if (!this.cfg("api_client_id")) {
            console.error(chalk.red("API client id not set, can't setup axios"));
            return;
        }

        let token;
        try {
            token = await TwitchHelper.getAccessToken();
        } catch (error) {
            console.error(chalk.red(`Failed to get access token: ${error}`));
            return;
        }

        if (!token) {
            Log.logAdvanced(LOGLEVEL.FATAL, "config", "Could not get access token!");
            throw new Error("Could not get access token!");
        }

        TwitchHelper.axios = axios.create({
            baseURL: "https://api.twitch.tv",
            headers: {
                "Client-ID": this.cfg("api_client_id"),
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
        });

        console.log(chalk.green("✔ Axios setup."));

    }

    static createFolders() {

        for (const folder of Object.values(BaseConfigFolder)) {
            if (!fs.existsSync(folder)) {
                console.warn(chalk.yellow(`Folder '${folder}' does not exist, creating.`));
                fs.mkdirSync(folder, { recursive: true });
                console.log(chalk.green(`Created folder: ${folder}`));
            }
        }

        for (const folder of Object.values(BaseConfigDataFolder)) {
            if (!fs.existsSync(folder)) {
                console.warn(chalk.yellow(`Data folder '${folder}' does not exist, creating.`));
                fs.mkdirSync(folder, { recursive: true });
                console.log(chalk.green(`Created data folder: ${folder}`));
            }
        }

    }

    generateEventSubSecret() {
        if (this.cfg("eventsub_secret")) return;
        console.log(chalk.yellow("Generating eventsub secret..."));
        const secret = crypto.randomBytes(16).toString("hex");
        this.setConfig<string>("eventsub_secret", secret);
        this.saveConfig("eventsub_secret not set");
    }

    getWebsocketClientUrl(): string | undefined {

        if (!this.cfg("websocket_enabled")) return undefined;

        // override
        if (this.cfg<string>("websocket_client_address")) {
            return this.cfg<string>("websocket_client_address");
        }

        if (Config.debug) {
            return "ws://localhost:8080/socket/";
        }

        if (!this.cfg<string>("app_url")) {
            console.error(chalk.red("App url not set, can't get websocket client url"));
            return undefined;
        }

        if (this.cfg<string>("app_url") === "debug") {
            Log.logAdvanced(LOGLEVEL.WARNING, "config", "App url set to 'debug', can't get websocket client url");
            return undefined;
        }

        const http_path = this.cfg<string>("app_url");
        // const http_port = Twitchthis.cfg<number>("server_port", 8080);
        const route = "/socket/";
        const ws_path = http_path.replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://");

        return `${ws_path}${route}`;

    }

    startWatchingConfig() {

        if (this.watcher) this.stopWatchingConfig();

        // no blocks in testing
        if (process.env.NODE_ENV === "test") return;

        // monitor config for external changes
        this.watcher = fs.watch(BaseConfigPath.config, (eventType, filename) => {
            if (this._writeConfig) return;
            console.log(`Config file changed: ${eventType} ${filename}`);
            console.log("writeconfig check", Date.now());
            Log.logAdvanced(LOGLEVEL.WARNING, "config", "Config file changed externally");
            // TwitchConfig.loadConfig();
        });

    }

    stopWatchingConfig() {
        if (this.watcher) this.watcher.close();
    }

    checkPermissions() {
        const folder = DataRoot;
        const testfile = `${folder}/perm`;
        try {
            fs.writeFileSync(testfile, "test");
            fs.unlinkSync(testfile);
        } catch (err) {
            console.error(chalk.bgRedBright.whiteBright.bold(`Permissions error: ${err}`));
            process.exit(1);
        }
    }


    /**
     * Initialise entire application, like loading config, creating folders, etc.
     */
    static async init() {

        // Main load
        console.log(chalk.green("Initialising..."));
        console.log(chalk.magenta(`Environment: ${process.env.NODE_ENV}`));
        console.log(chalk.magenta(`Running as user ${process.env.USER}`));

        console.log(`AppRoot: ${AppRoot}`);
        console.log(`DataRoot: ${DataRoot}`);

        if (argv.home && !fs.existsSync(HomeRoot)) {
            fs.mkdirSync(HomeRoot, { recursive: true });
        } else if (!argv.home && !fs.existsSync(DataRoot)) { // create data root, is this a good idea?
            // throw new Error(`DataRoot does not exist: ${DataRoot}`);
            fs.mkdirSync(DataRoot, { recursive: true });
        }

        // check that the app root is not outside of the root
        if (!fs.existsSync(path.join(BaseConfigFolder.server, "tsconfig.json"))) {
            console.error(chalk.red(`Could not find tsconfig.json in ${AppRoot}`));
            // process.exit(1);
            throw new Error(`Could not find tsconfig.json in ${AppRoot}`);
        }

        // check if the client is built before starting the server
        if (!fs.existsSync(path.join(BaseConfigFolder.client, "index.html")) && process.env.NODE_ENV !== "test") {
            console.error(chalk.red("Client is not built. Please run yarn build inside the client-vue folder."));
            console.error(chalk.red(`Expected path: ${path.join(BaseConfigFolder.client, "index.html")}`));
            // process.exit(1);
            throw new Error("Client is not built. Please run yarn build inside the client-vue folder.");
        } else {
            console.log(chalk.green("Client is built: " + path.join(BaseConfigFolder.client, "index.html")));
        }

        // check if the vodplayer is built before starting the server
        if (!fs.existsSync(path.join(BaseConfigFolder.vodplayer, "index.html")) && process.env.NODE_ENV !== "test") {
            console.error(chalk.red("VOD player is not built. Please run yarn build inside the twitch-vod-chat folder."));
            console.error(chalk.red(`Expected path: ${path.join(BaseConfigFolder.vodplayer, "index.html")}`));
            // process.exit(1);
            throw new Error("VOD player is not built. Please run yarn build inside the twitch-vod-chat folder.");
        } else {
            console.log(chalk.green("VOD player is built: " + path.join(BaseConfigFolder.vodplayer, "index.html")));
        }

        // check if the chat dumper is built before starting the server
        if (!fs.existsSync(path.join(AppRoot, "twitch-chat-dumper", "build", "index.js")) && process.env.NODE_ENV !== "test") {
            console.error(chalk.red("Chat dumper is not built. Please run yarn build inside the twitch-chat-dumper folder."));
            console.error(chalk.red(`Expected path: ${path.join(AppRoot, "twitch-chat-dumper", "build", "index.js")}`));
            // process.exit(1);
            throw new Error("Chat dumper is not built. Please run yarn build inside the twitch-chat-dumper folder.");
        } else {
            console.log(chalk.green("Chat dumper is built: " + path.join(AppRoot, "twitch-chat-dumper", "build", "index.js")));
        }

        const config = Config.getInstance().config;
        if (config && Object.keys(config).length > 0) {
            // throw new Error("Config already loaded, has init been called twice?");
            console.error(chalk.red("Config already loaded, has init been called twice?"));
            return false;
        }

        Config.getInstance().checkPermissions();

        Config.createFolders();

        KeyValue.getInstance().load();

        Config.getInstance().loadConfig(); // load config, calls after this will work if config is required

        YouTubeHelper.setupClient();

        ClientBroker.loadNotificationSettings();

        Config.getInstance().generateEventSubSecret();

        await Config.getInstance().setupAxios();

        Log.readTodaysLog();

        Log.logAdvanced(
            LOGLEVEL.SUCCESS,
            "config",
            `The time is ${new Date().toISOString()}.` +
            " Current topside temperature is 93 degrees, with an estimated high of one hundred and five." +
            " The Black Mesa compound is maintained at a pleasant 68 degrees at all times."
        );

        await Config.getInstance().getGitHash();

        TwitchGame.populateGameDatabase();
        TwitchGame.populateFavouriteGames();
        LiveStreamDVR.getInstance().loadChannelsConfig();
        TwitchChannel.loadChannelsCache();
        YouTubeChannel.loadChannelsCache();
        await LiveStreamDVR.getInstance().loadChannels();
        Job.loadJobsFromCache();

        Config.getInstance().startWatchingConfig();

        Scheduler.defaultJobs();

        // monitor for program exit
        // let saidGoobye = false;
        // const goodbye = () => {
        //     if (saidGoobye) return;
        //     TwitchLog.logAdvanced(LOGLEVEL.INFO, "config", "See you next time!");
        //     saidGoobye = true;
        // };
        // process.on("exit", goodbye);
        // process.on("SIGINT", goodbye);
        // process.on("SIGTERM", goodbye);

        Log.logAdvanced(LOGLEVEL.SUCCESS, "config", "Loading config stuff done.");

        Config.getInstance().initialised = true;

    }

    static async resetChannels() {
        TwitchChannel.channels_cache = {};
        LiveStreamDVR.getInstance().channels_config = [];
        LiveStreamDVR.getInstance().channels = [];
        LiveStreamDVR.getInstance().vods = [];
        LiveStreamDVR.getInstance().loadChannelsConfig();
        TwitchChannel.loadChannelsCache();
        YouTubeChannel.loadChannelsCache();
        await LiveStreamDVR.getInstance().loadChannels();
    }

    async validateExternalURL(test_url = ""): Promise<boolean> {

        const url = test_url !== "" ? test_url : this.cfg<string>("app_url");

        Config.validateExternalURLRules(url);

        let full_url = url + "/api/v0/hook";

        if (this.cfg("instance_id") !== undefined) {
            full_url += "?instance=" + this.cfg("instance_id");
        }

        let req: AxiosResponse | undefined;
        let response_body = "";
        let response_status = 0;

        try {
            req = await axios.get(full_url, {
                timeout: 10000,
            });
        } catch (error) {
            if (axios.isAxiosError(error)) {
                response_body = error.response?.data ?? "";
                response_status = error.response?.status ?? 0;
            } else {
                console.error("app url check error", error);
                // res.status(400).send({
                //     status: "ERROR",
                //     message: `External app url could not be contacted on '${full_url}' due to an error: ${error}`,
                // });
                // return;
                throw new Error(`External app url could not be contacted on '${full_url}' due to an error: ${(error as Error).message}`);
            }
        }

        if (req) {
            response_body = req.data;
            response_status = req.status;
        }

        if (response_body !== "No data supplied") {
            // res.status(400).send({
            //     status: "ERROR",
            //     message: `External app url responded with an unexpected response: ${response_body}`,
            // });
            throw new Error(`External app url '${full_url}' responded with an unexpected response: ${response_body} (status: ${response_status})`);
        }

        return true;

    }

    static validateExternalURLRules(url: string) {

        console.debug(`Validating external url: ${url}`);

        // no url
        if (!url) {
            throw new Error("App url not set");
        }

        if (url === "debug") {
            throw new Error("App url is debug, can't validate");
        }

        // no port allowed, only https
        if (url.match(/:\d+/) && !url.match(":443")) {
            throw new Error("App url cannot contain a port");
        }

        // https required
        if (!url.startsWith("https://")) {
            throw new Error("App url must start with https://");
        }

        // no trailing slash
        if (url.endsWith("/")) {
            throw new Error("App url cannot end with a slash");
        }

        return true;
    }

    static get debug(): boolean {
        if (argv.debug) return true;
        if (!Config.getInstance().initialised) return false;
        if (Config.getInstance().forceDebug) return true;
        return Config.getInstance().cfg("debug");
    }

    static get can_shutdown(): boolean {
        if (!LiveStreamDVR.getInstance().channels || LiveStreamDVR.getInstance().channels.length === 0) return true;
        return !LiveStreamDVR.getInstance().channels.some(c => c.is_live);
    }

    async getGitHash() {
        let ret;
        try {
            ret = await Helper.execSimple("git", ["rev-parse", "HEAD"], "git hash check");
        } catch (error) {
            Log.logAdvanced(LOGLEVEL.WARNING, "config.getGitHash", "Could not fetch git hash");
            return false;            
        } 
        if (ret && ret.stdout) {
            this.gitHash = ret.stdout.join("").trim();
            Log.logAdvanced(LOGLEVEL.SUCCESS, "config.getGitHash", `Running on Git hash: ${this.gitHash}`);
            return true;
        } else {
            Log.logAdvanced(LOGLEVEL.WARNING, "config.getGitHash", "Could not fetch git hash");
            return false;
        }
    }

}