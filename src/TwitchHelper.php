<?php

declare(strict_types=1);

namespace App;

use GuzzleHttp\Client;

class TwitchHelper
{

	use Traits\Paths;
	use Traits\SoftwareWrappers;

	public static $accessToken;

	public static $accessTokenFile = __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "cache" . DIRECTORY_SEPARATOR . "oauth.bin";

	public static $accessTokenExpire = 60 * 60 * 24 * 60; // 60 days
	public static $accessTokenRefresh = 60 * 60 * 24 * 30; // 30 days

	public static $game_db = null;

	public static $guzzler;

	const LOG_ERROR = "ERROR";
	const LOG_WARNING = "WARNING";
	const LOG_INFO = "INFO";
	const LOG_DEBUG = "DEBUG";
	const LOG_FATAL = "FATAL";
	const LOG_SUCCESS = "SUCCESS";

	const LOG_STDOUT = "stdout";
	const LOG_STDERR = "stderr";

	const DATE_FORMAT = "Y-m-d\TH:i:s\Z";

	public static $config_folder 	= __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "config";
	public static $public_folder 	= __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "public";
	public static $logs_folder 		= __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "logs";
	public static $cache_folder 	= __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "cache";
	public static $pids_folder 		= __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "cache" . DIRECTORY_SEPARATOR . "pids";
	// public static $saved_vods_folder = self::$public_folder . DIRECTORY_SEPARATOR . 'saved_vods';
	// public static $clips_folder = self::$public_folder . DIRECTORY_SEPARATOR . 'saved_clips';

	private static $required_directories = [
		__DIR__ . "/../cache",
		__DIR__ . "/../cache/pids",
		__DIR__ . "/../logs",
		__DIR__ . "/../logs/html",
		__DIR__ . "/../logs/software",
		__DIR__ . "/../payloads",
		__DIR__ . "/../public",
		__DIR__ . "/../public/vods",
		__DIR__ . "/../public/saved_vods",
		__DIR__ . "/../public/saved_clips"
	];

	public static $twitchQuality = [
		'best',
		'1080p60',
		'1080p',
		'720p60',
		'720p',
		'480p',
		'360p',
		'140p',
		'worst'
	];

