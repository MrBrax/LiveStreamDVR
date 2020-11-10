<?php

declare(strict_types=1);

namespace App;

class TwitchConfig
{

	public static $config = [];

	public static $configPath 		= __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "config" . DIRECTORY_SEPARATOR . "config.json";
	public static $gameDbPath 		= __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "cache" . DIRECTORY_SEPARATOR . "games_v2.json";
	public static $historyPath 		= __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "cache" . DIRECTORY_SEPARATOR . "history.json";
	public static $streamerDbPath 	= __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "cache" . DIRECTORY_SEPARATOR . "streamers_v2.json";

	public static $settingsFields = [
		['key' => 'bin_dir', 				'text' => 'Python binary directory', 						'type' => 'string', 'required' => true, 'help' => 'No trailing slash'],
		['key' => 'ffmpeg_path', 			'text' => 'FFmpeg path', 									'type' => 'string', 'required' => true],
		['key' => 'mediainfo_path', 		'text' => 'Mediainfo path', 								'type' => 'string', 'required' => true],
		['key' => 'twitchdownloader_path',	'text' => 'TwitchDownloaderCLI path', 						'type' => 'string'],

		['key' => 'basepath', 				'text' => 'Base path', 										'type' => 'string', 'help' => 'No trailing slash', 'help' => 'For reverse proxy etc'],
		['key' => 'app_url', 				'text' => 'App URL', 										'type' => 'string', 'required' => true, 'help' => 'No trailing slash'],
		['key' => 'webhook_url', 			'text' => 'Webhook URL', 									'type' => 'string', 'help' => 'For external scripting'],
		['key' => 'password', 				'text' => 'Password', 										'type' => 'string', 'help' => 'Keep blank for none. Username is admin'],
		['key' => 'storage_per_streamer', 	'text' => 'Gigabytes of storage per streamer', 				'type' => 'number', 'default' => 100],
		['key' => 'hls_timeout', 			'text' => 'HLS Timeout in seconds (ads)', 					'type' => 'number', 'default' => 200],
		['key' => 'vods_to_keep', 			'text' => 'VODs to keep per streamer', 						'type' => 'number', 'default' => 5],
		['key' => 'sub_lease', 				'text' => 'Subscription lease', 							'type' => 'number', 'default' => 604800],
		['key' => 'api_client_id', 			'text' => 'Twitch client ID', 								'type' => 'string', 'required' => true],
		['key' => 'api_secret', 			'text' => 'Twitch secret', 									'type' => 'string', 'secret' => true, 'required' => true, 'help' => 'Keep blank to not change'],
		// [ 'key' => 'hook_callback', 		'text' => 'Hook callback', 									'type' => 'string', 'required' => true ],
		['key' => 'timezone', 				'text' => 'Timezone', 										'type' => 'array', 'choices' => 'timezones', 'default' => 'UTC', 'help' => 'This only affects the GUI, not the values stored'],

		['key' => 'vod_container', 			'text' => 'VOD container (not tested)', 					'type' => 'array', 'choices' => ['mp4', 'mkv', 'mov'], 'default' => 'mp4'],

		['key' => 'burn_preset', 			'text' => 'Burning h264 preset', 							'type' => 'array', 'choices' => ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow', 'placebo'], 'default' => 'slow'],
		['key' => 'burn_crf', 				'text' => 'Burning h264 crf', 								'type' => 'number', 'default' => 26, 'help' => 'Essentially a quality control. Lower is higher quality.'],

		['key' => 'disable_ads', 			'text' => 'Try to remove ads from captured file',			'type' => 'boolean', 'default' => true, 'help' => 'This removes the "Commercial break in progress", but stream is probably going to be cut off anyway'],
		['key' => 'debug', 					'text' => 'Debug', 											'type' => 'boolean', 'default' => false, 'help' => 'Verbose logging, extra file outputs, more information available. Not for general use.'],
		['key' => 'app_verbose', 			'text' => 'Verbose app output', 							'type' => 'boolean', 'help' => 'Only verbose output'],
		['key' => 'channel_folders', 		'text' => 'Channel folders', 								'type' => 'boolean', 'default' => true, 'help' => 'Store VODs in subfolders instead of root'],
		['key' => 'chat_compress', 			'text' => 'Compress chat with gzip (untested)', 			'type' => 'boolean'],
		['key' => 'relative_time', 			'text' => 'Relative time', 									'type' => 'boolean', 'help' => '"1 hour ago" instead of 2020-01-01'],
		['key' => 'low_latency', 			'text' => 'Low latency (untested)', 						'type' => 'boolean'],
		['key' => 'youtube_dlc', 			'text' => 'Use youtube-dlc instead of the regular one', 	'type' => 'boolean'],
		['key' => 'chat_dump', 				'text' => 'Dump chat during capture', 						'type' => 'boolean', 'default' => false, 'help' => 'Dump chat from IRC with an external python script'],
		['key' => 'ts_sync', 				'text' => 'Try to force sync remuxing', 					'type' => 'boolean', 'default' => false],
		['key' => 'encode_audio', 			'text' => 'Encode audio stream', 							'type' => 'boolean', 'default' => false, 'help' => 'This may help with audio syncing.'],
		['key' => 'fix_corruption', 		'text' => 'Try to fix corruption in remuxing',				'type' => 'boolean', 'default' => false, 'help' => 'This may help with audio syncing.'],
	];

	public static $timezone;

	function __constructor()
	{
		$this->loadConfig();
	}

	public static function cfg(string $var, $def = null)
	{

		if (getenv('TCD_' . strtoupper($var))) return getenv('TCD_' . strtoupper($var)); // environment variable

		if (!isset(self::$config[$var])) return $def; // if not defined

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

	public static function setConfig(string $key, $value)
	{

		if (!self::settingExists($key)) {
			throw new \Exception("Setting does not exist: {$key}");
		}

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

		$config = json_decode(file_get_contents(self::$configPath), true);

		$config['app_name'] = "TwitchAutomator";

		self::$config = $config;

		$streamerList = self::getStreamers();
		$save = false;
		foreach ($streamerList as $i => $streamer) {

			// fix quality string
			if (isset($streamer['quality']) && gettype($streamer['quality']) == "string") {
				TwitchHelper::log(TwitchHelper::LOG_WARNING, "Invalid quality setting on {$streamer['username']}, fixing...");
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
	}

	public static function saveConfig($source = "unknown")
	{

		if (!is_writable(self::$configPath)) {
			TwitchHelper::log(TwitchHelper::LOG_FATAL, "Saving config failed, permissions issue?");
			// return false;
		}

		copy(self::$configPath, self::$configPath . '.bak');

		file_put_contents(self::$configPath, json_encode(self::$config, JSON_PRETTY_PRINT));

		TwitchHelper::webhook([
			'action' => 'config_save'
		]);

		TwitchHelper::log(TwitchHelper::LOG_SUCCESS, "Saved config from {$source}");
	}

	public static function generateConfig()
	{

		$example = [];
		foreach (self::$settingsFields as $field) {
			$example[$field['key']] = $field['default'];
		}
		$example['favourites'] = [];
		$example['streamers'] = [];

		self::$config = $example;
		self::saveConfig();
	}

	public static function getStreamers()
	{
		return self::cfg("streamers", []);
	}

	/**
	 * Get streamer info from local config
	 *
	 * @param string $username
	 * @return array|false
	 */
	public static function getStreamer(string $username, $lowercase = false)
	{
		$streamers = self::getStreamers();
		foreach ($streamers as $s) {
			if ($lowercase && strtolower($s['username']) == strtolower($username)) return $s;
			if ($s['username'] == $username) return $s;
		}
		return false;
	}

	public static function getGames()
	{
		if (!file_exists(self::$gameDbPath)) return [];
		return json_decode(file_get_contents(self::$gameDbPath), true);
	}
}

TwitchConfig::loadConfig();

try {
	TwitchConfig::$timezone = new \DateTimeZone(TwitchConfig::cfg('timezone', 'UTC'));
} catch (\Throwable $th) {
	TwitchConfig::$timezone = new \DateTimeZone('UTC');
	TwitchHelper::log(TwitchHelper::LOG_ERROR, "Config has invalid timezone set");
}

if (!TwitchConfig::cfg('bin_dir')) {
	TwitchHelper::find_bin_dir();
}
