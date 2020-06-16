<?php

class TwitchConfig {

	public $config = [];

	public function loadConfig(){
		$config = json_decode( file_get_contents("config/config.json"), true );

		if( $config['app_name'] ){
			$this->config = $config;
		}else{
			die("Config is empty, please create config/config.json");
			// throw new Exception("Config is empty");
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