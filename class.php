<?php

error_reporting(E_ERROR | E_PARSE);
ini_set('memory_limit','1024M');

require __DIR__ . '/vendor/autoload.php';

// $dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
// $dotenv->load();


function getNiceDuration($durationInSeconds) {

	$duration = '';
	$days = floor($durationInSeconds / 86400);
	$durationInSeconds -= $days * 86400;
	$hours = floor($durationInSeconds / 3600);
	$durationInSeconds -= $hours * 3600;
	$minutes = floor($durationInSeconds / 60);
	$seconds = $durationInSeconds - $minutes * 60;
  
	if($days > 0) {
	  $duration .= $days . 'd';
	}
	if($hours > 0) {
	  $duration .= ' ' . $hours . 'h';
	}
	if($minutes > 0) {
	  $duration .= ' ' . $minutes . 'm';
	}
	if($seconds > 0) {
	  $duration .= ' ' . $seconds . 's';
	}
	return trim($duration);
}

class TwitchConfig {

	public $config = [];

	public function loadConfig(){
		$config = json_decode( file_get_contents("config.json"), true );

		if( $config['app_name'] ){
			$this->config = $config;
		}else{
			throw new Exception("Config is empty");
		}
	}

	function __constructor(){
		$this->loadConfig();
	}

	public function cfg( $var, $def = null ){
		return $this->config[$var] ?: $def;
	}

	public function getStreamers(){
		return $this->cfg("streamers", []);
	}

}

$TwitchConfig = new TwitchConfig();
$TwitchConfig->loadConfig();

class TwitchHelper {

	public static $accessToken;

	public static $accessTokenFile = '.oauth';

	public static function cfg( $var, $def = null ){
		return getenv( $var, $def );
	}

	public static function getAccessToken( $force = false ){

		if( !$force && file_exists( self::$accessTokenFile ) ){
			self::log("Fetched access token from cache");
			return file_get_contents( self::$accessTokenFile );
			// return self::$accessToken;
		}

		
		global $TwitchConfig;

		// oauth2
		$ch = curl_init();
		curl_setopt($ch, CURLOPT_URL, 'https://id.twitch.tv/oauth2/token?client_id=' . $TwitchConfig->cfg('api_client_id') . '&client_secret=' . $TwitchConfig->cfg('api_secret') . '&grant_type=client_credentials');
		curl_setopt($ch, CURLOPT_HTTPHEADER, [
			'Client-ID: ' . $TwitchConfig->cfg('api_client_id')
		]);
		curl_setopt($ch, CURLOPT_POST, 1);
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);

		$server_output = curl_exec($ch);

		curl_close ($ch);

		$json = json_decode( $server_output, true );

		if(!$json['access_token']){
			self::log("Failed to fetch access token: " . $server_output);
			return false;
		}

		$access_token = $json['access_token'];

		self::$accessToken = $access_token;

		file_put_contents( self::$accessTokenFile, $access_token );

		self::log("Fetched new access token");

