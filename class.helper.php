<?php

class TwitchHelper {

	public static $accessToken;

	public static $accessTokenFile = 'config/oauth.bin';

	const LOG_ERROR = "ERROR";
	const LOG_WARNING = "WARNING";
	const LOG_INFO = "INFO";
	const LOG_DEBUG = "DEBUG";

	public static function setupDirectories(){
		mkdir("logs");
		mkdir("payloads");
		mkdir("vods");
		mkdir("vods/clips");
		mkdir("vods/saved");
	}

	public static function getAccessToken( $force = false ){

		if( !$force && file_exists( self::$accessTokenFile ) ){
			self::log( self::LOG_INFO, "Fetched access token from cache");
			return file_get_contents( self::$accessTokenFile );
		}

		// oauth2
		$ch = curl_init();
		curl_setopt($ch, CURLOPT_URL, 'https://id.twitch.tv/oauth2/token?client_id=' . TwitchConfig::cfg('api_client_id') . '&client_secret=' . TwitchConfig::cfg('api_secret') . '&grant_type=client_credentials');
		curl_setopt($ch, CURLOPT_HTTPHEADER, [
			'Client-ID: ' . TwitchConfig::cfg('api_client_id')
		]);
		curl_setopt($ch, CURLOPT_POST, 1);
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);

		$server_output = curl_exec($ch);

		curl_close ($ch);

		$json = json_decode( $server_output, true );

		if(!$json['access_token']){
			self::log( TwitchHelper::LOG_ERROR, "Failed to fetch access token: " . $server_output);
			return false;
		}

		$access_token = $json['access_token'];

		self::$accessToken = $access_token;

		file_put_contents( self::$accessTokenFile, $access_token );

		self::log( TwitchHelper::LOG_INFO, "Fetched new access token");

		return $access_token;

	}
	
	/**
	 * Log a string to the current log file
	 *
	 * @param const $level
	 * @param string $text
	 * @return void
	 */
	public static function log( $level, $text ){

		if( !TwitchConfig::cfg("debug") && $level == self::LOG_DEBUG ) return;
		
		$filename = "logs/" . date("Y-m-d") . ".log";
		
		$log_text = file_exists( $filename ) ? file_get_contents( $filename ) : '';

		// $text = date("Y-m-d H:i:s.v") . " | " . $text;

		$date = new DateTime();

		$text = $date->format("Y-m-d H:i:s.v") . " | <" . $level . "> " . $text;

		$log_text .= "\n" . $text;

		file_put_contents($filename, $log_text);
		
	}

	public static function getChannelId( $username ){

		$json_streamers = json_decode( file_get_contents('config/streamers.json'), true );

		if($json_streamers[$username]){
			self::log( self::LOG_INFO, "Fetched channel id from cache for " . $username);	
			return $json_streamers[$username];
		}

		$access_token = self::getAccessToken();

		// webhook list
		$ch = curl_init();
		curl_setopt($ch, CURLOPT_URL, 'https://api.twitch.tv/helix/users?login=' . $username);
		curl_setopt($ch, CURLOPT_HTTPHEADER, [
		    'Authorization: Bearer ' . $access_token,
		    'Client-ID: ' . TwitchConfig::cfg('api_client_id')
		]);
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);

		$server_output = curl_exec($ch);

		curl_close ($ch);

		$json = json_decode( $server_output, true );

		if( !$json["data"] ){
			self::log(self::LOG_ERROR, "Failed to fetch channel id: " . $server_output);
			return false;
		}

		$id = $json["data"][0]["id"];
		
		$json_streamers[ $username ] = $id;
		file_put_contents('config/streamers.json', json_encode($json_streamers));

		self::log( self::LOG_INFO, "Fetched channel id online for " . $username);

		return $id;

	}

	public static function getVideos( $streamer_id ){

		$ch = curl_init();
		curl_setopt($ch, CURLOPT_URL, 'https://api.twitch.tv/helix/videos?user_id=' . $streamer_id);
		curl_setopt($ch, CURLOPT_HTTPHEADER, [
			'Authorization: Bearer ' . self::getAccessToken(),
		    'Client-ID: ' . TwitchConfig::cfg('api_client_id')
		]);

		curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);

		$server_output = curl_exec($ch);

		curl_close($ch);

		// return $server_output;

		$json = json_decode( $server_output, true );

		if( !$json['data'] ){
			self::log( self::LOG_ERROR, "No videos found for user id " . $streamer_id);
			return false;
		}

		self::log( self::LOG_INFO, "Querying videos for streamer id " . $streamer_id);

		return $json['data'] ?: false;

		// print_r($server_output);
		// print_r($info);

	}

	public static function getVideo( $video_id ){

		$ch = curl_init();
		curl_setopt($ch, CURLOPT_URL, 'https://api.twitch.tv/helix/videos?id=' . $video_id);
		curl_setopt($ch, CURLOPT_HTTPHEADER, [
			'Authorization: Bearer ' . self::getAccessToken(),
		    'Client-ID: ' . TwitchConfig::cfg('api_client_id')
		]);

		curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);

		$server_output = curl_exec($ch);

		curl_close($ch);

		// return $server_output;

		$json = json_decode( $server_output, true );

		if( !$json['data'] ){
			self::log( self::LOG_ERROR, "No video found for video id " . $video_id);
			return null;
		}

		self::log( self::LOG_INFO, "Querying video info for id " . $video_id);

		return $json['data'][0];

		// print_r($server_output);
		// print_r($info);

	}

}
