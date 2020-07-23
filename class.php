<?php

// not a good idea, whatever
error_reporting(E_ERROR | E_PARSE);
ini_set('memory_limit','1024M');

require __DIR__ . '/vendor/autoload.php';

function getNiceDuration($durationInSeconds) {

	$duration = '';
	$days = floor($durationInSeconds / 86400);
	$durationInSeconds -= $days * 86400;
	$hours = floor($durationInSeconds / 3600);
	$durationInSeconds -= $hours * 3600;
	$minutes = floor($durationInSeconds / 60);
	$seconds = $durationInSeconds - $minutes * 60;
  
	if($days > 0) {
	  $duration .= $days . 'd';
	}
	if($hours > 0) {
	  $duration .= ' ' . $hours . 'h';
	}
	if($minutes > 0) {
	  $duration .= ' ' . $minutes . 'm';
	}
	if($seconds > 0) {
	  $duration .= ' ' . $seconds . 's';
	}
	return trim($duration);
}

require "class.helper.php";
require "class.config.php";
require "class.vod.php";
require "class.automator.php";

// make directories
if( !file_exists( "vods" . DIRECTORY_SEPARATOR . "saved" ) ){
	TwitchHelper::setupDirectories();
}