		return $access_token;

	}

	public static function log( $text ){
		$filename = "logs/" . date("Y-m-d") . ".log";
		$l = file_exists( $filename ) ? file_get_contents( $filename ) : '';

		$text = date("Y-m-d H:i:s") . " | " . $text;

		$l .= "\n" . $text;

		file_put_contents($filename, $l);
	}

	public static function getChannelId( $username ){

		global $TwitchConfig;

		$json_streamers = json_decode( file_get_contents('streamers.json'), true );

		if($json_streamers[$username]) return $json_streamers[$username];

		$access_token = self::getAccessToken();

		// webhook list
		$ch = curl_init();
		curl_setopt($ch, CURLOPT_URL, 'https://api.twitch.tv/helix/users?login=' . $username);
		curl_setopt($ch, CURLOPT_HTTPHEADER, [
		    'Authorization: Bearer ' . $access_token,
		    'Client-ID: ' . $TwitchConfig->cfg('api_client_id')
		]);
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);

		$server_output = curl_exec($ch);

		curl_close ($ch);

		$json = json_decode( $server_output, true );

		if( !$json["data"] ){
			self::log("Failed to fetch channel id: " . $server_output);
			return false;
		}

		$id = $json["data"][0]["id"];
		
		$json_streamers[ $username ] = $id;
		file_put_contents('streamers.json', json_encode($json_streamers));

		return $id;

	}

	public static function getVideos( $streamer_id ){

		global $TwitchConfig;

		$ch = curl_init();
		curl_setopt($ch, CURLOPT_URL, 'https://api.twitch.tv/helix/videos?user_id=' . $streamer_id);
		curl_setopt($ch, CURLOPT_HTTPHEADER, [
			'Authorization: Bearer ' . self::getAccessToken(),
		    'Client-ID: ' . $TwitchConfig->cfg('api_client_id')
		]);

		curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);

		$server_output = curl_exec($ch);

		curl_close($ch);

		// return $server_output;

		$json = json_decode( $server_output, true );

		if( !$json['data'] ){
			self::log("No videos found for user id " . $streamer_id);
			return false;
		}

		return $json['data'] ?: false;

		// print_r($server_output);
		// print_r($info);

	}

	public static function getVideo( $video_id ){

		global $TwitchConfig;

		$ch = curl_init();
		curl_setopt($ch, CURLOPT_URL, 'https://api.twitch.tv/helix/videos?id=' . $video_id);
		curl_setopt($ch, CURLOPT_HTTPHEADER, [
			'Authorization: Bearer ' . self::getAccessToken(),
		    'Client-ID: ' . $TwitchConfig->cfg('api_client_id')
		]);

		curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);

		$server_output = curl_exec($ch);

		curl_close($ch);

		// return $server_output;

		$json = json_decode( $server_output, true );

		if( !$json['data'] ){
			self::log("No video found for video id " . $video_id);
			return null;
		}

		return $json['data'][0];

		// print_r($server_output);
		// print_r($info);

	}

}

class TwitchVOD {

	public $vod_path = 'vods';

	public $filename = '';
	public $basename = '';
	public $json = [];

	public $streamer_name = null;

	public $segments = [];
	public $games = [];

	public $started_at = null;
	public $ended_at = null;

	public $duration = null;

	public $game_offset = null;

	// public function __constructor(){

	//}

	public function load( $filename ){

		if(!file_exists($filename)){
			throw new Exception('VOD not found');
			return false;
		}

		$data = file_get_contents($filename);
		$this->json = json_decode($data, true);

		if( $this->json['started_at'] ){
			$this->started_at = DateTime::createFromFormat("Y-m-d\TH:i:s\Z", $this->json['started_at'] );
		}

		if( $this->json['ended_at'] ){
			$this->ended_at = DateTime::createFromFormat("Y-m-d\TH:i:s\Z", $this->json['ended_at'] );
		}

		$this->filename = $filename;
		// $this->filesize = filesize($filename);
		$this->basename = basename($filename, '.json');

		$this->segments = $this->json['segments'];
		
		$this->parseGames($this->json['games']);

		$this->streamer_name = $this->json['meta']['data'][0]['user_name'];
		$this->streamer_id = TwitchHelper::getChannelId( $this->streamer_name );

		$this->twitch_vod_id 	= $this->json['twitch_vod_id'];
		$this->twitch_vod_url 	= $this->json['twitch_vod_url'];	
		$this->duration 		= $this->json['duration'];	

	}

	public function getDuration( $save = false ){

		if( $this->duration ) return $this->duration;

		$getID3 = new getID3;

		$file = $getID3->analyze( $this->segments[0] );

		if( !$file['playtime_string'] ){

			return false;

		}else{
		
			$this->duration = $file['playtime_string'];

			if( $save ){
				$this->saveJSON();
			}

			return $file['playtime_string'];

		}

	}

