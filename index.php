<?php

include "class.php";

TwitchHelper::log( TwitchHelper::LOG_DEBUG, "Index accessed");

$getID3 = new getID3;

if($_GET['save']){

	$vod = mb_ereg_replace("([^\w\s\d\-_~,;\[\]\(\).])", '', $_GET['save']);

	$vodclass = new TwitchVOD();
	$vodclass->load( TwitchConfig::cfg('vod_folder') . DIRECTORY_SEPARATOR . $vod . '.json' );
	$vodclass->save();

	echo "saved " . $vod;

	return;

}

if($_GET['delete']){

	$vod = mb_ereg_replace("([^\w\s\d\-_~,;\[\]\(\).])", '', $_GET['delete']);

	$vodclass = new TwitchVOD();
	$vodclass->load( TwitchConfig::cfg('vod_folder') . DIRECTORY_SEPARATOR . $vod . '.json' );
	$vodclass->delete();

	echo 'deleted ' . $vod;

	return;

}

$total_size = 0;

$streamerListStatic = TwitchConfig::getStreamers();
$streamerList = [];

$is_a_vod_deleted = false;

$checkvod = isset($_GET['checkvod']);

foreach( $streamerListStatic as $streamer ){

	$data = $streamer;

	$data['vods_raw'] = glob( TwitchConfig::cfg('vod_folder') . DIRECTORY_SEPARATOR . $streamer['username'] . "_*.json");
	
	$data['vods_list'] = [];

	$data['vods_size'] = 0;

	foreach( $data['vods_raw'] as $k => $v ){

		$vodclass = new TwitchVOD();
		$vodclass->load($v);

		if( $vodclass->is_recording ) $data['is_live'] = true;

		if( $checkvod && !$vodclass->is_recording ){
			$isvalid = $vodclass->checkValidVod();
			if(!$isvalid){
				$is_a_vod_deleted = true;
				echo '<!-- deleted: ' . $vodclass->basename . ' -->';
			}
		}

		if($vodclass->segments){
			foreach($vodclass->segments as $s){
				$data['vods_size'] += filesize( TwitchConfig::cfg('vod_folder') . DIRECTORY_SEPARATOR . basename($s) );
			}
		}
		
		$data['vods_list'][] = $vodclass;

	}

	$streamerList[] = $data;

}

echo '<!-- '; var_dump($streamerList); echo ' -->';



echo '<html>';
echo '<head>';
	echo ' <meta name="referrer" content="no-referrer" />';
	echo '<title>' . TwitchConfig::cfg('app_name') . '</title>';
	echo '<link href="style.css" rel="stylesheet" />';
echo '</head>';
echo '<body>';

echo '<div class="top-menu">';
	echo '<div class="top-menu-item title">' . TwitchConfig::cfg('app_name') . '</div>';
	foreach( $streamerList as $streamer ){
		echo '<div class="top-menu-item' . ( $streamer['is_live'] ? ' live' : '' ) . '">';
			
			if($streamer['is_live']){
				echo '<a href="#vod_' . $streamer['vods_list'][ count($streamer['vods_list']) - 1 ]->basename . '">';
			}else{
				echo '<a href="#streamer_' . $streamer['username'] . '">';
			}

				echo $streamer['username'];
				echo ' <span class="small">' . count($streamer['vods_list']) . '</span>';
			echo '</a>';

		echo '</div>';
	}
	echo '<div class="top-menu-item right">';
		echo '<a href="settings.php">Settings</a>';
		echo '<a href="about.php">About</a>';
		echo '<a class="linkback" href="https://github.com/MrBrax/TwitchAutomator" target="_blank" rel="noreferrer">GitHub</a>';
	echo '</div>';

echo '</div>';

echo '<div class="container">';

