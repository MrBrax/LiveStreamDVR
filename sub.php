<?php

include "class.php";

$TwitchAutomator = new TwitchAutomator();

echo '<h1>Subbing...</h1>';

$streamers = $TwitchConfig->getStreamers();

foreach( $streamers as $k => $v ){

	$username = $v['username'];

	echo '<strong>Subbing to ' . $username . '...</strong>';

	echo '<pre>';
	$TwitchAutomator->sub( $username );

	echo '</pre>';

	echo '<hr />';

	sleep(2);

}

if( count($streamers) == 0 ) echo 'No channels to subscribe to';

var_dump( $TwitchConfig->$config );

var_dump( $TwitchConfig->config );