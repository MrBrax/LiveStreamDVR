<?php

include "class.php";

$TwitchAutomator = new TwitchAutomator();

$getID3 = new getID3;

if($_GET['save']){

	$vod = mb_ereg_replace("([^\w\s\d\-_~,;\[\]\(\).])", '', $_GET['save']);

	if( !file_exists( "vods/" . $vod . '.mp4' ) ) {
		echo "vod " . $vod . " not found";
		return;
	}

	rename("vods/" . $vod . ".mp4", "vods/saved/" . $vod . ".mp4");
	rename("vods/" . $vod . ".json", "vods/saved/" . $vod . ".json");

	echo "saved " . $vod;

	return;

}

if($_GET['delete']){

	$vod = mb_ereg_replace("([^\w\s\d\-_~,;\[\]\(\).])", '', $_GET['delete']);

	if( !file_exists( "vods/" . $vod . '.mp4' ) ) {
		echo "vod " . $vod . " not found";
		return;
	}

	unlink("vods/" . $vod . ".mp4");
	unlink("vods/" . $vod . ".json");

	echo "deleted " . $vod;

	return;

}

echo '<html>';
echo '<head>';
	echo '<title>' . $TwitchConfig->cfg('app_name') . '</title>';
	echo '<link href="style.css" rel="stylesheet" />';
echo '</head>';
echo '<body>';

echo '<header><h1>' . $TwitchConfig->cfg('app_name') . '</h1></header>';

echo '<div class="container">';

