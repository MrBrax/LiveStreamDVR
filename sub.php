<?php

include "class.php";

$TwitchAutomator = new TwitchAutomator();

foreach( TwitchConfig::$streamers as $s ){

	echo '<strong>Subbing to ' . $s . '...</strong>';

	echo '<pre>';
	$TwitchAutomator->sub( $s );

	echo '</pre>';

	echo '<hr />';

	sleep(2);

}
