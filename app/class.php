<?php

// not a good idea, whatever
// error_reporting(E_ERROR | E_PARSE);
ini_set('memory_limit','1024M');

require __DIR__ . '/../vendor/autoload.php';

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

require __DIR__ . "/class.helper.php";
require __DIR__ . "/class.config.php";
require __DIR__ . "/class.vod.php";
require __DIR__ . "/class.automator.php";

// make directories
if( !file_exists( __DIR__ . DIRECTORY_SEPARATOR . "public" . DIRECTORY_SEPARATOR . "vods" . DIRECTORY_SEPARATOR . "saved" ) ){
	TwitchHelper::setupDirectories();
}