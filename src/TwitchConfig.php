<?php

namespace App;

class TwitchConfig {

	public static $config = [];

	public static $configPath = __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "config" . DIRECTORY_SEPARATOR . "config.json";
	public static $gameDbPath = __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "cache" . DIRECTORY_SEPARATOR . "games_v2.json";

	public static $settingsFields = [
		[ 'key' => 'bin_dir', 				'text' => 'Python binary directory', 														'type' => 'string', 'required' => true ],
		[ 'key' => 'ffmpeg_path', 			'text' => 'FFmpeg path', 																	'type' => 'string', 'required' => true ],
		[ 'key' => 'mediainfo_path', 		'text' => 'Mediainfo path', 																'type' => 'string', 'required' => true ],
		[ 'key' => 'twitchdownloader_path', 'text' => 'TwitchDownloaderCLI path', 														'type' => 'string' ],

		[ 'key' => 'basepath', 				'text' => 'Base path (for reverse proxy etc)', 												'type' => 'string' ],
		[ 'key' => 'password', 				'text' => 'Password (keep blank for none) - username is admin', 							'type' => 'string' ],
		[ 'key' => 'storage_per_streamer', 	'text' => 'Gigabytes of storage per streamer', 												'type' => 'number', 'default' => 100 ],
		[ 'key' => 'hls_timeout', 			'text' => 'HLS Timeout in seconds (ads)', 													'type' => 'number', 'default' => 200 ],
		[ 'key' => 'vods_to_keep', 			'text' => 'VODs to keep per streamer', 														'type' => 'number', 'default' => 5 ],
		[ 'key' => 'api_client_id', 		'text' => 'Twitch client ID', 																'type' => 'string', 'required' => true ],
		[ 'key' => 'api_secret', 			'text' => 'Twitch secret (keep blank to not change)', 										'type' => 'string', 'secret' => true, 'required' => true ],
		[ 'key' => 'hook_callback', 		'text' => 'Hook callback', 																	'type' => 'string', 'required' => true ],
		
		[ 'key' => 'vod_container', 		'text' => 'VOD container (not tested)', 													'type' => 'array', 'choices' => ['mp4', 'mkv', 'mov'], 'default' => 'mp4' ],

		[ 'key' => 'burn_preset', 			'text' => 'Burning h264 preset', 															'type' => 'array', 'choices' => ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow', 'placebo'], 'default' => 'slow' ],
		[ 'key' => 'burn_crf', 				'text' => 'Burning h264 crf', 																'type' => 'number', 'default' => 26 ],

		[ 'key' => 'disable_ads', 			'text' => 'Try to remove ads from captured file',											'type' => 'boolean' ],
		[ 'key' => 'debug', 				'text' => 'Debug', 																			'type' => 'boolean' ],
		[ 'key' => 'app_verbose', 			'text' => 'Verbose app output', 															'type' => 'boolean' ],
		[ 'key' => 'channel_folders', 		'text' => 'Channel folders', 																'type' => 'boolean' ],
		[ 'key' => 'chat_compress', 		'text' => 'Compress chat with gzip (untested)', 											'type' => 'boolean' ],
		[ 'key' => 'relative_time', 		'text' => 'Relative time', 																	'type' => 'boolean' ],
		[ 'key' => 'low_latency', 			'text' => 'Low latency (untested)', 														'type' => 'boolean' ],
	];

	function __constructor(){
		$this->loadConfig();
	}

	public static function cfg( $var, $def = null ){
		if( !isset(self::$config[$var]) ) return $def;
		return self::$config[$var] ?: $def;
	}

	/** @deprecated 3.2.0 */
	public static function path( $parts ){
		return join(DIRECTORY_SEPARATOR, $parts);
	}

	public static function loadConfig(){

		if( !file_exists( self::$configPath) ){
			self::generateConfig();
		}
		
		$config = json_decode( file_get_contents( self::$configPath ), true );

		if( $config['app_name'] ){
			$config['app_name'] = "TwitchAutomator";
			self::$config = $config;
		}else{
			die("Config is empty, please create " . TwitchHelper::get_absolute_path( self::$configPath ) . "<br>Example usage is in config.json.example" );
			// throw new Exception("Config is empty");
		}

		$t = self::getStreamers();
		$save = false;
		foreach($t as $i => $s){

			// fix quality string
			if( isset($s['quality']) && gettype($s['quality']) == "string"){
				TwitchHelper::log( TwitchHelper::LOG_WARNING, "Invalid quality setting on " . $s['username'] . ", fixing...");
				self::$config['streamers'][$i]['quality'] = explode(" ", self::$config['streamers'][$i]['quality']);
				$save = true;
			}

			// create subfolders
			if( self::cfg('channel_folders') && !file_exists( TwitchHelper::vod_folder( $s['username'] ) ) ){
				mkdir( TwitchHelper::vod_folder( $s['username'] ) );
			}

		}
		if($save){
			self::saveConfig("streamer quality fix");
		}

	}

	public static function saveConfig( $source = "unknown" ){

		if( !is_writable( self::$configPath ) ){
			TwitchHelper::log(TwitchHelper::LOG_FATAL, "Saving config failed, permissions issue?");
			// return false;
		}

		file_put_contents( self::$configPath, json_encode( self::$config, JSON_PRETTY_PRINT ) );

		TwitchHelper::log( TwitchHelper::LOG_SUCCESS, "Saved config from " . $source);

	}

	public static function generateConfig(){

		$example_file = __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "config" . DIRECTORY_SEPARATOR . "config.json.example";
		
		if( !file_exists($example_file) ){
			die("No example config found");
		}

		$example = json_decode( file_get_contents( $example_file ), true );

		self::$config = $example;
		self::saveConfig();

	}

	public static function getStreamers(){
		return self::cfg("streamers", []);
	}
	
	/**
	 * Get streamer info from local config
	 *
	 * @param string $username
	 * @return array|false
	 */
    public static function getStreamer( $username, $lowercase = false ){
        $streamers = self::getStreamers();
        foreach( $streamers as $s ){
			if( $lowercase && strtolower($s['username']) == strtolower($username) ) return $s;
            if( $s['username'] == $username ) return $s;
        }
        return false;
	}

	public static function getGames(){
		return json_decode( file_get_contents( self::$gameDbPath ), true );
    }

}

TwitchConfig::loadConfig();

if( !TwitchConfig::cfg('bin_dir') ){
	TwitchHelper::find_bin_dir();
}

/*
if( !TwitchConfig::cfg("api_client_id") ) die("api_client_id missing from config file");
if( !TwitchConfig::cfg("api_secret") ) die("api_secret missing from config file");

if( !is_dir( TwitchConfig::cfg("bin_dir") ) ) die("bin_dir is not set to a python scripts directory");

if( !file_exists( TwitchHelper::path_ffmpeg() ) ){
	die("ffmpeg_path is not set to the executable");
}
if( is_dir( TwitchHelper::path_ffmpeg() ) ){
	die("ffmpeg_path is set to a directory, not an executable");
}
*/