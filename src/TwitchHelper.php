<?php

declare(strict_types=1);

namespace App;

use GuzzleHttp\Client;
use Symfony\Component\Process\Process;
use App\TwitchAutomatorJob;
use WebSocket;

class TwitchHelper
{

	use Traits\Paths;
	use Traits\SoftwareWrappers;

	public static $accessToken;

	public static $accessTokenFile = __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "cache" . DIRECTORY_SEPARATOR . "oauth.bin";

	public static $accessTokenExpire = 60 * 60 * 24 * 60; // 60 days
	public static $accessTokenRefresh = 60 * 60 * 24 * 30; // 30 days

	public static $game_db = null;

	/** @var \GuzzleHttp\Client */
	public static $guzzler;

	public const LOG_ERROR = "ERROR";
	public const LOG_WARNING = "WARNING";
	public const LOG_INFO = "INFO";
	public const LOG_DEBUG = "DEBUG";
	public const LOG_FATAL = "FATAL";
	public const LOG_SUCCESS = "SUCCESS";

	public const LOG_STDOUT = "stdout";
	public const LOG_STDERR = "stderr";

	public const DATE_FORMAT = "Y-m-d\TH:i:s\Z";

	public static $config_folder 	= __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "config";
	public static $public_folder 	= __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "public";
	public static $logs_folder 		= __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "logs";
	public static $cache_folder 	= __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "cache";
	public static $cron_folder 		= __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "cache" . DIRECTORY_SEPARATOR . "cron";
	public static $pids_folder 		= __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "cache" . DIRECTORY_SEPARATOR . "pids";
	// public static $saved_vods_folder = self::$public_folder . DIRECTORY_SEPARATOR . 'saved_vods';
	// public static $clips_folder = self::$public_folder . DIRECTORY_SEPARATOR . 'saved_clips';

	/**
	 * These directories will be created on page load.
	 *
	 * @var array
	 */
	private static $required_directories = [
		__DIR__ . "/../config",
		__DIR__ . "/../cache",
		__DIR__ . "/../cache/cron",
		__DIR__ . "/../cache/pids",
		__DIR__ . "/../cache/playlist",
		__DIR__ . "/../cache/channel",
		__DIR__ . "/../cache/channel/avatar",
		__DIR__ . "/../cache/channel/background",
		__DIR__ . "/../logs",
		__DIR__ . "/../logs/html",
		__DIR__ . "/../logs/software",
		__DIR__ . "/../payloads",
		__DIR__ . "/../public",
		__DIR__ . "/../public/vods",
		__DIR__ . "/../public/saved_vods",
		__DIR__ . "/../public/saved_clips"
	];

	/**
	 * The quality levels used on twitch. Maybe do this dynamically?
	 *
	 * @var array
	 */
	public static $twitchQuality = [
		"best", // recommended
		"1080p60",
		"1080p",
		"720p60",
		"720p",
		"480p",
		"360p",
		"160p",
		"140p",
		"worst",
		"audio_only"
	];

	private static $last_log_line;

	private static $pid_cache;

	/**
	 * Set up directories for first use
	 *
	 * @return void
	 */
	public static function setupDirectories()
	{
		foreach (self::$required_directories as $dir) {
			// self::log(self::LOG_DEBUG, "Checking directory " . $dir);
			if (!file_exists($dir)) {
				if (!mkdir($dir)) {
					throw new \Exception("Couldn't make directory: {$dir}");
				}
				// self::log(self::LOG_INFO, "Made directory " . $dir);
			}
		}
	}

	/**
	 * Get OAuth token from Twitch. If it exists on disk, read from that instead. If it's too old then get a new one.
	 *
	 * @param boolean $force Force fetch a new token
	 * @return string Token
	 */
	public static function getAccessToken($force = false)
	{

		// token should last 60 days, delete it after 30 just to be sure
		if (file_exists(self::$accessTokenFile)) {
			// $tokenRefresh = time() - filemtime( self::$accessTokenFile ) > TwitchHelper::$accessTokenRefresh;
			// $tokenExpire = time() - filemtime( self::$accessTokenFile ) > TwitchHelper::$accessTokenExpire;
			if (time() > filemtime(self::$accessTokenFile) + TwitchHelper::$accessTokenRefresh) {
				self::logAdvanced(self::LOG_INFO, "helper", "Deleting old access token");
				unlink(self::$accessTokenFile);
			}
		}

		if (!$force && file_exists(self::$accessTokenFile)) {
			self::logAdvanced(self::LOG_DEBUG, "helper", "Fetched access token from cache");
			return file_get_contents(self::$accessTokenFile);
		}

		if (!TwitchConfig::cfg('api_secret') || !TwitchConfig::cfg('api_client_id')) {
			self::logAdvanced(self::LOG_ERROR, "helper", "Missing either api secret or client id, aborting fetching of access token!");
			return false;
		}


		// oauth2
		$oauth_url = 'https://id.twitch.tv/oauth2/token';
		$client = new \GuzzleHttp\Client();

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
			self::logAdvanced(self::LOG_FATAL, "helper", "Tried to get oauth token but server returned: " . $th->getMessage());
			sleep(5);
			return false;
		}