echo '<section class="section">';

	echo '<div class="section-title"><h1>Recorded VODs</h1></div>';

	echo '<div class="section-content">';

		echo '<a class="button" href="?checkvod=1">Check if VODs exist</a>';
		if($checkvod){
			if($is_a_vod_deleted){
				echo ' - <strong>A VOD IS DELETED</strong>';
			}else{
				echo ' - all vods seem to still exist';
			}
		}
		
		echo '<br><br>';

		foreach( $streamerList as $streamer ){

			echo '<div class="streamer">';

				echo '<div id="streamer_' . $streamer['username']  . '" class="anchor"></div>';

				echo '<div class="streamer-title">';
					echo '<h2>';
						echo '<a href="https://twitch.tv/' . $streamer['username'] . ' " rel="noreferrer" target="_blank">';
							echo $streamer['username'];
						echo '</a>';
						if( $streamer['is_live'] ){
							echo ' <span class="live">live</span>';
						}
					echo '</h2>';
					echo '<span class="small">';
						echo $streamer['quality'];
						echo ' &middot; ';
						echo count( $streamer['vods_list'] ) . ' vods';
						echo ' &middot; ';
						echo round( $streamer['vods_size'] / 1024 / 1024 / 1024, 1 ) . 'GB';
					echo '</span>';
				echo '</div>';

				if( count($streamer['vods_list']) == 0 ){

					echo '<div class="notice">None</div>';

				}else{
					
					foreach( $streamer['vods_list'] as $k => $vodclass ){

						/**
						 * @var \TwitchVOD $vodclass
						 */

						if( !$vodclass ){
							echo '<div class="error">Failed to load ' . $k . '</div>';
							continue;
						}

						echo '<div class="video ' . ($vodclass->is_recording ? 'recording' : '') . '' . ($vodclass->is_converted ? 'converted' : '') . '">';	

							echo '<div id="vod_' . $vodclass->basename . '" class="anchor"></div>';

							// title
							echo '<div class="video-title">';
								echo '<h3>';
									echo $vodclass->streamer_name;
									if( $vodclass->started_at ) echo ' ' . $vodclass->started_at->format('Y-m-d H:i:s');
								echo '</h3>';
							echo '</div>';

							// description
							echo '<div class="video-description">';

								// box art
								echo '<div class="boxart-carousel">';
									
									$unique_games = [];
									
									foreach($vodclass->games as $g){
										$unique_games[ (int)$g['game_id'] ] = true;
									}
									
									foreach($unique_games as $id => $n){
										$gd = TwitchHelper::getGame($id);
										$img_url = $gd['box_art_url'];
										$img_url = str_replace("{width}", 140, $img_url);
										$img_url = str_replace("{height}", 190, $img_url);
										echo '<img class="boxart-big" title="' . $gd['name'] . '" src="' . $img_url . '" />';
									}

								echo '</div>';
								
								// video info
								echo '<div><strong>Segment 0 info:</strong></div>';

								echo '<ul class="video-info">';

									if($vodclass->started_at && $vodclass->ended_at){
										$diff = $vodclass->started_at->diff($vodclass->ended_at);
										echo '<li><strong>Webhook duration:</strong> ' . $diff->format('%H:%I:%S') . '</li>';
									}
															
									$vod_file = TwitchConfig::cfg('vod_folder') . DIRECTORY_SEPARATOR . basename( $vodclass->segments[0] );

									if( count($vodclass->segments) > 0 && file_exists( $vod_file ) ) {
										
										echo '<li><strong>File duration:</strong> ' . TwitchHelper::printHumanDuration( $vodclass->getDuration(true) ) . '</li>';

										echo '<li>';
											
											echo '<strong>Twitch VOD duration:</strong> ';
											
											if( $vodclass->twitch_vod_duration ){
												
												echo TwitchHelper::printHumanDuration( $vodclass->twitch_vod_duration );

											}else{
												echo '<strong><em>No data</em></strong>';
											}

										echo '</li>';

										echo '<li>';
											
											echo '<strong>Missing from captured file:</strong> ';
											
											if( $vodclass->twitch_vod_duration ){
												
												echo TwitchHelper::printHumanDuration( $vodclass->twitch_vod_duration - $vodclass->getDuration(true) );

											}else{
												echo '<strong><em>No data</em></strong>';
											}

										echo '</li>';

										$total_size += filesize( $vod_file );

										echo '<li><strong>Size:</strong> ' . round( filesize( $vod_file ) / 1024 / 1024 / 1024, 2 ) . 'GB</li>';

										// TODO: merge this
										echo '<li>';
										
											echo '<strong>Twitch VOD id:</strong> ';
										
											if( $vodclass->twitch_vod_url ){
												
												echo '<a href="' . $vodclass->twitch_vod_url . '" rel="noreferrer" target="_blank">' . $vodclass->twitch_vod_id . '</a>';

												if( $checkvod ){
													echo $vodclass->twitch_vod_exists ? ' (exists)' : ' <strong class="error">(deleted)</strong>';
												}

											}else{
												echo '<strong><em>Not matched or VOD deleted</em></strong>';
											}

										echo '</li>';

										echo '<li>';
										
											echo '<strong>Twitch VOD date:</strong> ';
										
											if( $vodclass->twitch_vod_date ){
												echo $vodclass->twitch_vod_date;
											}else{
												echo '<strong><em>No data</em></strong>';
											}

										echo '</li>';

										echo '<li>';
											
											echo '<strong>Twitch VOD title:</strong> ';
											
											if( $vodclass->twitch_vod_title ){
												echo $vodclass->twitch_vod_title;
											}else{
												echo '<strong><em>No data</em></strong>';
											}

										echo '</li>';

										echo '<li><strong>Chat downloaded:</strong> ' . ( $vodclass->is_chat_downloaded ? 'Yes' : 'No' ) . '</li>';

										echo '</ul>';

										// segments
										echo '<strong>Segments:</strong>';
										echo '<ul>';
											foreach ($vodclass->segments as $seg) {
												echo '<li>';
													echo '<a href="' . TwitchConfig::cfg('vod_folder') . DIRECTORY_SEPARATOR . basename($seg) . '">';
														echo basename($seg);
														echo ' (' . round( filesize( TwitchConfig::cfg('vod_folder') . DIRECTORY_SEPARATOR . basename($seg) ) / 1024 / 1024 / 1024, 2 ) . ' GB)';
													echo '</a>';
												echo '</li>';
											}
										echo '</ul>';
										
										
									}

								$ongoing_file = $vodclass->vod_path . DIRECTORY_SEPARATOR . $vodclass->basename . '.ts';

								if( file_exists( $ongoing_file ) ) {
									$total_size += filesize( $ongoing_file );
									echo '<div><strong>Ongoing size:</strong> ' . round( filesize( $ongoing_file ) / 1024 / 1024 / 1024, 2 ) . 'GB</div>';
								}

							echo '</div>';

							echo '<div class="video-controls">';

								if( count($vodclass->segments) > 0 && file_exists( $vod_file ) ) {

									echo '<a class="button" href="player.php?vod=' . $vodclass->basename . '">Play segment 0 and cut</a> ';

									echo '<a class="button" href="' . TwitchConfig::cfg('vod_folder') . DIRECTORY_SEPARATOR . $vodclass->basename . '.json">JSON</a> ';

									echo '<a class="button" href="?save=' . $vodclass->basename . '">Save from deletion</a> ';

									echo '<a class="button" href="?delete=' . $vodclass->basename . '">Delete</a> ';

									if( $vodclass->twitch_vod_id && !$vodclass->is_chat_downloaded ){
										echo '<a class="button" href="chat.php?vod=' . $vodclass->basename . '">Download chat</a>';
									}

								}else{

									if( $vodclass->ended_at ){
										echo '<a class="button" href="convert.php?vod=' . $vodclass->basename . '">Convert</a>';
									}

									echo '<em>Capturing...</em>';

								}

							echo '</div>';
							
							// game list / chapters
							echo '<table class="game-list">';

								echo '<thead>';
									echo '<tr>';
										echo '<th>Offset</th>';
										echo '<th>Duration</th>';
										echo '<th>Game</th>';
										echo '<th>Title</th>';
										echo '<th>Viewers</th>';
									echo '</tr>';
								echo '</thead>';

								echo '<tbody>';

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

											// duration
											echo '<td>';
												echo '<span class="grey">';
												if( $d['duration'] ){
													echo getNiceDuration($d['duration']);
												}else{
													echo 'Active';
												}
												echo '</span>';
											echo '</td>';

											// game name
											echo '<td>';
												$game_data = TwitchHelper::getGame( $d['game_id']);
												
												if( $game_data['box_art_url'] ){
													$img_url = $game_data['box_art_url'];
													$img_url = str_replace("{width}", 14, $img_url);
													$img_url = str_replace("{height}", 19, $img_url);
													echo '<img class="boxart" src="' . $img_url . '" /> ';
												}

												$game_string = ( $game_data['name'] ?: $d['game_id'] );

												if( $vodclass->is_converted ){
													echo '<a href="player.php?vod=' . $vodclass->basename . '&start=' . $d['offset'] . '">';
														echo $game_string;
													echo '</a>';
												}else{
													echo $game_string;
												}

											echo '</td>';

											// title
											echo '<td>' . $d['title'] . '</td>';

											echo '<td><span class="grey">' . number_format($d['viewer_count']) . '</span></td>';

										echo '</tr>';

									}

									if( $vodclass->ended_at ){
										$diff = $vodclass->started_at->diff($vodclass->ended_at);
										echo '<tr><td>' . $diff->format('%H:%I:%S') . '</td><td colspan="4"><em>END</em></td></tr>';
									}else{

										

										echo '<tr>';
											if($vodclass->started_at){
												$diff = $vodclass->started_at->diff( new DateTime() );
												echo '<td>' . $diff->format('%H:%I:%S') . '</td>';
											}
											echo '<td colspan="4"><em><strong>ONGOING</strong></em></td>';
										echo '</tr>';

									}

								echo '</tbody>';

							echo '</table>';

						echo '</div>';

					}

				}

			echo '</div>';

		}

		echo '<strong>Total size: ' . round($total_size / 1024 / 1024 / 1024, 2) . 'GB</strong>';

	echo "</div>";

