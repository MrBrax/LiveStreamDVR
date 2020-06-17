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
    
    public static function getStreamer( $username ){
        $streamers = self::getStreamers();
        foreach( $streamers as $s ){
            if( $s['username'] == $username ) return $s;
        }
        return false;
	}

}

TwitchConfig::loadConfig();

/*
$TwitchConfig = new TwitchConfig();
TwitchConfig::loadConfig();
*/