	private static $last_log_line;

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
					throw new \Exception("Couldn't make directory: " . $dir);
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
			if (time() > filemtime(self::$accessTokenFile) + TwitchHelper::$accessTokenRefresh) { // TODO: fix this, i'm bad at math
				self::log(self::LOG_INFO, "Deleting old access token");
				unlink(self::$accessTokenFile);
			}
		}

		if (!$force && file_exists(self::$accessTokenFile)) {
			self::log(self::LOG_DEBUG, "Fetched access token from cache");
			return file_get_contents(self::$accessTokenFile);
		}

		if (!TwitchConfig::cfg('api_secret') || !TwitchConfig::cfg('api_client_id')) {
			self::log(self::LOG_ERROR, "Missing either api secret or client id, aborting fetching of access token!");
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
			self::log(self::LOG_FATAL, "Tried to get oauth token but server returned: " . $th->getMessage());
			sleep(5);
			return false;
		}


		$server_output = $response->getBody()->getContents();

		$json = json_decode($server_output, true);


		if (!$json || !isset($json['access_token']) || !$json['access_token']) {
			self::log(TwitchHelper::LOG_ERROR, "Failed to fetch access token: {$server_output}");
			throw new \Exception("Failed to fetch access token: {$server_output}");
			return false;
		}

		$access_token = $json['access_token'];

		self::$accessToken = $access_token;

		file_put_contents(self::$accessTokenFile, $access_token);

		self::log(TwitchHelper::LOG_INFO, "Fetched new access token");

		return $access_token;
	}

	/**
	 * Log a string to the current log file
	 *
	 * @param const $level
	 * @param string $text
	 * @param array $metadata
	 * @return void
	 */
	public static function log(string $level, string $text, array $metadata = null)
	{

		if (!TwitchConfig::cfg("debug") && $level == self::LOG_DEBUG) return;

		if (!file_exists(TwitchHelper::$logs_folder)) {
			return false;
		}

		$filename 		= TwitchHelper::$logs_folder . DIRECTORY_SEPARATOR . date("Y-m-d") . ".log";
		$filename_json 	= TwitchHelper::$logs_folder . DIRECTORY_SEPARATOR . date("Y-m-d") . ".log.json";

		$log_text = file_exists($filename) ? file_get_contents($filename) : '';
		$log_json = file_exists($filename_json) ? json_decode(file_get_contents($filename_json), true) : [];

		// TODO: this still isn't working properly
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
		$text_line = $date->format("Y-m-d H:i:s.v") . " | <" . $level . "> " . $text;
		$log_text .= "\n" . $text_line;

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
		*/

		if ($level == self::LOG_FATAL) {
			error_log($text, 0);
		}

		$log_json[] = $log_data;

		file_put_contents($filename, $log_text);

		file_put_contents($filename_json, json_encode($log_json));

		self::$last_log_line = $level . $text;
	}

	public static function appendLog(string $basename, string $text, bool $newline = true)
	{
		$basepath = self::$logs_folder . DIRECTORY_SEPARATOR . 'software';
		$filepath = $basepath . DIRECTORY_SEPARATOR . $basename . ".log";
		$filetext = file_exists($filepath) ? file_get_contents($filepath) . ($newline ? "\n" : "") : "";
		$filetext .= trim($text);
		file_put_contents($filepath, $filetext);
	}

	/**
	 * Get Twitch channel ID from username
	 *
	 * @param string $username
	 * @return int|bool Channel ID
	 */
	public static function getChannelId(string $username)
	{
		$data = self::getChannelData($username);
		if (!$data) return false;
		return (int)$data["id"];
	}

	/**
	 * Get Twitch channel ID from username
	 *
	 * @param string $username
	 * @return string
	 */
	public static function getChannelData(string $username)
	{

		if (file_exists(TwitchConfig::$streamerDbPath)) {

			$json_streamers = json_decode(file_get_contents(TwitchConfig::$streamerDbPath), true);

			if ($json_streamers && isset($json_streamers[$username])) {
				self::log(self::LOG_DEBUG, "Fetched channel data from cache for {$username}");
				return $json_streamers[$username];
			}
		} else {

			$json_streamers = [];
		}

		$access_token = self::getAccessToken();

		if (!$access_token) {
			throw new \Exception('Fatal error, could not get access token for channel id request');
			return false;
		}

		/*
		$client = new \GuzzleHttp\Client([
			'base_uri' => 'https://api.twitch.tv',
			'headers' => [
				'Client-ID' => TwitchConfig::cfg('api_client_id'),
				'Content-Type' => 'application/json',
				'Authorization' => 'Bearer ' . TwitchHelper::getAccessToken(),
			]
		]);
		*/

		$response = self::$guzzler->request('GET', '/helix/users', [
			'query' => ['login' => $username]
		]);

		$server_output = $response->getBody()->getContents();
		$json = json_decode($server_output, true);

		if (!$json["data"]) {
			self::log(self::LOG_ERROR, "Failed to fetch channel data for {$username}: {$server_output}");
			// var_dump($json);
			// var_dump( $response->getStatusCode() );
			// throw new Exception( "Failed to fetch channel id: " . $server_output );
			return false;
		}

		$data = $json["data"][0];

		$json_streamers[$username] = $data;
		file_put_contents(TwitchConfig::$streamerDbPath, json_encode($json_streamers));

		self::log(self::LOG_INFO, "Fetched channel data online for {$username}");

		return $data;
	}

	/**
	 * Return videos for a streamer id
	 *
	 * @param int $streamer_id
	 * @return array|false
	 */
	public static function getVideos(int $streamer_id)
	{

		if (!$streamer_id) {
			self::log(self::LOG_ERROR, "No streamer id supplied for videos fetching");
			throw new \Exception("No streamer id supplied for videos fetching");
			return false;
		}

		try {
			$response = self::$guzzler->request('GET', '/helix/videos', [
				'query' => ['user_id' => $streamer_id]
			]);
		} catch (\Throwable $th) {
			self::log(self::LOG_FATAL, "Tried to get videos for {$streamer_id} but server returned: " . $th->getMessage());
			return false;
		}

		$server_output = $response->getBody()->getContents();
		$json = json_decode($server_output, true);

		if (!$json['data']) {
			self::log(self::LOG_ERROR, "No videos found for user id {$streamer_id}");
			return false;
		}

		self::log(self::LOG_INFO, "Querying videos for streamer id {$streamer_id}");

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
			self::log(self::LOG_ERROR, "No video id supplied for videos fetching");
			throw new \Exception("No video id supplied for videos fetching");
			return false;
		}

		try {
			$response = self::$guzzler->request('GET', '/helix/videos', [
				'query' => ['id' => $video_id]
			]);
		} catch (\Throwable $th) {
			self::log(self::LOG_FATAL, "Tried to get video id {$video_id} but server returned: " . $th->getMessage());
			return false;
		}

		$server_output = $response->getBody()->getContents();
		$json = json_decode($server_output, true);

		if (!$json['data']) {
			self::log(self::LOG_ERROR, "No video found for video id {$video_id}");
			return null;
		}

		self::log(self::LOG_INFO, "Querying video info for id {$video_id}");

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
			self::log(self::LOG_ERROR, "No streams found for user id {$streamer_id}");
			return false;
		}

		self::log(self::LOG_INFO, "Querying streams for streamer id {$streamer_id}");

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
			self::log(self::LOG_ERROR, "No game id supplied for game fetch!");
			return false;
		}

		if (self::$game_db && isset(self::$game_db[$game_id])) {
			return self::$game_db[$game_id];
		}

		if (!self::$game_db) {
			self::$game_db = [];
		}

		self::log(self::LOG_DEBUG, "Game id {$game_id} not in cache, fetching...");

		try {
			$response = self::$guzzler->request('GET', '/helix/games', [
				'query' => ['id' => $game_id]
			]);
		} catch (\Throwable $th) {
			self::log(self::LOG_FATAL, "Tried to get game data for {$game_id} but server returned: " . $th->getMessage());
			return false;
		}

		$server_output = $response->getBody()->getContents();
		$json = json_decode($server_output, true);

		$game_data = $json["data"][0];

		if ($game_data) {

			$game = [
				"name" => $game_data["name"],
				"box_art_url" => $game_data["box_art_url"],
				"added" => time()
			];

			self::$game_db[$game_id] = $game;

			// $game_db[ $id ] = $game_data["name"];

			file_put_contents(TwitchConfig::$gameDbPath, json_encode(self::$game_db));

			self::log(self::LOG_SUCCESS, "New game saved to cache: {$game['name']}");

			return $game;
		} else {

			self::log(self::LOG_ERROR, "Invalid game returned in query for {$game_id} ({$server_output})");

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

	/** @deprecated 3.2.0 */
	public static function checkForDeletedVods()
	{

		$deleted = false;

		TwitchHelper::log(TwitchHelper::LOG_INFO, "Check for deleted vods");

		$streamers = TwitchConfig::getStreamers();

		foreach ($streamers as $streamer) {

			$vods = glob(TwitchHelper::vodFolder($streamer['username']) . DIRECTORY_SEPARATOR . $streamer['username'] . "_*.json");

			foreach ($vods as $k => $v) {

				$vodclass = new TwitchVOD();
				$vodclass->load($v);

				if (!$vodclass->is_recording) {

					$isvalid = $vodclass->checkValidVod();

					if (!$isvalid) {
						TwitchHelper::log(TwitchHelper::LOG_WARNING, "VOD deleted: {$vodclass->basename}");
						$deleted = true;
					}
				}
			}
		}

		return $deleted;
	}

	public static function getNiceDuration(int $durationInSeconds)
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

	public static function getTwitchDuration(int $seconds)
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

		$time = new \DateTime();
		$time->setTimestamp((int)$duration);

		return $time->format("H:i:s");
	}

	/**
	 * Print human date
	 *
	 * @param DateTime $duration
	 * @return string
	 */
	public static function printHumanDate(int $duration)
	{

		$ts = $duration->getTimestamp();

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

		/**
		 * TODO: Fix this
		 */
		/*
		 if( !TwitchConfig::getStreamers()[$streamer_name] ) {
			$this->notify('Streamer not found: ' . $streamer_name, '[' . $streamer_name . '] [subscribing error]', self::NOTIFY_ERROR);
			throw new Exception('Streamer not found: ' . $streamer_name);
			return false;
		}
		*/

		TwitchHelper::log(TwitchHelper::LOG_INFO, "Calling {$mode} for {$streamer_name}");

		if (!TwitchConfig::cfg('app_url')) {
			throw new \Exception('Neither app_url or hook_callback is set in config');
			return false;
		}

		$streamer_id = TwitchHelper::getChannelId($streamer_name);

		if (!$streamer_id) {
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "Streamer ID not found for: {$streamer_name}");
			// throw new \Exception('Streamer ID not found for: ' . $streamer_name);
			return false;
		}

		$url = 'https://api.twitch.tv/helix/webhooks/hub';
		$method = 'POST';

		$hook_callback = TwitchConfig::cfg('app_url') . '/hook';

		$data = [
			'hub.callback' => $hook_callback,
			'hub.mode' => $mode,
			'hub.topic' => 'https://api.twitch.tv/helix/streams?user_id=' . $streamer_id,
			'hub.lease_seconds' => TwitchConfig::cfg('sub_lease')
		];

		$data_string = json_encode($data);

		/*
		$client = new \GuzzleHttp\Client([
			'base_uri' => 'https://api.twitch.tv',
			'headers' => [
				'Client-ID' => TwitchConfig::cfg('api_client_id'),
				'Content-Type' => 'application/json',
				'Authorization' => 'Bearer ' . TwitchHelper::getAccessToken(),
			]
		]);
		*/

		try {

			$response = self::$guzzler->request('POST', '/helix/webhooks/hub', [
				'json' => $data
			]);

			if ($response->getStatusCode() == 429) {
				TwitchHelper::log(TwitchHelper::LOG_FATAL, "429 response");
				sleep(10);
				// throw new \Exception("429 error");
				return false;
			}
		} catch (\Throwable $th) {
			TwitchHelper::log(TwitchHelper::LOG_FATAL, "Sub return, sleep: " . $th->getMessage());
			sleep(10);
			return false;
		}

		$server_output = $response->getBody()->getContents();
		$http_code = $response->getStatusCode();

		$json = json_decode($server_output, true);

		if ($json['status']) $http_code = $json['status'];

		TwitchHelper::log(TwitchHelper::LOG_INFO, "Sub response code: " . $http_code);

		if ($http_code == 202) {

			TwitchHelper::log(TwitchHelper::LOG_INFO, "Successfully " . $mode . " to " . $streamer_name);

			// $this->notify($server_output, '[' . $streamer_name . '] [subscribing]', self::NOTIFY_GENERIC);

			return true;
		} else {

			TwitchHelper::log(TwitchHelper::LOG_ERROR, "Failed to " . $mode . " to " . $streamer_name . " | " . $server_output . " | HTTP " . $http_code);

			return false;
		}
	}

	/**
	 * Returns the raw json data of your subscriptions
	 *
	 * @return string
	 */
	public static function getSubs()
	{

		TwitchHelper::log(TwitchHelper::LOG_INFO, "Requesting subscriptions list");

		/*
		$client = new \GuzzleHttp\Client([
			'base_uri' => 'https://api.twitch.tv',
			'headers' => [
				'Client-ID' => TwitchConfig::cfg('api_client_id'),
				'Content-Type' => 'application/json',
				'Authorization' => 'Bearer ' . TwitchHelper::getAccessToken(),
			]
		]);
		*/

		try {
			$response = self::$guzzler->request('GET', '/helix/webhooks/subscriptions', [
				// 'headers' => $headers
			]);
		} catch (\Throwable $th) {
			TwitchHelper::log(TwitchHelper::LOG_FATAL, "Subs return: " . $th->getMessage());
			return false;
		}

		$server_output = $response->getBody()->getContents();

		$json = json_decode($server_output, true);

		return $json;
	}

	/**
	 * Get pidfile by name, int if running, false if not
	 *
	 * @param string $name
	 * @return int|false
	 */
	public static function getPidfileStatus(string $name)
	{

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
	}

	public static function webhook(array $data)
	{

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
			TwitchHelper::log(TwitchHelper::LOG_ERROR, "Webhook POST error: " . $th->getMessage());
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
