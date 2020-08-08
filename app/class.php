<?php

require_once __DIR__ . '/../vendor/autoload.php';

// not a good idea, whatever
// error_reporting(E_ERROR | E_PARSE);
use App\TwitchHelper;

ini_set('memory_limit','1024M');

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

// make directories
if( !file_exists( __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "public" . DIRECTORY_SEPARATOR . "vods" . DIRECTORY_SEPARATOR . "saved" ) ){
	TwitchHelper::setupDirectories();
}