echo '</section>';

// Clips
$vods = glob( TwitchConfig::cfg('vod_folder') . DIRECTORY_SEPARATOR . "clips" . DIRECTORY_SEPARATOR . "*.mp4");

echo '<section class="section"' . ( count($vods) == 0 ? ' style="display:none;"' : '' ) . '>';
	echo '<div class="section-title"><h1>Clips</h1></div>';

	echo '<div class="section-content">';

	foreach( $vods as $k => $v ){

		echo '<div class="video clip">';

			echo '<a href="' . $v . '">' . basename($v) . '</a>';

			echo ' (' . round( filesize($v) / 1024 / 1024 / 1024, 2) . 'GB)';

		echo '</div>';
	
	}

	echo '</div>';

echo '</section>';

// debug
echo '<section class="section" style="display: none;">';

	echo '<div class="section-title"><h1>Hook</h1></div>';

	echo '<div class="section-content">';
	
	echo '<form method="post" action="hook.php">';
		echo '<textarea class="input" name="json"></textarea>';
		echo '<br><button class="button" type="submit">Hook</button>';
	echo '</form>';

	echo "</div>";

echo '</section>';

// logs
echo '<section class="section">';

	echo '<div class="section-title"><h1>Logs</h1></div>';

	echo '<div class="section-content">';
		
		$logs = glob("logs/*.log.json");
		$last_log = null;
		echo '<ul class="logs">';
		foreach( $logs as $log ){
			echo '<li><a href="' . $log . '">' . basename($log) . '</a></li>';
			$last_log = $log;
		}
		echo '</ul>';

		echo '<div class="log_viewer">';

		if( $last_log ){
			$json = json_decode( file_get_contents( $log ), true );

			foreach( $json as $line ){
				$escaped_text = htmlentities($line["text"], ENT_QUOTES | ENT_HTML401 | ENT_SUBSTITUTE | ENT_DISALLOWED, 'UTF-8', true);
				/*
				if( strpos($line, '<INFO>') !== false ) $color = 'info';
				if( strpos($line, '<ERROR>') !== false ) $color = 'error';
				if( strpos($line, '<WARNING>') !== false ) $color = 'warning';
				if( strpos($line, '<DEBUG>') !== false ) $color = 'debug';
				*/
				$text_line = "";
				$date = DateTime::createFromFormat("U.u", $line["date"]);
				if($date) $text_line .= $date->format("Y-m-d H:i:s.v");
				$text_line .= ' &lt;' . $line["level"] . '&gt; ';
				$text_line .= $escaped_text;
				echo '<div class="log_' . strtolower( $line["level"] ) . '">' . $text_line . '</div>';
			}
		}

		echo '</div>';

	echo "</div>";

echo '</section>';

echo '</div>';

echo '</body>';
echo '</html>';