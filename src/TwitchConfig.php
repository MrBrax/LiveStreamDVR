<?php

declare(strict_types=1);

namespace App;

use function GuzzleHttp\json_decode;

class TwitchConfig
{

	public static $config = [];

	/**
	 * Channels. Load only when needed with `TwitchConfig::loadChannels()`
	 *
	 * @var TwitchChannel[]
	 */
	private static $channels = [];
	public static $channels_config = [];

	public static $configPath 			= __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "config" . DIRECTORY_SEPARATOR . "config.json";
	public static $channelPath 			= __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "config" . DIRECTORY_SEPARATOR . "channels.json";
	public static $gameDbPath 			= __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "cache" . DIRECTORY_SEPARATOR . "games_v2.json";
	public static $historyPath 			= __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "cache" . DIRECTORY_SEPARATOR . "history.json";
	public static $streamerCachePath 	= __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "cache" . DIRECTORY_SEPARATOR . "streamers_v2.json";

	public static $settingsFields = [

		['key' => 'bin_dir', 				'group' => 'Binaries',	'text' => 'Python binary directory', 						'type' => 'string',		'required' => true, 'help' => 'No trailing slash', 'stripslash' => true],
		['key' => 'ffmpeg_path', 			'group' => 'Binaries',	'text' => 'FFmpeg path', 									'type' => 'string',		'required' => true],
		['key' => 'mediainfo_path', 		'group' => 'Binaries',	'text' => 'Mediainfo path', 								'type' => 'string',		'required' => true],
		['key' => 'twitchdownloader_path',	'group' => 'Binaries',	'text' => 'TwitchDownloaderCLI path', 						'type' => 'string'],

		['key' => 'basepath', 				'group' => 'Advanced',	'text' => 'Base path', 										'type' => 'string',		'help' => 'No trailing slash. For reverse proxy etc', 'stripslash' => true],
		['key' => 'instance_id', 			'group' => 'Basic',		'text' => 'Instance ID', 									'type' => 'string'],

		[
			'key' => 'app_url',
			'group' => 'Basic',
			'text' => 'App URL',
			'type' => 'string',
			'required' => true,
			'help' => 'Must use HTTPS on port 443 (aka no port visible). No trailing slash. E.g. https://twitchautomator.example.com',
			// 'pattern' => '^https:\/\/',
			'stripslash' => true
		],

		['key' => 'webhook_url', 			'group' => 'Basic',		'text' => 'Webhook URL', 									'type' => 'string',		'help' => 'For external scripting'],
		['key' => 'password', 				'group' => 'Interface',	'text' => 'Password', 										'type' => 'string',		'help' => 'Keep blank for none. Username is admin'],
		['key' => 'password_secure', 		'group' => 'Interface',	'text' => 'Force HTTPS for password', 						'type' => 'boolean',	'default' => true],
		['key' => 'websocket_enabled', 		'group' => 'Interface',	'text' => 'Websockets enabled', 							'type' => 'boolean'],
		['key' => 'websocket_server_address', 	'group' => 'Interface',	'text' => 'Websocket server address override', 					'type' => 'string'],
		['key' => 'websocket_client_address', 	'group' => 'Interface',	'text' => 'Websocket client address override', 					'type' => 'string'],
		['key' => 'storage_per_streamer', 	'group' => 'Basic',		'text' => 'Gigabytes of storage per streamer', 				'type' => 'number',		'default' => 100],
		['key' => 'hls_timeout', 			'group' => 'Advanced',	'text' => 'HLS Timeout in seconds (ads)', 					'type' => 'number',		'default' => 200],
		['key' => 'vods_to_keep', 			'group' => 'Basic',		'text' => 'VODs to keep per streamer', 						'type' => 'number',		'default' => 5],
		['key' => 'keep_deleted_vods', 		'group' => 'Basic',		'text' => 'Keep Twitch deleted VODs', 						'type' => 'boolean',	'default' => false],
		['key' => 'keep_favourite_vods', 	'group' => 'Basic',		'text' => 'Keep favourite VODs', 							'type' => 'boolean',	'default' => false],
		['key' => 'keep_muted_vods', 		'group' => 'Basic',		'text' => 'Keep muted VODs', 								'type' => 'boolean',	'default' => false],
		['key' => 'download_retries', 		'group' => 'Advanced',	'text' => 'Download/capture retries', 						'type' => 'number',		'default' => 5],
		['key' => 'sub_lease', 				'group' => 'Advanced',	'text' => 'Subscription lease', 							'type' => 'number',		'default' => 604800],
		['key' => 'api_client_id', 			'group' => 'Basic',		'text' => 'Twitch client ID', 								'type' => 'string',		'required' => true],
		['key' => 'api_secret', 			'group' => 'Basic',		'text' => 'Twitch secret', 									'type' => 'string',		'secret' => true, 'required' => true, 'help' => 'Keep blank to not change'],

		// [ 'key' => 'hook_callback', 		'text' => 'Hook callback', 									'type' => 'string', 'required' => true ],
		['key' => 'timezone', 				'group' => 'Interface',	'text' => 'Timezone', 										'type' => 'array',		'choices' => 'timezones', 'default' => 'UTC', 'help' => 'This only affects the GUI, not the values stored', 'deprecated' => true],

		['key' => 'vod_container', 			'group' => 'Video',		'text' => 'VOD container (not tested)', 					'type' => 'array',		'choices' => ['mp4', 'mkv', 'mov'], 'default' => 'mp4'],

		['key' => 'burn_preset', 			'group' => 'Video',		'text' => 'Burning h264 preset', 							'type' => 'array',		'choices' => ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow', 'placebo'], 'default' => 'slow'],
		['key' => 'burn_crf', 				'group' => 'Video',		'text' => 'Burning h264 crf', 								'type' => 'number',		'default' => 26, 'help' => 'Essentially a quality control. Lower is higher quality.'],

		['key' => 'disable_ads', 			'group' => 'Basic',		'text' => 'Try to remove ads from captured file',			'type' => 'boolean',	'default' => true, 'help' => 'This removes the "Commercial break in progress", but stream is probably going to be cut off anyway'],
		['key' => 'debug', 					'group' => 'Developer',	'text' => 'Debug', 											'type' => 'boolean',	'default' => false, 'help' => 'Verbose logging, extra file outputs, more information available. Not for general use.'],
		['key' => 'app_verbose', 			'group' => 'Developer',	'text' => 'Verbose app output', 							'type' => 'boolean',	'help' => 'Only verbose output'],
		['key' => 'channel_folders', 		'group' => 'Basic',		'text' => 'Channel folders', 								'type' => 'boolean',	'default' => true, 'help' => 'Store VODs in subfolders instead of root'],
		['key' => 'chat_compress', 			'group' => 'Advanced',	'text' => 'Compress chat with gzip (untested)', 			'type' => 'boolean'],
		['key' => 'relative_time', 			'group' => 'Interface',	'text' => 'Relative time', 									'type' => 'boolean',	'help' => '"1 hour ago" instead of 2020-01-01'],
		['key' => 'low_latency', 			'group' => 'Advanced',	'text' => 'Low latency (untested)', 						'type' => 'boolean'],
		['key' => 'youtube_dlc', 			'group' => 'Advanced',	'text' => 'Use youtube-dlc instead of the regular one', 	'type' => 'boolean'],
		['key' => 'pipenv_enabled', 		'group' => 'Advanced',	'text' => 'Use pipenv', 									'type' => 'boolean',	'default' => false],
		['key' => 'chat_dump', 				'group' => 'Basic',		'text' => 'Dump chat during capture', 						'type' => 'boolean',	'default' => false, 'help' => "Dump chat from IRC with an external python script. This isn't all that stable."],
		['key' => 'ts_sync', 				'group' => 'Video',		'text' => 'Try to force sync remuxing (not recommended)', 			'type' => 'boolean',	'default' => false],
		['key' => 'encode_audio', 			'group' => 'Video',		'text' => 'Encode audio stream', 									'type' => 'boolean',	'default' => false, 'help' => 'This may help with audio syncing.'],
		['key' => 'fix_corruption', 		'group' => 'Video',		'text' => 'Try to fix corruption in remuxing (not recommended)',	'type' => 'boolean',	'default' => false, 'help' => 'This may help with audio syncing.'],
		['key' => 'playlist_dump', 			'group' => 'Advanced',	'text' => 'Use playlist dumping (experimental)',			'type' => 'boolean',	'default' => false],
		['key' => 'process_wait_method', 	'group' => 'Advanced',	'text' => 'Process wait method',							'type' => 'number',		'default' => 1],

		['key' => 'eventsub_secret', 		'group' => 'Advanced',	'text' => 'EventSub secret', 								'type' => 'string',		'required' => true],

	];

	public static $timezone;

	function __constructor()
	{
		$this->loadConfig();
	}

	public static function cfg(string $var, $def = null)
	{

		if (!self::settingExists($var)) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_WARNING, "config", "No such config variable '{$var}'.");
		}

