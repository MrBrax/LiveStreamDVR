<?php

require( __DIR__ . "/../app/class.php");

$TwitchAutomator = new TwitchAutomator();

echo '<h1>Subbing...</h1>';

$streamers = TwitchConfig::getStreamers();

foreach( $streamers as $k => $v ){

	$username = $v['username'];

	echo '<strong>Subbing to ' . $username . '...</strong>';

	echo '<pre>';
	
	$ret = $TwitchAutomator->sub( $username );

	if( $ret === true ){
		echo "Subscribed";
	}else{
		echo $ret;
	}

	echo '</pre>';

	echo '<hr />';

	sleep(2);

}

if( count($streamers) == 0 ) echo 'No channels to subscribe to';
