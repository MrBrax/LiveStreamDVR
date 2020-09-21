<?php

namespace App;

class TwitchConfig {

	public static $config = [];

	public static $configPath = __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "config" . DIRECTORY_SEPARATOR . "config.json";
	public static $gameDbPath = __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "cache" . DIRECTORY_SEPARATOR . "games_v2.json";

	function __constructor(){
		$this->loadConfig();
	}

	public static function cfg( $var, $def = null ){
		if( !isset(self::$config[$var]) ) return $def;
		return self::$config[$var] ?: $def;
	}

	public static function path( $parts ){
		return join(DIRECTORY_SEPARATOR, $parts);
	}

	public static function loadConfig(){

		if( !file_exists( self::$configPath) ){
			self::generateConfig();
		}
		
		$config = json_decode( file_get_contents( self::$configPath ), true );

		if( $config['app_name'] ){
			$config['app_name'] = "TwitchAutomator V3";
			self::$config = $config;
		}else{
			die("Config is empty, please create " . TwitchHelper::get_absolute_path( self::$configPath ) . "<br>Example usage is in config.json.example" );
			// throw new Exception("Config is empty");
		}

		$t = self::getStreamers();
		$save = false;
		foreach($t as $i => $s){
			if( isset($s['quality']) && gettype($s['quality']) == "string"){
				TwitchHelper::log( TwitchHelper::LOG_WARNING, "Invalid quality setting on " . $s['username'] . ", fixing...");
				self::$config['streamers'][$i]['quality'] = explode(" ", self::$config['streamers'][$i]['quality']);
				$save = true;
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