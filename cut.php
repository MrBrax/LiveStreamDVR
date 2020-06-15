<?php

include "config.php";

$TwitchAutomator = new TwitchAutomator();

$vod = mb_ereg_replace("([^\w\s\d\-_~,;\[\]\(\).])", '', $_GET['vod']);

$json = json_decode( file_get_contents( $TwitchConfig->cfg('vod_folder') . '/' . $vod . '.json'), true );

$second_start = (int)$_GET['start'];
$second_end = (int)$_GET['end'];

$filename_in = $TwitchConfig->cfg('vod_folder') . '/' . $vod . '.mp4';
$filename_out = $TwitchConfig->cfg('vod_folder') . '/' . $vod . '-cut-' . $second_start . '-' . $second_end . '.mp4';

$cmd = $TwitchConfig->cfg('ffmpeg_path');
$cmd .= ' -i ' . escapeshellarg( $filename_in );
$cmd .= ' -ss ' . escapeshellarg( $second_start );
$cmd .= ' -t ' . escapeshellarg( $second_end - $second_start );
$cmd .= ' -codec copy';
$cmd .= ' ' . escapeshellarg($filename_out);

echo $cmd;

echo shell_exec($cmd);

echo 'done';