	/**
	 * Download chat with tcd
	 * @param  int 		$video_id [description]
	 * @param  string 	$basename [description]
	 * @return array    filename, cmd output, cmd
	 */
	public function downloadChat(){

		global $TwitchConfig;

		if(!file_exists($TwitchConfig->cfg('bin_dir') . '/tcd')){
			throw new Exception('tcd not found');
			return false;
		}

		if(!$this->twitch_vod_id){
			throw new Exception('no twitch vod id');
			return false;
		}

		$chat_filename = $this->vod_path . '/' . $this->basename . '.chat.json';

		$cmd = $TwitchConfig->cfg('bin_dir') . '/tcd --video ' . escapeshellarg($this->twitch_vod_id) . ' --client_id ' . escapeshellarg( $TwitchConfig->cfg('api_client_id') ) . ' --format json --output ' . escapeshellarg($chat_filename);

		$capture_output = shell_exec( $cmd );

		return [$chat_filename, $capture_output, $cmd];

	}

	public function matchTwitchVod(){

		global $TwitchConfig;

		$channel_videos = TwitchHelper::getVideos( $this->streamer_id );

		$vod_id = null;

		foreach ($channel_videos as $vid) {
			
			$video_time = DateTime::createFromFormat( $TwitchConfig->cfg('date_format'), $vid['created_at'] );

			// if within 5 minutes difference
			if( abs( $this->started_at->getTimestamp() - $video_time->getTimestamp() ) < 300 ){
				$this->twitch_vod_id = $vid['id'];
				$this->twitch_vod_url = $vid['url'];
				return $this->twitch_vod_id;
			}

		}

		TwitchHelper::log("Couldn't match vod for " . $this->basename);

	}

	public function checkValidVod(){

		global $TwitchConfig;

		$video = TwitchHelper::getVideo( $this->twitch_vod_id );

		if( $video ){
			return true;
		}

		return false;

		// TwitchHelper::log("Couldn't match vod for " . $this->basename);

	}

	/**
	 * Save JSON to file, be sure to load it first!
	 */
	public function saveJSON(){

		$generated = $this->json;

		if( $this->twitch_vod_id && $this->twitch_vod_url){
			$generated['twitch_vod_id'] 	= $this->twitch_vod_id;
			$generated['twitch_vod_url'] 	= $this->twitch_vod_url;
		}

		$generated['streamer_name'] 	= $this->streamer_name;
		$generated['streamer_id'] 		= $this->streamer_id;

		$generated['games'] 			= $this->games;
		$generated['segments'] 			= $this->segments;

		$generated['duration'] 			= $this->duration;

		file_put_contents($this->filename, json_encode($generated));

		return $generated;

	}

	private function parseGames( $array ){

		global $TwitchConfig;

		$games = [];

		foreach ($this->json['games'] as $game) {
			
			$entry = $game;

			$entry['datetime'] = DateTime::createFromFormat( $TwitchConfig->cfg("date_format"), $entry['time'] );

			if($this->started_at){
				$entry['offset'] = $entry['datetime']->getTimestamp() - $this->started_at->getTimestamp();
			}

			$games[] = $entry;

		}

		$i = 0;

		foreach ($games as $game) {
			
			if($games[$i+1]){
				$games[$i]['duration'] = $games[$i+1]['datetime']->getTimestamp() - $game['datetime']->getTimestamp();
			}

			if($i == 0){
				$this->game_offset = $game['offset'];
			}

			if($i == sizeof($games)-1 && $this->ended_at){
				$games[$i]['duration'] = $this->ended_at->getTimestamp() - $game['datetime']->getTimestamp();
			}

			$i++;

		}

		$this->games = $games;

	}

	public function saveLosslessCut(){

		$data = "";

		foreach( $this->games as $k => $game ){

			$offset = $game['offset'];

			$offset -= $this->games[0]['offset'];
			
			$data .= $offset . ',';
			
			if( $k < sizeof($this->games)-1 ){
				$data .= ( $offset + $game['duration'] ) . ',';
			}else{
				$data .= ',';
			}

			$data .= $game['game_name'] ?: $game['game_id'];
			$data .= "\n";
		}

		file_put_contents( $this->vod_path . '/' . $this->basename . '-llc-edl.csv', $data );

	}

}

