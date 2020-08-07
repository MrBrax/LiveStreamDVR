<?php

class TwitchConfig {

	public static $config = [];

	public static $configPath = __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "config" . DIRECTORY_SEPARATOR . "config.json";

	function __constructor(){
		$this->loadConfig();
	}

	public static function cfg( $var, $def = null ){
		return self::$config[$var] ?: $def;
	}

	public static function path( $parts ){
		return join(DIRECTORY_SEPARATOR, $parts);
	}

	public static function loadConfig(){
		
		$config = json_decode( file_get_contents( self::$configPath ), true );

		if( $config['app_name'] ){
			self::$config = $config;
		}else{
			die("Config is empty, please create " . self::$configPath );
			// throw new Exception("Config is empty");
		}
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
    public static function getStreamer( $username ){
        $streamers = self::getStreamers();
        foreach( $streamers as $s ){
            if( $s['username'] == $username ) return $s;
        }
        return false;
	}

}

TwitchConfig::loadConfig();

if( !TwitchConfig::cfg("api_client_id") ) die("api_client_id missing from config file");
if( !TwitchConfig::cfg("api_secret") ) die("api_secret missing from config file");

if( !is_dir( TwitchConfig::cfg("bin_dir") ) ) die("bin_dir is not set to a python scripts directory");

if( !file_exists( TwitchHelper::path_ffmpeg() ) ){
	die("ffmpeg_path is not set to the executable");
}
if( is_dir( TwitchHelper::path_ffmpeg() ) ){
	die("ffmpeg_path is set to a directory, not an executable");
}