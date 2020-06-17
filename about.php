<?php

include "class.php";

echo '<strong>FFMpeg:</strong> ';
if( file_exists( TwitchConfig::cfg("ffmpeg_path") ) ){
    $out = shell_exec( TwitchConfig::cfg("ffmpeg_path") . " -version");
    $out = explode("\n", $out)[0];
    echo $out;
}else{
    echo 'Not installed';
}

echo '<br><strong>Twitch chat downloader:</strong> ';
if( file_exists( TwitchConfig::cfg('bin_dir') . "/tcd") ){
    $out = shell_exec( TwitchConfig::cfg('bin_dir') . "/tcd --version");
    echo $out;
}else{
    echo 'Not installed';
}

echo '<br><strong>Streamlink:</strong> ';
if( file_exists( TwitchConfig::cfg('bin_dir') . "/streamlink") ){
    $out = shell_exec( TwitchConfig::cfg('bin_dir') . "/streamlink --version");
    echo $out;
}else{
    echo 'Not installed';
}

echo '<br><strong>youtube-dl:</strong> ';
if( file_exists( TwitchConfig::cfg('bin_dir') . "/youtube-dl") ){
    $out = shell_exec( TwitchConfig::cfg('bin_dir') . "/youtube-dl --version");
    echo $out;
}else{
    echo 'Not installed';
}

echo '<br><strong>Pipenv:</strong> ';
if( file_exists( TwitchConfig::cfg('bin_dir') . "/pipenv") ){
    $out = shell_exec( TwitchConfig::cfg('bin_dir') . "/pipenv --version");
    echo $out;
}else{
    echo 'Not installed';
}