echo '<section class="section">';

	echo '<div class="section-title"><h1>Recorded VODs</h1></div>';

	echo '<div class="section-content">';

		echo '<a href="?checkvod=1">Check if VODs exist</a><br><br>';

		$total_size = 0;

		$streamerList = $TwitchConfig->getStreamers();

		foreach( $streamerList as $streamer ){

			$vods = glob("vods/" . $streamer['username'] . "_*.json");

			echo '<div class="streamer">';

				echo '<div class="streamer-title">';
					echo '<h2>' . $streamer['username'] . '</h2>';
					echo '<span class="small">';
						echo $streamer['quality'];
						echo ' &middot; ';
						echo sizeof( $vods ) . ' vods';
					echo '</span>';
				echo '</div>';

				if( count($vods) == 0 ){

					echo '<div class="notice">None</div>';

				}else{

					// $channel_videos = $TwitchAutomator->getVideos( $TwitchAutomator->getChannelId( $streamer ) );

					/*
					echo '<div><h2>Videos</h2>';
					print_r( $channel_videos );
					echo '</div>';
					*/

					foreach( $vods as $k => $v ){

						$vodclass = new TwitchVOD();
						$vodclass->load($v);

						$vodclass->saveLosslessCut();

						// var_dump($testvod);

						// $basename = substr($v, 0, strlen($v)-5);

						/*
						$json = json_decode( file_get_contents( $v ), true );

						if( $json['started_at'] ){
							$started_at = DateTime::createFromFormat("Y-m-d\TH:i:s\Z", $json['started_at'] );
						}

						if( $json['ended_at'] ){
							$ended_at = DateTime::createFromFormat("Y-m-d\TH:i:s\Z", $json['ended_at'] );
						}
						*/
						
						$recording = file_exists( $vodclass->basename . '.ts' );
						$converted = file_exists( $vodclass->basename . '.mp4' );

						echo '<div class="video ' . ($recording ? 'recording' : '') . '' . ($converted ? 'converted' : '') . '">';	
						
							echo '<div class="video-title"><h3>' . $vodclass->streamer_name . ' ' . $vodclass->started_at->format('Y-m-d H:i:s') . '</h3></div>';

							echo '<div class="video-description">';

								if($vodclass->started_at && $vodclass->ended_at){
									$diff = $vodclass->started_at->diff($vodclass->ended_at);
									echo '<div><strong>Approx. duration:</strong> ' . $diff->format('%H:%I:%S') . '</div>';
								}
								

								// if(!$json){
								// 	echo '<div class="error">No JSON content</div>';
								// }
								
								$vod_file = $vodclass->segments[0];

								if( file_exists( $vod_file ) ) {

									/*
									if($vodclass->duration){
										
										echo '<div><strong>Duration:</strong> ' . $vodclass->duration . '</div>';
									
									}else{
										
										$file = $getID3->analyze($basename . '.mp4');
										
										if( !$file['playtime_string'] ){

											echo '<div class="error"><strong>Error calculating duration</strong></div>';

											// var_dump( $file );

										}else{
											echo '<div><strong>Duration:</strong> ' . $file['playtime_string'] . '</div>';

											$json['duration'] = $file['playtime_string'];

											file_put_contents( $v, json_encode( $json ) );

										}

									}
									*/
									
									echo '<div><strong>Duration:</strong> ' . $vodclass->getDuration(true) . '</div>';

									$total_size += filesize( $vod_file );

									echo '<div><strong>Size:</strong> ' . round( filesize( $vod_file ) / 1024 / 1024 / 1024, 2 ) . 'GB</div>';

									echo '<div><strong>Video id:</strong> ';
									
									if( $vodclass->twitch_vod_url ){
										
										echo '<a href="' . $vodclass->twitch_vod_url . '" rel="nofollow" target="_blank">' . $vodclass->twitch_vod_id . '</a>';

										if( $_GET['checkvod'] ){
											echo $vodclass->checkValidVod() ? ' (exists)' : ' <strong class="error">(deleted)</strong>';
										}

									}else{
										echo '<strong><em>Not matched or VOD deleted</em></strong>';
									}

									echo '</div>';

									echo '<div><strong>Segments:</strong>';
									echo '<ul>';
									foreach ($vodclass->segments as $seg) {
										echo '<li>' . $seg . '</li>';
									}
									echo '</ul>';
									echo '</div>';

									if(!$vodclass->twitch_vod_id){
										$vodclass->matchTwitchVod();
										$vodclass->saveJSON();
									}
									
								}

								$ongoing_file = $vodclass->vod_path . '/' . $vodclass->basename . '.ts';

								if( file_exists( $ongoing_file ) ) {
									$total_size += filesize( $ongoing_file );
									echo '<div><strong>Ongoing size:</strong> ' . round( filesize( $ongoing_file ) / 1024 / 1024 / 1024, 2 ) . 'GB</div>';
								}

							echo '</div>';

							echo '<div class="video-controls">';

								if( file_exists( $vod_file ) ) {

									echo '<a class="button" href="player.php?vod=' . $vodclass->basename . '">Play video</a> ';

									echo '<a class="button" href="vods/' . $vodclass->basename . '.mp4">Direct link</a> ';

									echo '<a class="button" href="vods/' . $vodclass->basename . '.json">JSON</a> ';

									echo '<a class="button" href="?save=' . $vodclass->basename . '">Save from deletion</a> ';

									echo '<a class="button" href="?delete=' . $vodclass->basename . '">Delete</a> ';

									echo '<a class="button" href="chat.php?vod=' . $vodclass->basename . '">Download chat</a>';

								}else{

									if( $vodclass->ended_at ){
										echo '<a class="button" href="convert.php?vod=' . $vodclass->basename . '">Convert</a>';
									}

									echo '<em>Capturing...</em>';

								}

							echo '</div>';

							// echo '<br><br><a href="https://twitch.tv/videos/' . $json['meta']['data'][0]['id'] . '" rel="nofollow">Show on Twitch.tv</a>';

							// echo '<br /><br />';

							echo '<table class="game-list">';
							
								foreach ($vodclass->games as $d) {

									if( strlen( $d['time'] ) == 10 ){

										$game_time = new DateTime();
										$game_time->setTimestamp( $d['time'] );

									}else{

										$game_time = DateTime::createFromFormat("Y-m-d\TH:i:s\Z", $d['time'] );

									}

									echo '<tr>';
										
										// start timestamp
										echo '<td>';
										if( $vodclass->started_at ){
											$diff = $game_time->diff($vodclass->started_at);
											echo $diff->format('%H:%I:%S');
										}else{
											$game_time->format("Y-m-d H:i:s");
										}
										echo '</td>';

										echo '<td>';
										echo getNiceDuration($d['duration']);
										echo '</td>';

										// game name
										echo '<td>' . ( $d['game_name'] ?: $d['game_id'] ) . '</td>';

										// title
										echo '<td>' . $d['title'] . '</td>';

									echo '</tr>';

								}

								if($vodclass->ended_at){
									$diff = $vodclass->started_at->diff($vodclass->ended_at);
									echo '<tr><td>' . $diff->format('%H:%I:%S') . '</td><td colspan="2"><em>END</em></td></tr>';
								}else{

									$diff = $vodclass->started_at->diff( new DateTime() );

									echo '<tr><td>' . $diff->format('%H:%I:%S') . '</td><td colspan="2"><em><strong>ONGOING</strong></em></td></tr>';

								}

							echo '</table>';

						echo '</div>';

						// $started_at = null;
						// $ended_at = null;

					}

				}

			echo '</div>';

		}

		echo '<strong>Total size: ' . round($total_size / 1024 / 1024 / 1024, 2) . 'GB';

	echo "</div>";