class TwitchAutomator {

	public $data_cache 		= [];

	public $json = [];

	public $errors = [];
	public $info = [];

	const NOTIFY_GENERIC = 1;
	const NOTIFY_DOWNLOAD = 2;
	const NOTIFY_ERROR = 4;
	const NOTIFY_GAMECHANGE = 8;

	public $notify_level = NOTIFY_GENERIC && NOTIFY_DOWNLOAD && NOTIFY_ERROR && NOTIFY_GAMECHANGE;

	public function basename( $data ){

		$data_id = $data['data'][0]['id'];
		$data_title = $data['data'][0]['title'];
		$data_started = $data['data'][0]['started_at'];
		$data_game_id = $data['data'][0]['game_id'];
		$data_username = $data['data'][0]['user_name'];

		return $data_username . '_' . $data_id . '_' . str_replace(':', '_', $data_started);

	}

	public function getDateTime(){
		date_default_timezone_set('UTC');
		return date("Y-m-d\TH:i:s\Z");
		// return time();
	}

	public function jsonLoad(){

		if( !$this->data_cache ){
			$this->errors[] = 'No JSON cache when loading';
			return false;
		}

		$basename = $this->basename( $this->data_cache );

		if( !file_exists('vods/' . $basename . '.json') ){
			$this->errors[] = 'No JSON file when loading';
			$this->json = [];
			return;
		}

		$json = json_decode( file_get_contents( 'vods/' . $basename . '.json' ), true );

		if(!$json || $json == null) $json = [];

		$this->json = $json;

		return true;

	}

	public function jsonSave(){

		if( !$this->data_cache ){
			$this->errors[] = 'No JSON cache when saving';
			return false;
		}

		$basename = $this->basename( $this->data_cache );

		file_put_contents( 'vods/' . $basename . '.json', json_encode( $this->json ) );

		return true;

	}
	
	public function notify( $body, $title, $notification_type = self::NOTIFY_GENERIC ){

		global $TwitchConfig;

		$headers = "From: " . $TwitchConfig->cfg('notify_from') . "\r\n";
		$headers .= "Content-Type: text/html; charset=UTF-8\r\n";

		$body = '<h1>' . $title . '</h1>' . $body;

		if($this->data_cache){
			$body .= '<pre>' . print_r( $this->data_cache, true ) . '</pre>';
		}

		if( sizeof($this->errors) > 0 ){

			$body .= '<h3>Errors</h3>';

			$body .= '<ul class="errors">';
			foreach ($this->errors as $k => $v) {
				$body .= '<li>' . $v . '</li>';
			}
			$body .= '</ul>';

		}

		if( sizeof($this->info) > 0 ){

			$body .= '<h3>Info</h3>';

			$body .= '<ul class="info">';
			foreach ($this->info as $k => $v) {
				$body .= '<li>' . $v . '</li>';
			}
			$body .= '</ul>';

		}

		if( $TwitchConfig->cfg('notify_to') ){
			mail($TwitchConfig->cfg('notify_to'), $TwitchConfig->cfg('app_name') . ' - ' . $title, $body, $headers);
		}else{
			file_put_contents('logs/' . date("Y-m-d.H_i_s") . '.html', $body);
		}

	}

	public function cleanup( $streamer_name ){

		global $TwitchConfig;

		$vods = glob("vods/" . $streamer_name . "_*.mp4");

		$total_size = 0;

		foreach ($vods as $v) {
			$total_size += filesize($v);
		}

		$gb = $total_size / 1024 / 1024 / 1024;

		$this->info[] = 'Total filesize for ' . $streamer_name . ': ' . $gb;

		if( sizeof($vods) > $TwitchConfig->cfg('vods_to_keep') || $gb > $TwitchConfig->cfg('storage_per_streamer') ){
			
			$this->notify('', ' (cleanup: ' . $vods[0] . ', size: ' . $gb . 'GB)');

			$basename = substr( $vods[0], 0, strlen($vods[0])-4 );

			unlink(sprintf('%s.mp4', $basename));
			unlink(sprintf('%s.json', $basename));
			unlink(sprintf('%s-llc-edl.csv', $basename)); // losslesscut
			
		}

	}