		$server_output = $response->getBody()->getContents();

		$json = json_decode($server_output, true);


		if (!$json || !isset($json['access_token']) || !$json['access_token']) {
			self::logAdvanced(TwitchHelper::LOG_ERROR, "helper", "Failed to fetch access token: {$server_output}");
			throw new \Exception("Failed to fetch access token: {$server_output}");
			return false;
		}

		$access_token = $json['access_token'];

		self::$accessToken = $access_token;

		file_put_contents(self::$accessTokenFile, $access_token);

		self::logAdvanced(TwitchHelper::LOG_INFO, "helper", "Fetched new access token");

		return $access_token;
	}

	/**
	 * Log a string to the current log file
	 *
	 * @param const $level
	 * @param string $text
	 * @param array $metadata
	 * @deprecated 3.5.0 use logAdvanced instead
	 * @return void
	 */
	public static function log(string $level, string $text, array $metadata = null)
	{

		/*
		if (!TwitchConfig::cfg("debug") && $level == self::LOG_DEBUG) return;

		if (!file_exists(TwitchHelper::$logs_folder)) {
			return false;
		}

		$filename 		= TwitchHelper::$logs_folder . DIRECTORY_SEPARATOR . date("Y-m-d") . ".log";
		$filename_json 	= TwitchHelper::$logs_folder . DIRECTORY_SEPARATOR . date("Y-m-d") . ".log.json";

		$log_text = file_exists($filename) ? file_get_contents($filename) : '';
		$log_json = file_exists($filename_json) ? json_decode(file_get_contents($filename_json), true) : [];

		/** @todo: this still isn't working properly **
		if ($level . $text === self::$last_log_line && $log_json) {
			$last = count($log_json) - 1;
			if (isset($log_json[$last])) {
				if (!isset($log_json[$last]['count'])) {
					$log_json[$last]['count'] = 0;
				}
				$log_json[$last]['count'] += 1;
				// file_put_contents($filename_json, json_encode($log_json));
				// return;
			}
		}


		$date = new \DateTime();
		$text_line = $date->format("Y-m-d H:i:s.v") . " | <{$level}> {$text}";
		$log_text .= "\n{$text_line}";

		$log_data = [
			"date" => (string)microtime(true),
			"level" => $level,
			"text" => $text
		];

		if (isset($metadata)) $log_data['metadata'] = $metadata;

		/* // too buggy
		if( TwitchConfig::cfg("debug") ){
			$log_data['source'] = debug_backtrace()[1]; // 1 or 0?
		}
		*

		if ($level == self::LOG_FATAL) {
			error_log($text, 0);
		}

		$log_json[] = $log_data;

		file_put_contents($filename, $log_text);

		file_put_contents($filename_json, json_encode($log_json));

		self::$last_log_line = $level . $text;
		*/

		$dbg = debug_backtrace()[0];

		$filename = basename($dbg['file']);

		self::logAdvanced($level, $filename, $text, $metadata);
	}

	/**
	 * Log a string to the current log file
	 *
	 * @param const $level
	 * @param string $text
	 * @param array $metadata
	 * @return void
	 */
	public static function logAdvanced(string $level, string $module, string $text, array $metadata = null)
	{

		if (!TwitchConfig::cfg("debug") && $level == self::LOG_DEBUG) return;

		if (!file_exists(TwitchHelper::$logs_folder)) {
			return false;
		}

		$filename 		= TwitchHelper::$logs_folder . DIRECTORY_SEPARATOR . date("Y-m-d") . ".log";
		$filename_json 	= TwitchHelper::$logs_folder . DIRECTORY_SEPARATOR . date("Y-m-d") . ".log.json";

		// $log_text = file_exists($filename) ? file_get_contents($filename) : '';
		$log_json = file_exists($filename_json) ? json_decode(file_get_contents($filename_json), true) : [];

		/** @todo: this still isn't working properly **/
		if ($level . $text === self::$last_log_line && $log_json) {
			$last = count($log_json) - 1;
			if (isset($log_json[$last])) {
				if (!isset($log_json[$last]['count'])) {
					$log_json[$last]['count'] = 0;
				}
				$log_json[$last]['count'] += 1;
				// file_put_contents($filename_json, json_encode($log_json));
				// return;
			}
		}


		$date = new \DateTime();
		$text_line = $date->format("Y-m-d H:i:s.v") . " | {$module} | <{$level}> {$text}";
		// $log_text .= "\n{$text_line}";

		$log_data = [
			"module" => $module,
			"date" => (string)microtime(true),
			"level" => $level,
			"text" => $text
		];

		if (isset($metadata)) $log_data['metadata'] = $metadata;

		/* // too buggy
		if( TwitchConfig::cfg("debug") ){
			$log_data['source'] = debug_backtrace()[1]; // 1 or 0?
		}
		*/

		if ($level == self::LOG_FATAL) {
			error_log($text, 0);
		}

		// docker
		if (getenv('TCD_DOCKER') == 1) {
			// error_log($text_line, 0);
			$fp = fopen('php://stdout', 'a');
			fwrite($fp, $text_line . "\n");
			fclose($fp);
		}

		$log_json[] = $log_data;

		// file_put_contents($filename, $log_text);
		$fp = fopen($filename, 'a');
		fwrite($fp, $text_line . "\n");
		fclose($fp);

		file_put_contents($filename_json, json_encode($log_json));

		self::$last_log_line = $level . $text;
	}

	public static function clearLog(string $basename)
	{
		$basepath = self::$logs_folder . DIRECTORY_SEPARATOR . 'software';
		$filepath = $basepath . DIRECTORY_SEPARATOR . $basename . ".log";
		if (file_exists($filepath)) {
			unlink($filepath);
		}
	}

	public static function appendLog(string $basename, string $text, bool $newline = true)
	{
		$basepath = self::$logs_folder . DIRECTORY_SEPARATOR . 'software';
		$filepath = $basepath . DIRECTORY_SEPARATOR . $basename . ".log";

		$fp = fopen($filepath, 'a');
		fwrite($fp, ($newline ? "\n" : "") . trim($text));
		fclose($fp);

		// $filetext = file_exists($filepath) ? file_get_contents($filepath) . ($newline ? "\n" : "") : "";
		// $filetext .= trim($text);
		// file_put_contents($filepath, $filetext);
	}

	/**
	 * Get Twitch channel ID from username
	 *
	 * @param string $username
	 * @return string|bool Channel ID
	 */
	public static function getChannelId(string $username)
	{
		$json_streamers = file_exists(TwitchConfig::$streamerDbPath) ? json_decode(file_get_contents(TwitchConfig::$streamerDbPath), true) : [];

		if ($json_streamers) {
			foreach ($json_streamers as $user_id => $data) {
				if ($data['display_name'] == $username && is_numeric($user_id) && $user_id) {
					return (string)$user_id;
				}
			}
		}

		$access_token = self::getAccessToken();

		if (!$access_token) {
			throw new \Exception('Fatal error, could not get access token for channel id request');
			return false;
		}

		$query = [];
		$query['login'] = $username;

		try {
			$response = self::$guzzler->request('GET', '/helix/users', [
				'query' => $query
			]);
		} catch (\Throwable $th) {
			self::logAdvanced(self::LOG_FATAL, "helper", "getChannelId for {$username} errored: " . $th->getMessage());
			return false;
		}

		$server_output = $response->getBody()->getContents();
		$json = json_decode($server_output, true);

		if (!$json["data"]) {
			self::logAdvanced(self::LOG_ERROR, "helper", "Failed to fetch channel id for {$username}: {$server_output}");
			return false;
		}

		$data = $json["data"][0];

		$data['_updated'] = time();

		$json_streamers[(string)$data['id']] = $data;
		file_put_contents(TwitchConfig::$streamerDbPath, json_encode($json_streamers));

		self::logAdvanced(self::LOG_INFO, "helper", "Fetched channel id online for {$user_id}");

		return (string)$data['id'];
	}

	/**
	 * Get Twitch channel username from ID
	 *
	 * @param string $id
	 * @return string|false Username
	 */
	public static function getChannelUsername(string $user_id)
	{
		/*
		if (!file_exists(TwitchConfig::$streamerDbPath)) return false;
		$channels = json_decode(file_get_contents(TwitchConfig::$streamerDbPath), true);
		foreach ($channels as $username => $data) {
			if ($data['id'] == $id) {
				return $username;
			}
		}
		*/
		$data = self::getChannelData($user_id);
		if (!$data) return false;
		return $data["display_name"];
	}

	/**
	 * Get Twitch channel data from id
	 *
	 * @param string $user_id
	 * @return array
	 */
	public static function getChannelData(string $user_id)
	{

		if(!is_numeric($user_id)){
			throw new \Exception("Non-numeric passed to getChannelData ({$user_id})");
			return false;
		}

		if (file_exists(TwitchConfig::$streamerDbPath)) {

			$json_streamers = json_decode(file_get_contents(TwitchConfig::$streamerDbPath), true);

			if ($json_streamers && isset($json_streamers[$user_id])) {
				self::logAdvanced(self::LOG_DEBUG, "helper", "Fetched channel data from cache for {$user_id} ({$json_streamers[$user_id]['display_name']})");
				if (!isset($json_streamers[$user_id]['_updated']) || time() > $json_streamers[$user_id]['_updated'] + 2592000) {
					self::logAdvanced(self::LOG_INFO, "helper", "Channel data in cache for {$user_id} is too old, proceed to updating!");
				} else {
					return $json_streamers[$user_id];
				}
			}
		} else {
			$json_streamers = [];
		}

		$access_token = self::getAccessToken();

		if (!$access_token) {
			throw new \Exception('Fatal error, could not get access token for channel id request');
			return false;
		}

		$query = [];
		$query['id'] = $user_id;

		try {
			$response = self::$guzzler->request('GET', '/helix/users', [
				'query' => $query
			]);
		} catch (\Throwable $th) {
			self::logAdvanced(self::LOG_FATAL, "helper", "getChannelData for {$user_id} errored: " . $th->getMessage());
			return false;
		}

		$server_output = $response->getBody()->getContents();
		$json = json_decode($server_output, true);

		if (!$json["data"]) {
			self::logAdvanced(self::LOG_ERROR, "helper", "Failed to fetch channel data for {$user_id}: {$server_output}");
			return false;
		}

		$data = $json["data"][0];

		$data["_updated"] = time();

		if( isset($data["profile_image_url"]) && $data["profile_image_url"] ){
			$client = new \GuzzleHttp\Client;
			$avatar_ext = pathinfo($data["profile_image_url"], PATHINFO_EXTENSION);
			$avatar_output = self::$cache_folder . DIRECTORY_SEPARATOR . "channel" . DIRECTORY_SEPARATOR . "avatar" . DIRECTORY_SEPARATOR . $data["display_name"] . "." . $avatar_ext;
			$avatar_final = self::$cache_folder . DIRECTORY_SEPARATOR . "channel" . DIRECTORY_SEPARATOR . "avatar" . DIRECTORY_SEPARATOR . $data["display_name"] . ".webp";
			try {
				$response = $client->request("GET", $data["profile_image_url"], [
					"query" => $query,
					"sink" => $avatar_output
				]);
			} catch (\Throwable $th) {
				self::logAdvanced(self::LOG_ERROR, "helper", "Avatar fetching for {$user_id} errored: " . $th->getMessage());
			}
			if(file_exists($avatar_output)){
				$data["cache_avatar"] = $data["display_name"] . "." . $avatar_ext;
				if(self::path_ffmpeg()){
					self::exec([ self::path_ffmpeg(), "-i", $avatar_output, "-y", $avatar_final ]);
					$data["cache_avatar"] = $data["display_name"] . ".webp";
				}
			}
		}

		$json_streamers[$user_id] = $data;
		file_put_contents(TwitchConfig::$streamerDbPath, json_encode($json_streamers));

		self::logAdvanced(self::LOG_INFO, "helper", "Fetched channel data online for {$user_id}");

		return $data;
	}

	/**
	 * Return videos for a streamer id
	 *
	 * @param string $streamer_id
	 * @return array|false
	 */
	public static function getVideos(string $streamer_id)
	{

		if (!$streamer_id) {
			self::logAdvanced(self::LOG_ERROR, "helper", "No streamer id supplied for videos fetching");
			throw new \Exception("No streamer id supplied for videos fetching");
			return false;
		}

		try {
			$response = self::$guzzler->request('GET', '/helix/videos', [
				'query' => ['user_id' => $streamer_id]
			]);
		} catch (\Throwable $th) {
			self::logAdvanced(self::LOG_FATAL, "helper", "Tried to get videos for {$streamer_id} but server returned: " . $th->getMessage());
			return false;
		}

		$server_output = $response->getBody()->getContents();
		$json = json_decode($server_output, true);

		if (!$json['data']) {
			self::logAdvanced(self::LOG_ERROR, "helper", "No videos found for user id {$streamer_id}");
			return false;
		}

		self::logAdvanced(self::LOG_INFO, "helper", "Querying videos for streamer id {$streamer_id}");

		return $json['data'] ?: false;
	}

	/**
	 * Get Twitch video by video ID
	 *
	 * @param string $video_id
	 * @return array
	 */
	public static function getVideo(int $video_id)
	{

		if (!$video_id) {
			self::logAdvanced(self::LOG_ERROR, "helper", "No video id supplied for videos fetching");
			throw new \Exception("No video id supplied for videos fetching");
			return false;
		}

		try {
			$response = self::$guzzler->request('GET', '/helix/videos', [
				'query' => ['id' => $video_id]
			]);
		} catch (\Throwable $th) {
			self::logAdvanced(self::LOG_FATAL, "helper", "Tried to get video id {$video_id} but server returned: " . $th->getMessage());
			return false;
		}

		$server_output = $response->getBody()->getContents();
		$json = json_decode($server_output, true);

		if (!$json['data']) {
			self::logAdvanced(self::LOG_ERROR, "helper", "No video found for video id {$video_id}");
			return null;
		}

		self::logAdvanced(self::LOG_INFO, "helper", "Querying video info for id {$video_id}");

		return $json['data'][0];
	}

	/**
	 * Return videos for a streamer id
	 *
	 * @param int $streamer_id
	 * @return array|false
	 */
	public static function getStreams(int $streamer_id)
	{

		$response = self::$guzzler->request('GET', '/helix/streams', [
			'query' => ['user_id' => $streamer_id]
		]);

		$server_output = $response->getBody()->getContents();
		$json = json_decode($server_output, true);

		if (!$json['data']) {
			self::logAdvanced(self::LOG_ERROR, "helper", "No streams found for user id {$streamer_id}");
			return false;
		}

		self::logAdvanced(self::LOG_INFO, "helper", "Querying streams for streamer id {$streamer_id}");

		return $json['data'] ?: false;
	}

	/**
	 * Get game by ID from the cache
	 *
	 * @param string $id
	 * @return array
	 */
	public static function getGameData(int $game_id)
	{

		if (!self::$game_db && file_exists(TwitchConfig::$gameDbPath)) {
			self::$game_db = json_decode(file_get_contents(TwitchConfig::$gameDbPath), true);
		}

		if (!$game_id) {
			self::logAdvanced(self::LOG_ERROR, "helper", "No game id supplied for game fetch!");
			return false;
		}

		if (self::$game_db && isset(self::$game_db[$game_id])) {
			return self::$game_db[$game_id];
		}

		if (!self::$game_db) {
			self::$game_db = [];
		}

		self::logAdvanced(self::LOG_DEBUG, "helper", "Game id {$game_id} not in cache, fetching...");

		try {
			$response = self::$guzzler->request('GET', '/helix/games', [
				'query' => ['id' => $game_id]
			]);
		} catch (\Throwable $th) {
			self::logAdvanced(self::LOG_FATAL, "helper", "Tried to get game data for {$game_id} but server returned: " . $th->getMessage());
			return false;
		}

		$server_output = $response->getBody()->getContents();
		$json = json_decode($server_output, true);

		$game_data = $json["data"][0];

		if ($game_data) {

			$game = [
				"id" => $game_id,
				"name" => $game_data["name"],
				"box_art_url" => $game_data["box_art_url"],
				"added" => time()
			];

			self::$game_db[$game_id] = $game;

			// $game_db[ $id ] = $game_data["name"];

			file_put_contents(TwitchConfig::$gameDbPath, json_encode(self::$game_db));

			self::logAdvanced(self::LOG_SUCCESS, "helper", "New game saved to cache: {$game['name']}");

			return $game;
		} else {

			self::logAdvanced(self::LOG_ERROR, "helper", "Invalid game returned in query for {$game_id} ({$server_output})");

			return null;
		}
	}

	public static function getGameName(int $id)
	{

		if (!$id) return false;

		$data = self::getGameData($id);

		if ($data) {
			return $data['name'];
		}

		return false;
	}

	/**
	 * Parse twitch format duration: 1h1m1s
	 * Returns seconds.
	 *
	 * @param string $text Twitch duration
	 * @return int Seconds
	 */
	public static function parseTwitchDuration(string $text)
	{

		preg_match('/([0-9]+)h/', $text, $hours_match);
		preg_match('/([0-9]+)m/', $text, $minutes_match);
		preg_match('/([0-9]+)s/', $text, $seconds_match);

		$total_seconds = 0;

		if ($seconds_match[1]) $total_seconds += $seconds_match[1];
		if ($minutes_match[1]) $total_seconds += $minutes_match[1] * 60;
		if ($hours_match[1]) $total_seconds += $hours_match[1] * 60 * 60;

		return $total_seconds;
	}

	/**
	 * Format duration: 99d 99h 59m 59s
	 *
	 * @param integer $durationInSeconds
	 * @return string
	 */
	public static function getNiceDuration(int $durationInSeconds): string
	{

		$duration = '';
		$days = floor($durationInSeconds / 86400);
		$durationInSeconds -= $days * 86400;
		$hours = floor($durationInSeconds / 3600);
		$durationInSeconds -= $hours * 3600;
		$minutes = floor($durationInSeconds / 60);
		$seconds = $durationInSeconds - $minutes * 60;

		if ($days > 0) {
			$duration .= round($days) . 'd';
		}
		if ($hours > 0) {
			$duration .= ' ' . round($hours) . 'h';
		}
		if ($minutes > 0) {
			$duration .= ' ' . round($minutes) . 'm';
		}
		if ($seconds > 0) {
			$duration .= ' ' . round($seconds) . 's';
		}
		return trim($duration);
	}

	/**
	 * Returns something like "1h1m1s"
	 *
	 * @param integer $seconds
	 * @return string
	 */
	public static function getTwitchDuration(int $seconds): string
	{
		return trim(str_replace(" ", "", self::getNiceDuration($seconds)));
	}

	/**
	 * https://stackoverflow.com/a/2510459
	 *
	 * @param integer $bytes
	 * @param integer $precision
	 * @return string
	 */
	public static function formatBytes(int $bytes, $precision = 2)
	{
		$units = array('B', 'KB', 'MB', 'GB', 'TB');

		$bytes = max($bytes, 0);
		$pow = floor(($bytes ? log($bytes) : 0) / log(1024));
		$pow = min($pow, count($units) - 1);

		// Uncomment one of the following alternatives
		$bytes /= pow(1024, $pow);
		// $bytes /= (1 << (10 * $pow)); 

		return round($bytes, $precision) . ' ' . $units[$pow];
	}

	/**
	 * Return a human readable duration in seconds
	 * TODO: 24+ hour durations
	 *
	 * @param int $duration
	 * @return string
	 */
	public static function printHumanDuration(int $duration)
	{
		/*
		$time = new \DateTime();
		$time->setTimestamp((int)$duration);

		return $time->format("H:i:s");
		*/

		$hours = floor($duration / 3600);
		$minutes = floor(($duration / 60) % 60);
		$seconds = $duration % 60;

		return str_pad((string)$hours, 2, "0", STR_PAD_LEFT) . ":" . str_pad((string)$minutes, 2, "0", STR_PAD_LEFT) . ":" . str_pad((string)$seconds, 2, "0", STR_PAD_LEFT);
	}

	/**
	 * Print human date
	 *
	 * @param DateTime $duration
	 * @return string
	 */
	public static function printHumanDate(int $ts)
	{

		// $ts = $duration->getTimestamp();

		$diff = time() - $ts;
		if ($diff == 0) {
			return 'now';
		} elseif ($diff > 0) {
			$day_diff = floor($diff / 86400);
			if ($day_diff == 0) {
				if ($diff < 60) return 'just now';
				if ($diff < 120) return '1 minute ago';
				if ($diff < 3600) return floor($diff / 60) . ' minutes ago';
				if ($diff < 7200) return '1 hour ago';
				if ($diff < 86400) return floor($diff / 3600) . ' hours ago';
			}
			if ($day_diff == 1) return 'Yesterday';
			if ($day_diff < 7) return $day_diff . ' days ago';
			if ($day_diff < 31) return ceil($day_diff / 7) . ' weeks ago';
			if ($day_diff < 60) return 'last month';
			return date('F Y', $ts);
		} else {
			$diff = abs($diff);
			$day_diff = floor($diff / 86400);
			if ($day_diff == 0) {
				if ($diff < 120) return 'in a minute';
				if ($diff < 3600) return 'in ' . floor($diff / 60) . ' minutes';
				if ($diff < 7200) return 'in an hour';
				if ($diff < 86400) return 'in ' . floor($diff / 3600) . ' hours';
			}
			if ($day_diff == 1) return 'Tomorrow';
			if ($day_diff < 4) return date('l', $ts);
			if ($day_diff < 7 + (7 - date('w'))) return 'next week';
			if (ceil($day_diff / 7) < 4) return 'in ' . ceil($day_diff / 7) . ' weeks';
			if (date('n', $ts) == date('n') + 1) return 'next month';
			return date('F Y', $ts);
		}
	}

	/**
	 * Subscribe to a streamer
	 *
	 * @param string $streamer_name
	 * @return string|bool
	 */
	public static function sub(string $streamer_name)
	{
		return self::sub_handler($streamer_name, 'subscribe');
	}

	/**
	 * Unsubscribe to a streamer
	 *
	 * @param string $streamer_name
	 * @return string|bool
	 */
	public static function unsub(string $streamer_name)
	{
		return self::sub_handler($streamer_name, 'unsubscribe');
	}

	private static function sub_handler(string $streamer_name, $mode = 'subscribe')
	{

		self::logAdvanced(self::LOG_INFO, "helper", "Calling {$mode} for {$streamer_name}");

		if (!TwitchConfig::cfg('app_url')) {
			throw new \Exception('Neither app_url or hook_callback is set in config');
			return false;
		}

		$streamer_id = self::getChannelId($streamer_name);

		if (!$streamer_id) {
			self::logAdvanced(self::LOG_ERROR, "helper", "Streamer ID not found for: {$streamer_name}");
			// throw new \Exception('Streamer ID not found for: ' . $streamer_name);
			return false;
		}

		// $url = 'https://api.twitch.tv/helix/webhooks/hub';
		// $method = 'POST';

		$hook_callback = TwitchConfig::cfg('app_url') . '/api/v0/hook';

		if (TwitchConfig::cfg('instance_id')) {
			$hook_callback .= '?instance=' . TwitchConfig::cfg('instance_id');
		}

		/*
		$data = [
			'hub.callback' => $hook_callback,
			'hub.mode' => $mode,
			'hub.topic' => 'https://api.twitch.tv/helix/streams?user_id=' . $streamer_id,
			'hub.lease_seconds' => TwitchConfig::cfg('sub_lease'),
			// 'hub.secret' => TwitchConfig::cfg('sub_secret')
		];
		*/
		$data = [
			"type" => "stream.online",
			"version" => "1",
			"condition" => [
				"broadcaster_user_id" => $streamer_id
			],
			"transport" => [
				"method" => "webhook",
				"callback" => $hook_callback,
				"secret" => TwitchConfig::cfg('eventsub_secret'),
			]
		];

		// $data_string = json_encode($data);

		try {

			$response = self::$guzzler->request('POST', '/helix/eventsub/subscriptions', [
				'json' => $data
			]);

			// i don't even remember what error this was, shit
			if ($response->getStatusCode() == 429) {
				self::logAdvanced(self::LOG_FATAL, "helper", "429 response");
				sleep(10);
				// throw new \Exception("429 error");
				return false;
			}

		} catch (\Throwable $th) {
			self::logAdvanced(self::LOG_FATAL, "helper", "Sub return, sleep: " . $th->getMessage());
			sleep(10);
			return false;
		}

		$server_output = $response->getBody()->getContents();
		$http_code = $response->getStatusCode();
		// $http_headers = $response->getHeaders();

		$json = json_decode($server_output, true);

		// if ($json['status']) $http_code = $json['status'];

		// TwitchHelper::log(TwitchHelper::LOG_INFO, "Sub response code: " . $http_code);

		if ($http_code == 202) {

			/*
			$hc = self::$cache_folder . DIRECTORY_SEPARATOR . "hubchallenge_{$streamer_id}";
			file_put_contents($hc, time());

			self::logAdvanced(self::LOG_SUCCESS, "helper", "Sent {$mode} request for {$streamer_name} ({$streamer_id})", ['hub' => $data]);

			$response_timeout = 5;
			sleep($response_timeout);
			if (file_exists($hc)) {
				self::logAdvanced(self::LOG_ERROR, "helper", "Did not receive a {$mode} confirmation for {$streamer_name} ({$streamer_id}) within {$response_timeout} seconds, please check your app_url and if it's reachable from outside.", ['hub' => $data]);
				unlink($hc);
				return false;
			}
			*/

			// $this->notify($server_output, '[' . $streamer_name . '] [subscribing]', self::NOTIFY_GENERIC);

			if( $json['data'][0]['status'] !== "webhook_callback_verification_pending" ){
				self::logAdvanced(self::LOG_ERROR, "helper", "Failed to send {$mode} request for {$streamer_name} ({$streamer_id}) ({$server_output}, HTTP {$http_code}) - Did not get callback verification.", ['hub' => $data]);
				return false;
			}

			return true;

		} else {

			// throw new \Exception("Failed to send {$mode} request for {$streamer_name} ({$streamer_id}): {$server_output}");

			self::logAdvanced(self::LOG_ERROR, "helper", "Failed to send {$mode} request for {$streamer_name} ({$streamer_id}) ({$server_output}, HTTP {$http_code})", ['hub' => $data]);

			return false;
		}
	}

	/**
	 * Returns the raw json data of your subscriptions
	 *
	 * @return array|false
	 */
	public static function getSubs()
	{

		self::logAdvanced(self::LOG_INFO, "helper", "Requesting subscriptions list");

		try {
			$response = self::$guzzler->request('GET', '/helix/webhooks/subscriptions', [
				// 'headers' => $headers
			]);
		} catch (\Throwable $th) {
			self::logAdvanced(self::LOG_FATAL, "helper", "Subs return: " . $th->getMessage());
			return false;
		}

		$server_output = $response->getBody()->getContents();

		$json = json_decode($server_output, true);

		return $json;
	}

	public static function unsubAll()
	{

		$subs = self::getSubs();

		if (!$subs['data']) return false;

		foreach ($subs['data'] as $sub) {

			$data = [
				'hub.callback' => $sub['callback'],
				'hub.mode' => 'unsubscribe',
				'hub.topic' => $sub['topic'],
				'hub.lease_seconds' => TwitchConfig::cfg('sub_lease')
			];

			try {
				$response = self::$guzzler->request('POST', '/helix/webhooks/hub', [
					'json' => $data
				]);
			} catch (\Throwable $th) {
				self::logAdvanced(self::LOG_FATAL, "helper", "Unsub all fatal error: " . $th->getMessage());
				return false;
			}

			$server_output = $response->getBody()->getContents();
			$http_code = $response->getStatusCode();
		}

		return true;
	}

	/**
	 * Get pidfile by name, int if running, false if not
	 *
	 * @param string $name
	 * @return int|false
	 * @deprecated 3.5.0
	 */
	public static function getPidfileStatus(string $name)
	{
		/*
		$pidfile = TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . $name . '.pid';

		if (!file_exists($pidfile)) {
			TwitchHelper::log(TwitchHelper::LOG_DEBUG, "PID file check, file does not exist (" . $name . ".pid)");
			return false;
		}

		$pid = file_get_contents($pidfile);

		if (!$pid) {
			TwitchHelper::log(TwitchHelper::LOG_DEBUG, "PID file check, file does not contain any data (" . $name . ".pid)");
			return false;
		}

		$output = TwitchHelper::exec(["ps", "-p", $pid]);

		if (mb_strpos($output, $pid) !== false) {
			TwitchHelper::log(TwitchHelper::LOG_DEBUG, "PID file check, process is running");
			return $pid;
		} else {
			TwitchHelper::log(TwitchHelper::LOG_DEBUG, "PID file check, process does not exist");
			return false;
		}
		*/
		$data = self::getPidfileStatus($name);
		return $data['status'] ? $data['pid'] : false;
	}

	public static function findJob(string $search)
	{
		$current_jobs_raw = glob(TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . "*.json");
		$current_jobs = [];
		foreach ($current_jobs_raw as $v) {
			$name = basename($v, ".json");
			if (strpos($name, $search) !== false) {
				return new TwitchAutomatorJob($name);
			}
		}
		return null;
	}

	/**
	 * Send a webhook POST request to the configured address.
	 * Also sends a websocket request if that's enabled.
	 *
	 * @param array $data
	 * @return void
	 */
	public static function webhook(array $data)
	{

		if(TwitchConfig::cfg('websocket_enabled') || getenv('TCD_DOCKER') == 1 ){
			$public_websocket_url = preg_replace("/https?/", "ws", TwitchConfig::cfg('app_url')) . "/socket/";
			$docker_websocket_url = "ws://broker:8765/socket/";
			$local_websocket_url = "ws://localhost:8765/socket/";
			$websocket_url = getenv('TCD_DOCKER') == 1 ? $docker_websocket_url : $public_websocket_url;

			/** @todo: developement instead of debug */
			if(TwitchConfig::cfg('debug')){
				$websocket_url = $local_websocket_url;
			}

			if(getenv())
			$client = new Websocket\Client($websocket_url);
			
			try {
				$client->text(json_encode([
					'server' => true,
					'data' => $data
				]));
			} catch (\Throwable $th) {
				TwitchHelper::log(TwitchHelper::LOG_ERROR, "Websocket send error: " . $th->getMessage());
			}
			
			if($client && $client->isConnected()){
				try {
					$client->close();
				} catch (\Throwable $th) {
					TwitchHelper::log(TwitchHelper::LOG_ERROR, "Websocket close error: " . $th->getMessage());
				}
				
			}
		}

		if (!TwitchConfig::cfg('webhook_url')) {
			return;
			// throw new \Exception("No webhook URL set");
		}

		$client = new \GuzzleHttp\Client();

		try {
			$client->request("POST", TwitchConfig::cfg('webhook_url'), [
				'form_params' => $data,
				'connect_timeout' => 5,
				'timeout' => 10
			]);
		} catch (\Throwable $th) {
			self::logAdvanced(self::LOG_ERROR, "helper", "Webhook POST error: " . $th->getMessage());
		}
	}

	public static function vodFolder(string $username = null)
	{
		return __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "public" . DIRECTORY_SEPARATOR . "vods" . (TwitchConfig::cfg("channel_folders") && $username ? DIRECTORY_SEPARATOR . $username : '');
	}
}

TwitchHelper::$guzzler = new \GuzzleHttp\Client([
	'base_uri' => 'https://api.twitch.tv',
	'headers' => [
		'Client-ID' => TwitchConfig::cfg('api_client_id'),
		'Content-Type' => 'application/json',
		'Authorization' => 'Bearer ' . TwitchHelper::getAccessToken(),
	]
]);

TwitchHelper::setupDirectories();
