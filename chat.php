<?php

include "config.php";

$TwitchAutomator = new TwitchAutomator();

$vod = mb_ereg_replace("([^\w\s\d\-_~,;\[\]\(\).])", '', $_GET['vod']);

$vodclass = new TwitchVod();
$vodclass->load( $TwitchConfig->cfg('vod_folder') . '/' . $vod . '.json');

// $json = json_decode( file_get_contents("vods/" . $vod . ".json"), true );

// $streamer = $json['meta']['data'][0]['user_name'];

// $started_at = DateTime::createFromFormat("Y-m-d\TH:i:s\Z", $json['started_at'] );

// $channel_videos = $TwitchAutomator->getVideos( $TwitchAutomator->getChannelId( $streamer ) );

/*
$vod_id = null;

foreach ($channel_videos as $vid) {
	$video_time = DateTime::createFromFormat("Y-m-d\TH:i:s\Z", $vid['created_at'] );

	if( abs( $started_at->getTimestamp() - $video_time->getTimestamp() ) < 300 ){
		echo '<div><strong>Video id:</strong> <a href="' . $vid['url'] . '" rel="nofollow" target="_blank">' . $vid['id'] . '</a></div>';
		echo $TwitchAutomator->parseTwitchDuration( $vid['duration'] );
		$vod_id = $vid['id'];
		break;
	}

}

*/

if( $vodclass->twitch_vod_id ){
	echo 'downloading: ';
	var_dump( $vodclass->downloadChat() );
}

echo 'done';