<?php

require( __DIR__ . "/../app/class.php");

$TwitchAutomator = new TwitchAutomator();

var_dump( $TwitchAutomator->getSubs() );