	public function handle( $data ){

		$data_id = $data['data'][0]['id'];
		// $data_title = $data['data'][0]['title'];
		// $data_started = $data['data'][0]['started_at'];
		// $data_game_id = $data['data'][0]['game_id'];
		// $data_username = $data['data'][0]['user_name'];

		$this->data_cache = $data;

		if( !$data_id ){

			$this->end( $data );

		}else{

			$basename = $this->basename( $data );
			
			if( file_exists('vods/' . $basename . '.json') ){

				if( !file_exists('vods/' . $basename . '.ts') ){

					$this->notify($basename, 'VOD JSON EXISTS BUT NOT VIDEO', self::NOTIFY_ERROR);

					$this->download( $data );

				}else{

					$this->updateGame( $data );

				}

			}else{

				$this->download( $data );

			}

		}

	}

	public function getGameName( $id ){

		global $TwitchConfig;

		if( $id == 0 ){
			$this->errors[] = 'Game ID is 0';
			return false;
		}

		$game_db = json_decode( file_get_contents( 'games.json' ), true );

		if( $game_db[ $id ] ){
			$this->errors[] = 'Game is in database';
			return $game_db[ $id ];
		}

		$ch = curl_init();
		curl_setopt($ch, CURLOPT_URL, 'https://api.twitch.tv/helix/games?id=' . $id);
		curl_setopt($ch, CURLOPT_HTTPHEADER, [
			'Authorization: Bearer ' . TwitchHelper::getAccessToken(),
		    'Client-ID: ' . $TwitchConfig->cfg('api_client_id')
		]);

		curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);

		$server_output = curl_exec($ch);

		curl_close ($ch);

		$json = json_decode( $server_output, true );

		if( $json["data"][0] ){

			$game_db[ $id ] = $json["data"][0]["name"];

			file_put_contents( 'games.json', json_encode( $game_db ) );

			return $json["data"][0]["name"];

		}

		$this->errors[] = 'No game found for ' . $id;

		TwitchHelper::log("Couldn't match game for " . $id . " | " . $server_output );

		return false;

