import type { SettingField } from "./Config";
import {
    ClipBasenameFields,
    ExporterFilenameFields,
    VodBasenameChapterFields,
    VodBasenameFields,
} from "./ReplacementsConsts";
import { YouTubeCategories } from "./YouTube";

export const settingsFields: Record<string, SettingField> = {
    bin_dir: {
        group: "Binaries",
        text: "Python binary directory",
        type: "string",
        required: true,
        help: "No trailing slash",
        stripslash: true,
    },
    ffmpeg_path: {
        group: "Binaries",
        text: "FFmpeg path",
        type: "string",
        required: true,
    },
    mediainfo_path: {
        group: "Binaries",
        text: "Mediainfo path",
        type: "string",
        required: true,
    },
    twitchdownloader_path: {
        group: "Binaries",
        text: "TwitchDownloaderCLI path",
        type: "string",
    },
    node_path: { group: "Binaries", text: "NodeJS path", type: "string" },
    "bin_path.python": {
        group: "Binaries",
        text: "Python path",
        type: "string",
        required: false,
        help: "This is never used for executing python scripts, only for showing the version.",
    },
    // "bin_path.python3": { group: "Binaries", text: "Python3 path", type: "string", "required": false },

    "python.enable_pipenv": {
        group: "Python",
        text: "Enable pipenv",
        type: "boolean",
        default: false,
    },
    "python.virtualenv_path": {
        group: "Python",
        text: "Virtualenv path",
        type: "string",
        required: false,
    },

    server_port: {
        group: "Basic",
        text: "Server port",
        type: "number",
        default: 8080,
    },
    basepath: {
        group: "Basic",
        text: "Base path",
        type: "string",
        help: "No trailing slash. For reverse proxy etc",
        stripslash: true,
    },
    instance_id: {
        group: "Basic",
        text: "Instance ID",
        type: "string",
        help: "Unique ID for this instance. Used for hook callbacks.",
    },
    trust_proxy: {
        group: "Basic",
        text: "Trust proxy",
        type: "boolean",
        default: false,
        help: "If server is behind a reverse proxy, enable this.",
        restart_required: true,
    },

    "basic.language": {
        group: "Basic",
        text: "Serverside language",
        type: "object",
        default: "en",
        choices: { en: "English", de: "Deutsch", ko: "한국어" },
    },

    app_url: {
        group: "Basic",
        text: "App URL",
        type: "string",
        required: true,
        help: "Must use HTTPS on port 443 (aka no port visible). No trailing slash. E.g. https://livestreamdvr.example.com . Enter 'debug' to not use, no recordings can be made.",
        // 'pattern': '^https:\/\/',
        stripslash: true,
        guest: true,
    },

    isolated_mode: {
        group: "Basic",
        text: "Isolated mode",
        type: "boolean",
        help: "Enable this if your server is not exposed to the internet, aka no EventSub support.",
    },

    date_format: {
        group: "Basic",
        text: "Date format",
        type: "object",
        default: "yyyy-MM-dd",
        help: "Date format for various filenames. See https://date-fns.org/v2.29.3/docs/format",
        choices: {
            "yyyy-MM-dd": "2021-12-31 (default)",
            "yyyy-dd-MM": "2021-31-12",
            "dd-MM-yyyy": "31-12-2021",
            "MM-dd-yyyy": "12-31-2021",
            "dd-MM yyyy": "31-12 2021",
            "MM-dd yyyy": "12-31 2021",
        },
    },

    motd: {
        group: "Interface",
        text: "MOTD",
        type: "string",
        help: "Shown at the top of the dashboard",
        guest: true,
        multiline: true,
    },
    password: {
        group: "Interface",
        text: "Password",
        type: "string",
        help: "Keep blank for none. Username is admin",
    },
    guest_mode: {
        group: "Interface",
        text: "Guest mode",
        type: "boolean",
        default: false,
        help: "Allow guests to access the interface.",
        guest: true,
    },
    // password_secure: { group: "Interface", text: "Force HTTPS for password", type: "boolean", default: true },

    webhook_url: {
        group: "Notifications",
        text: "Webhook URL",
        type: "string",
        help: "For external scripting",
    },
    websocket_enabled: {
        group: "Notifications",
        text: "Websockets enabled",
        type: "boolean",
        default: true,
        help: "Requires a restart.",
        guest: true,
    },
    // websocket_server_address: { group: "Notifications", text: "Websocket server address override", type: "string" },
    websocket_client_address: {
        group: "Notifications",
        text: "Websocket client address override",
        type: "string",
        guest: true,
    },
    websocket_log: {
        group: "Notifications",
        text: "Send logs over websocket",
        type: "boolean",
    },

    channel_folders: {
        group: "Storage",
        text: "Channel folders",
        type: "boolean",
        default: true,
        help: "Store VODs in subfolders instead of root",
        guest: true,
        deprecated: true,
    },
    vod_folders: {
        group: "Storage",
        text: "VOD folders",
        type: "boolean",
        default: true,
        help: "Store VODs in subfolders instead of root",
        guest: true,
    },
    storage_per_streamer: {
        group: "Storage",
        text: "Gigabytes of storage per streamer",
        type: "number",
        default: 100,
    },
    vods_to_keep: {
        group: "Storage",
        text: "VODs to keep per streamer",
        type: "number",
        default: 5,
        help: "This is in addition to kept VODs from muted/favourite etc.",
    },
    keep_deleted_vods: {
        group: "Storage",
        text: "Keep Twitch deleted VODs",
        type: "boolean",
        default: false,
    },
    keep_favourite_vods: {
        group: "Storage",
        text: "Keep favourite VODs",
        type: "boolean",
        default: false,
    },
    keep_muted_vods: {
        group: "Storage",
        text: "Keep muted VODs",
        type: "boolean",
        default: false,
    },
    keep_commented_vods: {
        group: "Storage",
        text: "Keep commented VODs",
        type: "boolean",
        default: false,
    },
    delete_only_one_vod: {
        group: "Storage",
        text: "Delete only one VOD when cleaning up like old times",
        type: "boolean",
        default: false,
    },
    "storage.deleted_cloud": {
        group: "Storage",
        text: "Flag VODs with deleted segments as cloud only",
        type: "boolean",
        default: false,
    },
    "storage.no_watch_files": {
        group: "Storage",
        text: "Don't watch the files for changes",
        type: "boolean",
        default: false,
    },
    "storage.clean_empty_vod_folders": {
        group: "Storage",
        text: "Clean empty VOD folders",
        type: "boolean",
        default: false,
    },

    hls_timeout: {
        group: "Capture",
        text: "HLS Timeout in seconds (ads)",
        type: "number",
        default: 200,
    },
    download_retries: {
        group: "Capture",
        text: "Download/capture retries",
        type: "number",
        default: 5,
    },
    low_latency: {
        group: "Capture",
        text: "Low latency (untested)",
        type: "boolean",
    },
    disable_ads: {
        group: "Capture",
        text: "Try to remove ads from captured file",
        type: "boolean",
        default: true,
        help: 'This removes the "Commercial break in progress", but stream is probably going to be cut off anyway',
    },

    "capture.use_cache": {
        group: "Capture",
        text: "Use cache",
        type: "boolean",
        default: false,
        help: "Use cache directory for in-progress captures",
    },
    "capture.retry_on_error": {
        group: "Capture",
        text: "Retry on error",
        type: "boolean",
        default: true,
        help: "Retry on any kind of error. If an eventsub message is missed, it will be retried.",
    },

    "capture.viewercount": {
        group: "Capture",
        text: "Capture viewercount",
        type: "boolean",
        default: false,
        help: "Capture viewercount",
    },
    "capture.killendedstream": {
        group: "Capture",
        text: "Kill ended stream",
        type: "boolean",
        default: false,
        help: "Kill the capture process when the notification is received that the stream has ended",
    },
    "capture.fallbackcapture": {
        group: "Capture",
        text: "Fallback capture",
        type: "boolean",
        default: false,
        help: "Capture to saved_vods if any of the capture methods fail",
    },

    "capture.twitch-api-header": {
        group: "Capture",
        text: "Twitch API header",
        type: "string",
    },
    "capture.twitch-access-token-param": {
        group: "Capture",
        text: "Twitch access token param",
        type: "string",
    },
    "capture.twitch-client-id": {
        group: "Capture",
        text: "Twitch client ID",
        type: "string",
    },

    "capture.twitch-ttv-lol-plugin": {
        group: "Capture",
        text: "Enable TTV LOL plugin",
        type: "boolean",
        default: false,
    },
    "capture.twitch-proxy-playlist": {
        group: "Capture",
        text: "Proxy playlist URL",
        help: "Separate by commas",
        type: "string",
    },
    "capture.twitch-proxy-playlist-exclude": {
        group: "Capture",
        text: "Proxy username exclude",
        help: "Separate by commas",
        type: "string",
    },

    "capture.autosplit-enabled": {
        group: "Capture",
        text: "Enable video autosplit",
        type: "boolean",
        default: false,
    },

    // sub_lease: { group: "Advanced", text: "Subscription lease", type: "number", default: 604800 },
    api_client_id: {
        group: "Twitch",
        text: "Twitch client ID",
        type: "string",
        required: true,
    },
    api_secret: {
        group: "Twitch",
        text: "Twitch secret",
        type: "string",
        secret: true,
        required: true,
        help: "Keep blank to not change",
    },
    "twitchapi.auth_type": {
        group: "Twitch",
        text: "Twitch auth type",
        type: "object",
        default: "app",
        choices: { user: "User", app: "App" },
    },
    "twitchapi.eventsub_type": {
        group: "Twitch",
        text: "Twitch eventsub type",
        type: "object",
        default: "webhook",
        choices: { webhook: "Webhook", websocket: "Websocket" },
    },
    "twitchapi.eventsub_unsub_on_start": {
        group: "Twitch",
        text: "Unsubscribe from all eventsubs on websocket start",
        type: "boolean",
        default: false,
    },
    "twitch.voddownload.auth_enabled": {
        group: "Twitch",
        text: "Enable VOD download auth with oauth_config.txt",
        type: "boolean",
        default: false,
    },
    "twitchapi.enable_gql": {
        group: "Twitch",
        text: "Enable GQL",
        type: "boolean",
        default: false,
        help: "End-users are not supposed to use GQL, use at your own risk.",
    },

    "youtube.client_id": {
        group: "YouTube",
        text: "YouTube client ID",
        type: "string",
    },
    "youtube.client_secret": {
        group: "YouTube",
        text: "YouTube secret",
        type: "string",
        secret: true,
    },
    "youtube.quota_override": {
        group: "YouTube",
        text: "YouTube quota override",
        type: "boolean",
        default: false,
        help: "Disable quota checks, not recommended unless you have tons of quota",
    },

    // { 'key': 'hook_callback', 		'text': 'Hook callback', 									'type': 'string', 'required': true },
    // {'key': 'timezone', 				'group': 'Interface',	'text': 'Timezone', 										'type': 'array',		'default': 'UTC', 'help': 'This only affects the GUI, not the values stored', 'deprecated': true},

    vod_container: {
        group: "Video",
        text: "VOD container (not tested)",
        type: "array",
        choices: ["mp4", "mkv", "mov"] as string[],
        default: "mp4",
    },

    // {'key': 'burn_preset', 			'group': 'Video',		'text': 'Burning h264 preset', 							    'type': 'array',		'choices': {'ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow', 'placebo'}, 'default': 'slow'},
    // {'key': 'burn_crf', 				'group': 'Video',		'text': 'Burning h264 crf', 								'type': 'number',		'default': 26, 'help': 'Essentially a quality control. Lower is higher quality.'},

    debug: {
        group: "Developer",
        text: "Debug",
        type: "boolean",
        default: false,
        help: "Verbose logging, extra file outputs, more information available. Not for general use.",
        guest: true,
    },
    app_verbose: {
        group: "Developer",
        text: "Verbose app output",
        type: "boolean",
        help: "Only verbose output",
    },
    dump_payloads: {
        group: "Developer",
        text: "Dump payloads",
        type: "boolean",
        default: false,
    },
    "debug.catch_global_exceptions": {
        group: "Developer",
        text: "Catch global exceptions",
        type: "boolean",
        default: false,
        help: "Requires restart",
    },
    "debug.catch_global_rejections": {
        group: "Developer",
        text: "Catch global rejections",
        type: "boolean",
        default: false,
        help: "Requires restart",
    },

    // chat_compress: { group: "Advanced", text: "Compress chat with gzip (untested)", type: "boolean" },
    // relative_time: { group: "Interface", text: "Relative time", type: "boolean", help: "\"1 hour ago\" instead of 2020-01-01" },

    // {'key': 'youtube_dlc', 			'group': 'Advanced',	'text': 'Use youtube-dlc instead of the regular one', 	        'type': 'boolean'},
    // {'key': 'youtube_dl_alternative', 'group': 'Advanced',	'text': 'The alternative to youtube-dl to use', 			    'type': 'string'},
    // pipenv_enabled: { group: "Advanced", text: "Use pipenv", type: "boolean", default: false, deprecated: true },
    // chat_dump: { group: "Basic", text: "Dump chat during capture for all channels", type: "boolean", default: false, help: "Dump chat from IRC, forgoing saved vod chat.", "deprecated": "Use the setting per channel instead" },
    // ts_sync: { group: "Video", text: "Try to force sync remuxing (not recommended)", type: "boolean", default: false },
    // encode_audio: { group: "Video", text: "Encode audio stream", type: "boolean", default: false, help: "This may help with audio syncing." },
    // fix_corruption: { group: "Video", text: "Try to fix corruption in remuxing (not recommended)", type: "boolean", default: false, help: "This may help with audio syncing." },
    playlist_dump: {
        group: "Advanced",
        text: "Use playlist dumping (experimental)",
        type: "boolean",
        default: false,
    },
    // process_wait_method: { group: "Advanced", text: "Process wait method", type: "number", default: 1 },

    eventsub_secret: {
        group: "Advanced",
        text: "EventSub secret",
        type: "string",
        required: true,
    },

    // ca_path: { group: "Advanced", text: "Path to certificate PEM file", type: "string" },

    api_metadata: {
        group: "Twitch",
        text: "Get extra metadata when updating chapter (viewer count).",
        type: "boolean",
        help: "Makes extra API requests.",
    },

    // error_handler: { group: "Advanced", text: "Use app logging to catch PHP errors", type: "boolean" },

    file_permissions: {
        group: "Advanced",
        text: "Set file permissions",
        type: "boolean",
        help: "Warning, can mess up permissions real bad.",
        default: false,
    },
    file_chmod: {
        group: "Advanced",
        text: "File chmod",
        type: "number",
        default: 775,
    },
    file_chown_uid: {
        group: "Advanced",
        text: "File chown uid",
        type: "number",
        default: 100,
    },
    file_chown_gid: {
        group: "Advanced",
        text: "File chown gid",
        type: "number",
        default: 100,
    },

    checkmute_method: {
        group: "Twitch",
        text: "Method to use when checking for muted vods",
        type: "array",
        default: "streamlink",
        choices: ["api", "streamlink"] as string[],
        help: "Bugged as of 2022-03-29: https://github.com/twitchdev/issues/issues/501",
    },

    // telegram
    telegram_enabled: {
        group: "Notifications (Telegram)",
        text: "Enable Telegram notifications",
        type: "boolean",
        default: false,
    },
    telegram_token: {
        group: "Notifications (Telegram)",
        text: "Telegram token",
        type: "string",
    },
    telegram_chat_id: {
        group: "Notifications (Telegram)",
        text: "Telegram chat id",
        type: "string",
    },

    // discord
    discord_enabled: {
        group: "Notifications (Discord)",
        text: "Enable Discord notifications",
        type: "boolean",
        default: false,
    },
    discord_webhook: {
        group: "Notifications (Discord)",
        text: "Discord webhook",
        type: "string",
    },

    // pushover
    "notifications.pushover.enabled": {
        group: "Notifications (Pushover)",
        text: "Enable Pushover notifications",
        type: "boolean",
        default: false,
    },
    "notifications.pushover.token": {
        group: "Notifications (Pushover)",
        text: "Pushover token",
        type: "string",
        help: "API token",
    },
    "notifications.pushover.user": {
        group: "Notifications (Pushover)",
        text: "Pushover user",
        type: "string",
        help: "User recipient key",
    },

    schedule_muted_vods: {
        group: "Schedules",
        text: "Check muted vods",
        type: "boolean",
        default: true,
    },
    schedule_deleted_vods: {
        group: "Schedules",
        text: "Check deleted vods",
        type: "boolean",
        default: true,
    },
    schedule_match_vods: {
        group: "Schedules",
        text: "Match vods",
        type: "boolean",
        default: false,
    },
    "schedule.export_vods": {
        group: "Schedules",
        text: "Export vods",
        type: "boolean",
        default: false,
    },
    create_video_chapters: {
        group: "Video",
        text: "Create video chapters",
        type: "boolean",
        default: true,
    },
    "video.chapters.title": {
        group: "Video",
        text: "Video chapters title",
        type: "object",
        default: "title_and_game",
        choices: {
            title_and_game: "Title and game",
            title: "Title",
            game: "Game",
        },
    },
    create_kodi_nfo: {
        group: "Video",
        text: "Create kodi nfo",
        type: "boolean",
        default: false,
        help: "Requires server restart or channels reset.",
    },

    "contact_sheet.enable": {
        group: "Contact sheet",
        text: "Enable contact sheet creation",
        type: "boolean",
        default: false,
        new: true,
    },
    "contact_sheet.width": {
        group: "Contact sheet",
        text: "Contact sheet width",
        type: "number",
        default: 1920,
    },
    "contact_sheet.grid": {
        group: "Contact sheet",
        text: "Contact sheet grid",
        type: "string",
        default: "3x5",
        help: "3x5 = 3 rows, 5 columns. Only use this format.",
    },

    filename_clip: {
        group: "Video",
        text: "Clip filename",
        type: "template",
        default: "{broadcaster} - {title} [{id}] [{quality}]",
        help: "Clip filename",
        replacements: ClipBasenameFields,
        context: "{template}.mp4",
    },

    filename_vod: {
        group: "Video",
        text: "Vod filename",
        type: "template",
        default: "{internalName}_{date}_{id}",
        help: "Vod filename.",
        replacements: VodBasenameFields,
        context: "{template}.json, {template}.mp4",
    },

    filename_vod_folder: {
        group: "Video",
        text: "Vod folder name",
        type: "template",
        default: "{internalName}_{date}_{id}",
        help: "Vod folder filename.",
        replacements: VodBasenameFields,
        context: "/vods/{internalName}/{template}/",
    },

    "template.vodsplit.folder": {
        group: "Video",
        text: "Vodsplit folder name",
        type: "template",
        default: "{internalName}_{date}_{id}",
        help: "Vodsplit folder filename. If same as Vod folder name, it will be placed in the same folder.",
        replacements: VodBasenameChapterFields,
        context: "/vods/{internalName}/{template}/",
    },

    "template.vodsplit.filename": {
        group: "Video",
        text: "Vodsplit filename",
        type: "template",
        default:
            "{internalName}_{date}_{id}-{chapter_number}._{chapter_title}_({game_name})",
        help: "Vodsplit filename.",
        replacements: VodBasenameChapterFields,
        context: "{template}.mp4",
    },

    min_chapter_duration: {
        group: "Video",
        text: "Minimum chapter duration",
        type: "number",
        default: 0,
        help: "Minimum duration in seconds for a chapter. Shorter chapters will be removed.",
    },

    chatdump_notext: {
        group: "Basic",
        text: "Don't write plain text chat file when dumping chat",
        type: "boolean",
        default: false,
    },

    no_vod_convert: {
        group: "Video",
        text: "Don't convert VODs",
        type: "boolean",
        default: false,
    },

    "exporter.default.exporter": {
        group: "Exporter",
        text: "Default exporter",
        type: "array",
        default: "file",
        choices: ["file", "sftp", "ftp", "rclone", "youtube"] as string[],
        help: "Default exporter for exporter.",
    },
    "exporter.default.directory": {
        group: "Exporter",
        text: "Default directory",
        type: "string",
    },
    "exporter.default.host": {
        group: "Exporter",
        text: "Default host",
        type: "string",
    },
    "exporter.default.username": {
        group: "Exporter",
        text: "Default username",
        type: "string",
    },
    "exporter.default.password": {
        group: "Exporter",
        text: "Default password",
        type: "string",
        help: "This is stored unencrypted.",
    },
    "exporter.default.title_template": {
        group: "Exporter",
        text: "Default title",
        type: "template",
        default: "{internalName}_{date}_{id}",
        help: "Default title for exporter.",
        replacements: ExporterFilenameFields,
    },
    "exporter.default.description": {
        group: "Exporter",
        text: "Default description",
        type: "string",
        help: "YouTube description.",
        multiline: true,
    },
    "exporter.default.category": {
        group: "Exporter",
        text: "Default category",
        type: "object",
        help: "YouTube category.",
        choices: YouTubeCategories,
    },
    "exporter.default.privacy": {
        group: "Exporter",
        text: "Default privacy",
        type: "array",
        help: "YouTube privacy.",
        choices: ["public", "unlisted", "private"] as string[],
        default: "private",
    },
    "exporter.default.tags": {
        group: "Exporter",
        text: "Default tags",
        type: "string",
        help: "YouTube tags.",
    },
    "exporter.default.remote": {
        group: "Exporter",
        text: "Default remote",
        type: "string",
        help: "For RClone.",
    },
    "exporter.auto.enabled": {
        group: "Exporter",
        text: "Enable auto exporter",
        type: "boolean",
        default: false,
        help: "Enable auto exporter. Not fully tested yet.",
    },

    "exporter.youtube.playlists": {
        group: "Exporter",
        text: "YouTube playlists",
        type: "string",
        help: "Use this format with playlist ID's: channelname=ABC123;secondchannel=DEF456",
    },

    "scheduler.clipdownload.enabled": {
        group: "Scheduler (Clip Download)",
        text: "Enable clip download scheduler",
        type: "boolean",
        default: false,
    },
    "scheduler.clipdownload.channels": {
        group: "Scheduler (Clip Download)",
        text: "Channels to download clips from",
        type: "string",
        help: "Separate by commas.",
    },
    "scheduler.clipdownload.amount": {
        group: "Scheduler (Clip Download)",
        text: "Amount of clips to download",
        type: "number",
        default: 1,
    },
    "scheduler.clipdownload.age": {
        group: "Scheduler (Clip Download)",
        text: "Age of clips to download",
        type: "number",
        default: 1 * 24 * 60 * 60,
        help: "In seconds.",
    },

    "reencoder.enabled": {
        group: "Reencoder",
        text: "Enable reencoder",
        type: "boolean",
        default: false,
    },

    "reencoder.video_codec": {
        group: "Reencoder",
        text: "Codec",
        type: "array",
        default: "libx264",
        choices: [
            "libx264",
            "h264_nvenc",
            "h264_qsv",
            "h264_videotoolbox",
            "hevc_nvenc",
        ] as string[],
        help: "Video codec to use for reencoding. If you want to use CUDA, select h264_nvenc or hevc_nvenc and enable Hardware Acceleration.",
    },

    "reencoder.preset": {
        group: "Reencoder",
        text: "Preset",
        type: "array",
        default: "medium",
        choices: [
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
        ] as string[],
    },

    "reencoder.tune": {
        group: "Reencoder",
        text: "Tune",
        type: "array",
        default: "hq",
        choices: ["hq", "ll", "ull", "lossless"] as string[],
    },

    "reencoder.crf": {
        group: "Reencoder",
        text: "CRF",
        type: "number",
        default: 23,
        help: "CRF to use for reencoding. Lower is better.",
    },
    "reencoder.resolution": {
        group: "Reencoder",
        text: "Resolution",
        type: "number",
        help: "Scale to this vertical resolution. Leave blank to keep original resolution.",
    },
    "reencoder.hwaccel": {
        group: "Reencoder",
        text: "Hardware acceleration",
        type: "boolean",
        help: "Preset is used instead of crf if this is enabled.",
    },
    "reencoder.delete_source": {
        group: "Reencoder",
        text: "Delete source",
        type: "boolean",
        help: "Delete source after reencoding.",
    },

    "localvideos.enabled": {
        group: "Local Videos",
        text: "Enable local videos",
        type: "boolean",
        default: false,
    },

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
    "chatburn.default.chat_width": {
        group: "Chat burn",
        text: "Chat width",
        type: "number",
        default: 300,
    },
    "chatburn.default.auto_chat_height": {
        group: "Chat burn",
        text: "Chat auto height",
        type: "boolean",
        default: true,
    },
    "chatburn.default.chat_height": {
        group: "Chat burn",
        text: "Chat height",
        type: "number",
        default: 300,
    },
    "chatburn.default.chat_font": {
        group: "Chat burn",
        text: "Chat font",
        type: "string",
        default: "Inter",
    },
    "chatburn.default.chat_font_size": {
        group: "Chat burn",
        text: "Chat font size",
        type: "number",
        default: 12,
    },
    "chatburn.default.horizontal": {
        group: "Chat burn",
        text: "Chat horizontal position",
        type: "array",
        choices: ["left", "right"] as string[],
        default: "left",
    },
    "chatburn.default.vertical": {
        group: "Chat burn",
        text: "Chat vertical position",
        type: "array",
        choices: ["top", "bottom"] as string[],
        default: "top",
    },
    "chatburn.default.preset": {
        group: "Chat burn",
        text: "Burning ffmpeg preset",
        type: "string",
        default: "slow",
    },
    "chatburn.default.crf": {
        group: "Chat burn",
        text: "Burning ffmpeg crf",
        type: "number",
        default: 26,
    },

    thumbnail_format: {
        group: "Thumbnails",
        text: "Thumbnail format",
        type: "array",
        choices: ["jpg", "png", "webp"] as string[],
        default: "jpg",
    },
} as const;