		if (getenv('TCD_' . strtoupper($var))) return getenv('TCD_' . strtoupper($var)); // environment variable

		if (!isset(self::$config[$var])) return $def; // if not defined

		// if (self::$config[$var] == null) return null;

		/* i should test this
		if( self::$config[$var] === null ){
			return $def;
		}else{
			return self::$config[$var];
		}
		*/

		return self::$config[$var] ?: $def;
	}

	/**
	 * Check if a setting exists
	 *
	 * @param string $key
	 * @return bool
	 */
	public static function settingExists(string $key): bool
	{
		if (in_array($key, ['favourites', 'streamers'])) return true;

		foreach (self::$settingsFields as $setting) {
			if ($setting['key'] == $key) return true;
		}
		return false;
	}

	public static function getSettingField(string $key)
	{

		foreach (self::$settingsFields as $setting) {
			if ($setting['key'] == $key) return $setting;
		}

		return null;
	}

	public static function setConfig(string $key, $value)
	{

		if (!self::settingExists($key)) {
			throw new \Exception("Setting does not exist: {$key}");
		}

		$field = self::getSettingField($key);
		if (isset($field['stripslash'])) {
			$value = rtrim($value, "\\/"); // strip ending slashes
		}

		// hmm
		if ($field['type'] == 'number') $value = (int)$value;
		if ($field['type'] == 'string') $value = (string)$value;

		self::$config[$key] = $value;
	}

	public static function appendConfig(string $key, $value)
	{

		if (!self::settingExists($key)) {
			throw new \Exception("Setting does not exist: {$key}");
		}

		array_push(self::$config[$key], $value);
	}

	public static function loadConfig()
	{

		if (!file_exists(self::$configPath)) {
			self::generateConfig();
		}

		// second test
		if (!file_exists(self::$configPath)) {
			throw new \Exception("Could not generate config, please check your permissions");
		}

		$config_str = file_get_contents(self::$configPath);

		$config = json_decode($config_str, true);

		$config['app_name'] = "TwitchAutomator";

		self::$config = $config;

		/*
		$streamerList = self::getStreamers();
		$save = false;
		foreach ($streamerList as $i => $streamer) {

			// fix quality string
			if (isset($streamer['quality']) && gettype($streamer['quality']) == "string") {
				TwitchHelper::logAdvanced(TwitchHelper::LOG_WARNING, "config", "Invalid quality setting on {$streamer['username']}, fixing...");
				self::$config['streamers'][$i]['quality'] = explode(" ", self::$config['streamers'][$i]['quality']);
				$save = true;
			}

			// create subfolders
			if (self::cfg('channel_folders') && !file_exists(TwitchHelper::vodFolder($streamer['username']))) {
				mkdir(TwitchHelper::vodFolder($streamer['username']));
			}
		}
		if ($save) {
			self::saveConfig("streamer quality fix");
		}
		*/
	}

	public static function saveConfig($source = "unknown")
	{

		if (!is_writable(self::$configPath)) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_FATAL, "config", "Saving config failed, permissions issue?");
			// return false;
		}

		if (!file_exists(TwitchHelper::$config_folder)) {
			throw new \Exception("Config folder does not exist and could not be automatically created, please create it.");
		}

		// backup
		if (file_exists(self::$configPath)) copy(self::$configPath, self::$configPath . '.bak');

		file_put_contents(self::$configPath, json_encode(self::$config, JSON_PRETTY_PRINT));

		TwitchHelper::webhook([
			'action' => 'config_save'
		]);

		TwitchHelper::logAdvanced(TwitchHelper::LOG_SUCCESS, "config", "Saved config from {$source}");
	}

	public static function generateConfig()
	{

		$example = [];
		foreach (self::$settingsFields as $field) {
			$example[$field['key']] = isset($field['default']) ? $field['default'] : null;
		}
		$example['favourites'] = [];
		$example['streamers'] = [];

		self::$config = $example;
		self::saveConfig();
	}

	public static function loadChannelsConfig(){
		if (!file_exists(self::$channelPath)) return;
		self::$channels_config = json_decode(file_get_contents(self::$channelPath), true) ?: [];
	}

	public static function loadChannels()
	{
		if (count(self::$channels_config) > 0) {
			foreach (self::$channels_config as $s) {
				$ch = TwitchChannel::loadFromLogin($s["login"], true);
				array_push(self::$channels, $ch);
			}
		}
	}

	public static function saveChannels()
	{
		file_put_contents(self::$channelPath, json_encode(self::$channels_config, JSON_PRETTY_PRINT));
		TwitchHelper::logAdvanced(TwitchHelper::LOG_SUCCESS, "config", "Saved channels config");
	}

	public static function getChannels(){
		if(count(self::$channels) == 0){
			TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "job", "Channels list empty when getting, load from config.");
			self::loadChannels();
		}
		return self::$channels;
	}

	/*
	public static function getStreamers()
	{
		return self::$config['streamers'];
	}
	*/

	/**
	 * Get streamer info from local config
	 *
	 * @param string $username
	 * @return TwitchChannel|false
	 */
	public static function getChannelById($channel_id)
	{
		foreach (self::getChannels() as $c) {
			if ($c->userid == $channel_id) return $c;
		}
		return false;
	}

	public static function getChannelByLogin($login)
	{
		foreach (self::getChannels() as $c) {
			if ($c->login == $login) return $c;
		}
		return false;
	}

	/**
	 * Undocumented function
	 *
	 * @deprecated 6.0.0
	 * @param [type] $username
	 * @return TwitchChannel|false
	 */
	public static function getChannelByUsername($username)
	{
		foreach (self::getChannels() as $c) {
			if ($c->userid == $username) return $c;
		}
		return false;
	}

	public static function getGames()
	{
		if (!file_exists(self::$gameDbPath)) return [];
		return json_decode(file_get_contents(self::$gameDbPath), true);
	}

	// todo: redis or something
	public static function getCache($key)
	{
		$key = str_replace("/", "", $key);
		if (!file_exists(TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . "kv" . DIRECTORY_SEPARATOR . $key)) return false;
		return file_get_contents(TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . "kv" . DIRECTORY_SEPARATOR . $key);
	}

	public static function setCache($key, $value)
	{
		$key = str_replace("/", "", $key);
		if ($value === null) {
			if (file_exists(TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . "kv" . DIRECTORY_SEPARATOR . $key)) {
				unlink(TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . "kv" . DIRECTORY_SEPARATOR . $key);
			}
			return;
		}
		file_put_contents(TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . "kv" . DIRECTORY_SEPARATOR . $key, $value);
	}
}

TwitchConfig::loadConfig();
// TwitchConfig::loadChannels();
TwitchConfig::loadChannelsConfig();

try {
	TwitchConfig::$timezone = new \DateTimeZone(TwitchConfig::cfg('timezone', 'UTC'));
} catch (\Throwable $th) {
	TwitchConfig::$timezone = new \DateTimeZone('UTC');
	TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "config", "Config has invalid timezone set");
}

if (!TwitchConfig::cfg('bin_dir')) {
	TwitchHelper::find_bin_dir();
}

if (!TwitchConfig::cfg("eventsub_secret")) {
	TwitchConfig::setConfig("eventsub_secret", bin2hex(random_bytes(16)));
	TwitchConfig::saveConfig("eventsub_secret not set");
}
