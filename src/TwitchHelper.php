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
	public static $vod_folder 		= __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "public" . DIRECTORY_SEPARATOR . "vods";
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
		__DIR__ . "/../cache/kv",
		__DIR__ . "/../cache/history",
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
			if (!file_exists($dir)) {
				if (!mkdir($dir)) {
					throw new \Exception("Couldn't make directory: {$dir}");
				}
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
	 * @param string $level
	 * @param string $text
	 * @param array $metadata
	 * @deprecated 3.5.0 use logAdvanced instead
	 * @return void
	 */
	public static function log(string $level, string $text, array $metadata = null)
	{
		$dbg = debug_backtrace()[0];

		$filename = basename($dbg['file']);

		self::logAdvanced($level, $filename, $text, $metadata);
	}

	/**
	 * Log a string to the current log file
	 *
	 * @param string $level
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
		// $filename_json 	= TwitchHelper::$logs_folder . DIRECTORY_SEPARATOR . date("Y-m-d") . ".log.json";
		$filename_jsonline 	= TwitchHelper::$logs_folder . DIRECTORY_SEPARATOR . date("Y-m-d") . ".log.jsonline";

		// if (file_exists($filename_json) && filesize($filename_json) == 0) {
		// 	return false;
		// }

		// $log_text = file_exists($filename) ? file_get_contents($filename) : '';
		// $log_json = file_exists($filename_json) ? json_decode(file_get_contents($filename_json), true) : [];
		// if ($log_json === false){
		// 	$log_json = [
		// 		[
		// 			"module" => "SYSTEM",
		// 			"date" => (string)microtime(true),
		// 			"level" => "FATAL",
		// 			"text" => "JSON Corrupted false"
		// 		]
		// 	];
		// }elseif(!$log_json){
		// 	$log_json = [
		// 		[
		// 			"module" => "SYSTEM",
		// 			"date" => (string)microtime(true),
		// 			"level" => "FATAL",
		// 			"text" => "JSON Corrupted unset"
		// 		]
		// 	];
		// }

		/** @todo: this still isn't working properly **/
		/*
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
		*/

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

		$fp = fopen($filename, 'a');
		fwrite($fp, $text_line . "\n");
		fclose($fp);

		$fp = fopen($filename_jsonline, 'a');
		fwrite($fp, json_encode($log_data) . "\n");
		fclose($fp);

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
	 * Return streams for a streamer id
	 * 
	 * "data": [
	 *		{
	 *		"id": "1234",
	 *		"user_id": "5678",
	 *		"user_login": "asdf",
	 *		"user_name": "asdf",
	 *		"game_id": "494131",
	 *		"game_name": "Little Nightmares",
	 *		"type": "live",
	 *		"title": "hablamos y le damos a Little Nightmares 1",
	 *		"viewer_count": 78365,
	 *		"started_at": "2021-03-10T15:04:21Z",
	 *		"language": "es",
	 *		"thumbnail_url": "https://example.com/thumbnail.jpg",
	 *		"tag_ids": [
	 *			"d4bb9c58-2141-4881-bcdc-3fe0505457d1"
	 *		],
	 *		"is_mature": false
	 *		},
	 *		...
	 *	],
	 *
	 * @param string $streamer_id
	 * @return array|false
	 */
	public static function getStreams(string $streamer_id)
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
			if(isset(self::$game_db[$game_id]['added']) && time() > self::$game_db[$game_id]['added'] + (60*60*24*60) ){ // two months?
				self::logAdvanced(self::LOG_INFO, "helper", "Game id {$game_id} needs refreshing.");
			}else{
				return self::$game_db[$game_id];
			}
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

	private static $channel_subscription_types = ['stream.online', 'stream.offline', 'channel.update'];

	public static function channelSubscribe(string $streamer_id)
	{

		$streamer_login = TwitchChannel::channelLoginFromId($streamer_id);
		self::logAdvanced(self::LOG_INFO, "helper", "Subscribing to {$streamer_id} ($streamer_login)...");

		if (!TwitchConfig::cfg('app_url')) {
			throw new \Exception('Neither app_url or hook_callback is set in config');
			return false;
		}

		$hook_callback = TwitchConfig::cfg('app_url') . '/api/v0/hook';

		if (TwitchConfig::cfg('instance_id')) {
			$hook_callback .= '?instance=' . TwitchConfig::cfg('instance_id');
		}

		foreach (self::$channel_subscription_types as $type) {

			if (TwitchConfig::getCache("{$streamer_id}.sub.${type}")) {
				self::logAdvanced(self::LOG_INFO, "helper", "Skip subscription to {$streamer_id}:{$type} ({$streamer_login}), in cache.");
				continue; // todo: alert
			}

			self::logAdvanced(self::LOG_INFO, "helper", "Subscribe to {$streamer_id}:{$type} ({$streamer_login})");

			$data = [
				"type" => $type,
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

			try {

				$response = self::$guzzler->request('POST', '/helix/eventsub/subscriptions', [
					'json' => $data
				]);
			} catch (\GuzzleHttp\Exception\BadResponseException $th) {

				self::logAdvanced(self::LOG_FATAL, "helper", "Subscribe for {$streamer_id}:{$type} ({$streamer_login}) failed: " . $th->getMessage());

				$json = json_decode($th->getResponse()->getBody()->getContents(), true);
				if ($json) {
					if ($json['status'] == 409) { // duplicate
						$id = self::channelGetSubscriptionId($streamer_id, $type);
						TwitchConfig::setCache("{$streamer_id}.sub.${type}", $id);
						continue;
					}
				}

				return false;
				// continue;
			}

			$server_output = $response->getBody()->getContents();
			$http_code = $response->getStatusCode();

			$json = json_decode($server_output, true);

			if ($http_code == 202) {

				if ($json['data'][0]['status'] !== "webhook_callback_verification_pending") {
					self::logAdvanced(self::LOG_ERROR, "helper", "Got 202 return for subscription request for {$streamer_id}:{$type} but did not get callback verification.", ['hub' => $data, 'json' => $json]);
					return false;
					// continue;
				}

				TwitchConfig::setCache("{$streamer_id}.sub.${type}", $json['data'][0]['id']);

				self::logAdvanced(self::LOG_SUCCESS, "helper", "Subscribe for {$streamer_id}:{$type} ({$streamer_login}) seemingly succeeded. Check callback for details.");
			} elseif ($http_code == 409) {
				self::logAdvanced(self::LOG_ERROR, "helper", "Duplicate sub for {$streamer_id}:{$type} detected.", ['hub' => $data]);
			} else {
				self::logAdvanced(self::LOG_ERROR, "helper", "Failed to send subscription request for {$streamer_id}:{$type}: {$server_output}, HTTP {$http_code})", ['hub' => $data]);
				return false;
				// continue;
			}
		}

		return true;
	}

	public static function channelUnsubscribe(string $streamer_id)
	{

		self::logAdvanced(self::LOG_INFO, "helper", "Unsubscribing to {$streamer_id}");

		$streamer_login = TwitchChannel::channelLoginFromId($streamer_id);

		foreach (self::$channel_subscription_types as $type) {

			$id = TwitchConfig::getCache("{$streamer_id}.sub.${type}");

			if (!$id) {
				self::logAdvanced(self::LOG_ERROR, "helper", "No sub id from cache for {$streamer_id}:{$type} ({$streamer_login}), fetch from endpoint");
				$id = self::channelGetSubscriptionId($streamer_id, $type);
				if (!$id) {
					self::logAdvanced(self::LOG_ERROR, "helper", "No sub id from endpoint for {$streamer_id}:{$type} ({$streamer_login}), abort.");
					continue;
				}
			}

			try {

				$response = self::$guzzler->request("DELETE", "/helix/eventsub/subscriptions?id={$id}");
			} catch (\GuzzleHttp\Exception\BadResponseException $th) {

				self::logAdvanced(self::LOG_FATAL, "helper", "Unsubscribe from {$streamer_id}:{$type} ({$streamer_login}) error: " . $th->getMessage());

				/*
				$json = json_decode($th->getResponse()->getBody()->getContents(), true);
				if($json){
					if($json['message']){
						return $json['message'];
					}
				}
				*/

				return false;
			}

			self::logAdvanced(self::LOG_SUCCESS, "helper", "Unsubscribed from {$streamer_id}:{$type} ({$streamer_login})");

			TwitchConfig::setCache("{$streamer_id}.sub.${type}", null);
		}

		return true;
	}

	public static function eventSubUnsubscribe($subscription_id)
	{

		self::logAdvanced(self::LOG_INFO, "helper", "Unsubscribing from eventsub id {$subscription_id}");

		try {

			$response = self::$guzzler->request("DELETE", "/helix/eventsub/subscriptions?id={$subscription_id}");
		} catch (\GuzzleHttp\Exception\BadResponseException $th) {

			self::logAdvanced(self::LOG_FATAL, "helper", "Unsubscribe from eventsub {$subscription_id} error: " . $th->getMessage());

			/*
			$json = json_decode($th->getResponse()->getBody()->getContents(), true);
			if($json){
				if($json['message']){
					return $json['message'];
				}
			}
			*/

			return false;
		}

		self::logAdvanced(self::LOG_SUCCESS, "helper", "Unsubscribed from eventsub {$subscription_id} successfully");

		return true;
	}

	public static function channelGetSubscriptionId($streamer_id, $type)
	{

		$subs = self::getSubs();

		self::logAdvanced(self::LOG_INFO, "helper", "Get subscription id from endpoint for {$streamer_id}:{$type}", ['data' => $subs]);

		foreach ($subs['data'] as $sub) {

			if (
				(string)$sub['condition']['broadcaster_user_id'] == (string)$streamer_id &&
				$sub['type'] == $type
			) {
				self::logAdvanced(self::LOG_SUCCESS, "helper", "Found subscription id from endpoint for {$streamer_id}:{$type} : {$sub['id']}");
				TwitchConfig::setCache("{$streamer_id}.sub.${type}", $sub['id']);
				return $sub['id'];
			}
		}

		self::logAdvanced(self::LOG_ERROR, "helper", "Did not find subscription id from endpoint for {$streamer_id}:{$type}");

		return false;
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
			$response = self::$guzzler->request('GET', '/helix/eventsub/subscriptions', [
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

	public static function findJob(string $search)
	{
		$current_jobs_raw = glob(TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . "*.json");
		$jobs_amount = count($current_jobs_raw);
		// $current_jobs = [];
		foreach ($current_jobs_raw as $v) {
			$name = basename($v, ".json");
			if (strpos($name, $search) !== false) {
				TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "automator", "Found job matching {$search}: {$name}, out of {$jobs_amount} jobs.");
				return TwitchAutomatorJob::load($name);
			}
		}
		TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "automator", "Found no job matching {$search} out of {$jobs_amount} jobs.");
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

		if (TwitchConfig::cfg('websocket_enabled') || getenv('TCD_DOCKER') == 1) {

			$public_websocket_url = TwitchConfig::cfg("websocket_server_address") ?: (preg_replace("/https?/", "ws", TwitchConfig::cfg('app_url')) . "/socket/");

			$docker_websocket_url = "ws://broker:8765/socket/";

			$local_websocket_url = "ws://localhost:8765/socket/";

			$websocket_url = getenv('TCD_DOCKER') == 1 ? $docker_websocket_url : $public_websocket_url;

			/** @todo: developement instead of debug */
			if (TwitchConfig::cfg('debug') && !TwitchConfig::cfg("websocket_server_address")) {
				$websocket_url = $local_websocket_url;
			}

			if (getenv())
				$client = new Websocket\Client($websocket_url);

			try {
				$client->text(json_encode([
					'server' => true,
					'data' => $data
				]));
			} catch (\Throwable $th) {
				TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "websocket", "Websocket send error: " . $th->getMessage());
			}

			if ($client && $client->isConnected()) {
				try {
					$client->close();
				} catch (\Throwable $th) {
					TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "websocket", "Websocket close error: " . $th->getMessage());
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
		return self::$vod_folder . (TwitchConfig::cfg("channel_folders") && $username ? DIRECTORY_SEPARATOR . $username : '');
	}
}

TwitchHelper::$guzzler = new \GuzzleHttp\Client([
	'base_uri' => 'https://api.twitch.tv',
	'headers' => [
		'Client-ID' => TwitchConfig::cfg('api_client_id'),
		'Content-Type' => 'application/json',
		'Authorization' => 'Bearer ' . TwitchHelper::getAccessToken(),
	],
	"verify" => TwitchConfig::cfg('ca_path') ?: true,
]);

TwitchHelper::setupDirectories();