echo '</section>';

// Saved vods
echo '<section class="section">';
	echo '<div class="section-title"><h1>Saved VODs</h1></div>';

	echo '<div class="section-content">';

	$vods = glob("vods/saved/*.json");

	foreach( $vods as $k => $v ){

		$basename = substr($v, 0, strlen($v)-5);

		$json = json_decode( file_get_contents( $v ), true );

		if( $json['started_at'] ){
			$started_at = DateTime::createFromFormat("Y-m-d\TH:i:s\Z", $json['started_at'] );
		}

		echo '<div class="video saved">';	
		echo '<h2>' . $json['started_at'] . '</h2>';

		if( file_exists( $basename . '.mp4' ) ) {

			echo round( filesize( $basename . '.mp4' ) / 1024 / 1024 / 1024, 2 ) . 'GB';

			echo '<hr>';

			echo '<a class="button" href="player.php?saved=' . basename($basename) . '">Play video</a>';

			echo '<a class="button" href="vods/saved/' . basename($basename) . '.mp4">Direct link</a>';

		}

		// echo '<br><br><a href="https://twitch.tv/videos/' . $json['meta']['data'][0]['id'] . '" rel="nofollow">Show on Twitch.tv</a>';

		echo '<br /><br />';

		echo '<table>';
		foreach ($json['games'] as $d) {

			if( strlen( $d['time'] ) == 10 ){

				$game_time = new DateTime();
				$game_time->setTimestamp( $d['time'] );

			}else{

				$game_time = DateTime::createFromFormat("Y-m-d\TH:i:s\Z", $d['time'] );

			}

			echo '<tr>';
				echo '<td>';

				if( $started_at ){
					$diff = $game_time->diff($started_at);
					echo $diff->format('%H:%I:%S');
				}else{
					$game_time->format("Y-m-d H:i:s");
				}

				echo '</td>';
				echo '<td>' . ( $d['game_name'] ?: $d['game_id'] ) . '</td>';
				echo '<td>' . $d['title'] . '</td>';
			echo '</tr>';

		}

		echo '</table>';

		echo '</div>';

		$started_at = null;

	}

	echo "</div>";

echo '</section>';	

echo '<section class="section">';

	echo '<div class="section-title"><h1>Hook</h1></div>';

	echo '<div class="section-content">';
	
	echo '<form method="post" action="hook.php">';
		echo '<textarea class="input" name="json"></textarea>';
		echo '<br><button class="button" type="submit">Hook</button>';
	echo '</form>';

	echo "</div>";

echo '</section>';

echo '</div>';

echo '</body>';
echo '</html>';