<?php

include "config.php";

$TwitchAutomator = new TwitchAutomator();

$vod = mb_ereg_replace("([^\w\s\d\-_~,;\[\]\(\).])", '', $_GET['vod']);

$json = json_decode( file_get_contents("vods/" . $vod . ".json"), true );

$second_start = (int)$_GET['start'];
$second_end = (int)$_GET['end'];

$filename_in = 'vods/' . $vod . '.mp4';
$filename_out = 'vods/' . $vod . '-cut-' . $second_start . '-' . $second_end . '.mp4';

$cmd = '/usr/bin/ffmpeg -i ' . escapeshellarg($filename_in) . ' -ss ' . escapeshellarg($second_start) . ' -t ' . escapeshellarg( $second_end - $second_start ) . ' -codec copy ' . escapeshellarg($filename_out) . '';

echo $cmd;

echo shell_exec($cmd);

echo 'done';