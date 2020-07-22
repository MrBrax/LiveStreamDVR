<?php

class TwitchConfig {

	public static $config = [];

	function __constructor(){
		$this->loadConfig();
	}

	public static function cfg( $var, $def = null ){
		return self::$config[$var] ?: $def;
	}

	public static function loadConfig(){
		
		$config = json_decode( file_get_contents("config/config.json"), true );

		if( $config['app_name'] ){
			self::$config = $config;
		}else{
			die("Config is empty, please create config/config.json");
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

if( !is_dir( TwitchConfig::cfg("bin_dir") ) ) die("bin_dir is not set to a directory");
if( !file_exists( TwitchConfig::cfg("ffmpeg_path") ) ) die("ffmpeg_path is not valid");
if( is_dir( TwitchConfig::cfg("ffmpeg_path") ) ) die("ffmpeg_path is set to a directory, not an executable");
/*
$TwitchConfig = new TwitchConfig();
TwitchConfig::loadConfig();
*/