		// print_r($server_output);
		// print_r($info);

	}

	public function parseTwitchDuration( $text ){

		preg_match('/([0-9]+)h/', $text, $hours_match);
		preg_match('/([0-9]+)m/', $text, $minutes_match);
		preg_match('/([0-9]+)s/', $text, $seconds_match);

		$total_seconds = 0;

		if($seconds_match[1]) $total_seconds += $seconds_match[1];
		if($minutes_match[1]) $total_seconds += $minutes_match[1] * 60;
		if($hours_match[1]) $total_seconds += $hours_match[1] * 60 * 60;

		return $total_seconds;

	}

	public function updateGame( $data ){

		$data_id 			= $data['data'][0]['id'];
		$data_started 		= $data['data'][0]['started_at'];
		$data_game_id 		= $data['data'][0]['game_id'];
		$data_username 		= $data['data'][0]['user_name'];
		$data_viewer_count 	= $data['data'][0]['viewer_count'];
		$data_title 		= $data['data'][0]['title'];

		$basename = $this->basename( $data );

		// file_put_contents( 'vods/' . $basename . '.vod', "\n" . time() . ':' . $data_game_id, FILE_APPEND );

		$this->jsonLoad();

		// json format
	
		// full json data
		$this->json['meta'] = $data;
		
		// full datetime-stamp of stream start
		$this->json['started_at'] = $data_started;
		
		if(!$this->json['games']){
			$this->json['games'] = [];
		}

		// fetch game name from either cache or twitch
		$game_name = $this->getGameName( $data_game_id );

		// game structure
		$this->json['games'][] = [
			'time' 			=> $this->getDateTime(),
			'game_id' 		=> $data_game_id,
			'game_name'		=> $game_name,
			'viewer_count' 	=> $data_viewer_count,
			'title'			=> $data_title
		];

		$this->jsonSave();

		// file_put_contents( 'vods/' . $basename . '.json', json_encode( $json ) );
		
		//$game_name = $this->games[$data_game_id] ?: $data_game_id;

		$this->notify('', '[' . $data_username . '] [game update: ' . $game_name . ']', self::NOTIFY_GAMECHANGE);

		TwitchHelper::log("Game updated on " . $data_username . " to " . $game_name);

	}

	public function end(){

		$this->notify('', '[stream end]', self::NOTIFY_DOWNLOAD);

	}

	public function download( $data, $tries = 0 ){

		global $TwitchConfig;

		$data_id = $data['data'][0]['id'];
		$data_title = $data['data'][0]['title'];
		$data_started = $data['data'][0]['started_at'];
		$data_game_id = $data['data'][0]['game_id'];
		$data_username = $data['data'][0]['user_name'];

		if( !$data_id ){
			$this->errors[] = 'No data id for download';
			$this->notify($data, 'NO DATA SUPPLIED FOR DOWNLOAD, TRY #' . $tries, self::NOTIFY_ERROR);
			throw new Exception('No data supplied');
			return;
		}

		// $this->notify('', '[' . $data_username . '] [prepare download]');

		$stream_url = 'twitch.tv/' . $data_username;

		$basename = $this->basename( $data );

		// check matched title
		if( $this->stream_match[ $data_username ] ){

			$match = false;

			$this->notify($basename, 'Check matches for user ' . json_encode( $this->stream_match[ $data_username ] ), self::NOTIFY_GENERIC);

			foreach( $this->stream_match[ $data_username ] as $m ){
				if( strpos( strtolower($data_title), $m ) !== false ){
					$match = true;
					break;
				}
			}

			if(!$match){
				$this->notify($basename, 'Cancel download because stream title does not contain keywords', self::NOTIFY_GENERIC);
				return;
			}

		}

		// in progress
		$this->updateGame( $data );

		// download notification
		$this->notify($basename, '[' . $data_username . '] [download]', self::NOTIFY_DOWNLOAD);

		/*
		$capture_filename = 'vods/' . $basename . '.ts';

		$cmd = 'streamlink --hls-live-restart --hls-live-edge 99999 --hls-segment-threads 5 --twitch-disable-hosting -o ' . escapeshellarg($capture_filename) . ' ' . $stream_url . ' ' . escapeshellarg($this->stream_quality);

		$output_download = exec( $cmd );
		*/
	
		// capture with streamlink
		$capture_filename = $this->capture( $data );

		// error handling if nothing got downloaded
		if( !file_exists( $capture_filename ) ){

			if( $tries >= $TwitchConfig->cfg('download_retries') ){
				$this->errors[] = 'Giving up on downloading, too many tries';
				$this->notify($basename, 'GIVING UP, TOO MANY TRIES', self::NOTIFY_ERROR);
				// unlink( 'vods/' . $basename . '.json' );
				rename( 'vods/' . $basename . '.json', 'vods/' . $basename . '.json.broken' );
				throw new Exception('Too many tries');
				return;
			}

			$this->errors[] = 'Error when downloading, retrying';

			$this->info[] = 'Capture name: ' . $capture_filename;

			// $this->errors[] = $cmd;

			$this->notify($basename, 'MISSING DOWNLOAD, TRYING AGAIN (#' . $tries . ')', self::NOTIFY_ERROR);

			sleep(15);

			$this->download( $data, $tries + 1 );

			return;

		}

		// timestamp
		$this->jsonLoad();
		$this->json['ended_at'] = $this->getDateTime();
		$this->jsonSave();

		sleep(60);



		// convert notify
		$this->notify($basename, '[' . $data_username . '] [convert]', self::NOTIFY_DOWNLOAD);
		
		// convert with ffmpeg
		$converted_filename = $this->convert( $basename );

		sleep(10);

		

		// $id3_data = $getID3->analyze($converted_filename);

		// remove ts if both files exist
		if( file_exists( $capture_filename ) && file_exists( $converted_filename ) ){

			$getID3 = new getID3;

			$id3_data = null;

			try {
				$id3_data = $getID3->analyze($converted_filename);
			} catch (Exception $e) {
				$this->notify($basename, 'Error with id3 analyzer' . $e, self::NOTIFY_ERROR);
			}

			if( !$id3_data || !$id3_data['playtime_string'] ){

				$this->errors[] = 'Missing mp4 length';

				$this->notify($basename, 'MISSING MP4 LENGTH', self::NOTIFY_ERROR);

			}else{

				unlink( $capture_filename );

			}

		}else{

			$this->errors[] = 'Video files are missing';

			$this->notify($basename, 'MISSING FILES', self::NOTIFY_ERROR);

		}

		$this->jsonLoad();
		if(!$this->json['segments']) $this->json['segments'] = [];
		$this->json['segments'][] = $converted_filename;
		$this->jsonSave();

		$this->cleanup( $data_username );

		$this->notify($basename, '[' . $data_username . '] [end]', self::NOTIFY_DOWNLOAD);

		/*

		sleep(60 * 5);
		$this->matchTwitchVod();
		$this->downloadChat();
		 */

	}

	public function capture( $data ){

		global $TwitchConfig;

		$data_id = $data['data'][0]['id'];
		$data_title = $data['data'][0]['title'];
		$data_started = $data['data'][0]['started_at'];
		$data_game_id = $data['data'][0]['game_id'];
		$data_username = $data['data'][0]['user_name'];

		if(!$data_id){
			$this->errors[] = 'ID not supplied for capture';
			return false;
		}
		
		$stream_url = 'twitch.tv/' . $data_username;

		$basename = $this->basename( $data );

		$capture_filename = 'vods/' . $basename . '.ts';

		$cmd = $TwitchConfig->cfg('bin_dir') . '/streamlink';
		$cmd .= ' --hls-live-restart'; // start recording from start of stream, though twitch doesn't support this
		$cmd .= ' --hls-live-edge 99999';
		$cmd .= ' --hls-segment-threads 5';
		$cmd .= ' --twitch-disable-hosting'; // disable channel hosting
		$cmd .= ' -o ' . escapeshellarg($capture_filename); // output file
		$cmd .= ' ' . escapeshellarg($stream_url) . ' ' . escapeshellarg( $TwitchConfig->cfg('stream_quality') ); // twitch url and quality

		$this->info[] = 'Streamlink cmd: ' . $cmd;
		
		$capture_output = shell_exec( $cmd );

		$this->info[] = 'Streamlink output: ' . $capture_output;

		// download with youtube-dl if streamlink fails
		if( strpos($capture_output, '410 Client Error') !== false ){
			
			$this->notify($basename, '410 Error', self::NOTIFY_ERROR);
			// return false;
			
			$cmd = $TwitchConfig->cfg('bin_dir') . '/youtube-dl';
			$cmd .= ' --hls-use-mpegts'; // use ts instead of mp4
			$cmd .= ' --no-part';
			$cmd .= ' -o ' . escapeshellarg($capture_filename); // output file
			$cmd .= ' -f ' . escapeshellarg( implode('/', explode(',', $TwitchConfig->cfg('stream_quality') ) ) ); // format
			$cmd .= ' ' . escapeshellarg($stream_url);

			$this->info[] = 'Youtube-dl cmd: ' . $cmd;

			$capture_output = shell_exec( $cmd );

			$this->info[] = 'Youtube-dl output: ' . $capture_output;

			// exit(500);
		} 

		return $capture_filename;

	}

	/**
	 * Mux .ts to .mp4, for better compatibility
	 */
	public function convert( $basename ){

		global $TwitchConfig;

		$capture_filename 	= 'vods/' . $basename . '.ts';

		$converted_filename = 'vods/' . $basename . '.mp4';

		$int = 1;

		while( file_exists( $converted_filename ) ){
			$this->errors[] = 'File exists, making a new name';
			$converted_filename = 'vods/' . $basename . '-' . $int . '.mp4';
			$int++;
		}

		$cmd = $TwitchConfig->cfg('ffmpeg_path');
		$cmd .= ' -i ' . escapeshellarg($capture_filename);
		$cmd .= ' -codec copy'; // use same codec
		$cmd .= ' -bsf:a aac_adtstoasc'; // fix audio sync in ts
		$cmd .= ' ' . escapeshellarg($converted_filename);
		
		$this->info[] = 'ffmpeg cmd: ' . $cmd;

		$output_convert = shell_exec( $cmd );

		$this->info[] = 'ffmpeg output: ' . $output_convert;
		
		return $converted_filename;

	}

	public function sub( $streamer_name ){

		global $TwitchConfig;

		/**
		 * TODO: Fix this
		 */
		/*
		 if( !$TwitchConfig->getStreamers()[$streamer_name] ) {
			$this->notify('Streamer not found: ' . $streamer_name, '[' . $streamer_name . '] [subscribing error]', self::NOTIFY_ERROR);
			throw new Exception('Streamer not found: ' . $streamer_name);
			return false;
		}
		*/

		$streamer_id = TwitchHelper::getChannelId($streamer_name);

		if( !$streamer_id ) {
			$this->notify('Streamer ID not found for: ' . $streamer_name, '[' . $streamer_name . '] [subscribing error]', self::NOTIFY_ERROR);
			throw new Exception('Streamer ID not found for: ' . $streamer_name);
			return false;
		}

		$url = 'https://api.twitch.tv/helix/webhooks/hub';
		$method = 'POST';

		$data = [
			'hub.callback' => $TwitchConfig->cfg('hook_callback'),
			'hub.mode' => 'subscribe',
			'hub.topic' => 'https://api.twitch.tv/helix/streams?user_id=' . $streamer_id,
			'hub.lease_seconds' => $TwitchConfig->cfg('sub_lease')
		];

		print_r( $data );

		$data_string = json_encode($data);

		$ch = curl_init();
		curl_setopt($ch, CURLOPT_URL, $url);
		curl_setopt($ch, CURLOPT_POST, 1);
		curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "POST");
		curl_setopt($ch, CURLOPT_POSTFIELDS, $data_string);
		curl_setopt($ch, CURLOPT_HTTPHEADER, [
		    'Content-Type: application/json',
			'Content-Length: ' . strlen($data_string),
			'Authorization: Bearer ' . TwitchHelper::getAccessToken(),
		    'Client-ID: ' . $TwitchConfig->cfg('api_client_id')
		]);

		// curl_setopt($ch, CURLOPT_HEADER, TRUE);
		// curl_setopt($ch, CURLOPT_NOBODY, TRUE); // remove body
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);

		$server_output = curl_exec ($ch);
		$info = curl_getinfo($ch);

		curl_close ($ch);

		print_r($server_output);
		print_r($info);

		$this->notify($server_output, '[' . $streamer_name . '] [subscribing]', self::NOTIFY_GENERIC);

	}

	public function getSubs(){

		global $TwitchConfig;

		$access_token = TwitchHelper::getAccessToken();

		// webhook list
		$ch = curl_init();
		curl_setopt($ch, CURLOPT_URL, 'https://api.twitch.tv/helix/webhooks/subscriptions');
		curl_setopt($ch, CURLOPT_HTTPHEADER, [
			'Authorization: Bearer ' . $access_token,
			'Authorization: Bearer ' . TwitchHelper::getAccessToken(),
		    'Client-ID: ' . $TwitchConfig->cfg('api_client_id')
		]);
		
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);

		$server_output = curl_exec($ch);

		curl_close ($ch);

		$json = json_decode( $server_output, true );

		return $json;

	}

}
