<?php

require_once __DIR__ . '/../vendor/autoload.php';

// not a good idea, whatever
// error_reporting(E_ERROR | E_PARSE);
use App\TwitchHelper;

ini_set('memory_limit','1024M');

// make directories
// if( !file_exists( __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "public" . DIRECTORY_SEPARATOR . "vods" . DIRECTORY_SEPARATOR . "saved" ) ){

// }