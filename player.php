<?php

include "class.php";

$vod = mb_ereg_replace("([^\w\s\d\-_~,;\[\]\(\).])", '', $_GET['vod']);

$vodclass = new TwitchVOD();
$vodclass->load('vods/' . $vod . '.json');

echo '<link href="style.css" rel="stylesheet" />';

echo '<div class="video-player">';

echo '<video id="video" src="vods/' . $vod . '.mp4" controls></video>';

// $started_at = DateTime::createFromFormat("Y-m-d\TH:i:s\Z", $json['started_at'] );

echo '<div class="video-chapters">';

// var_dump($vodclass->games);

foreach ($vodclass->games as $c) {

	// $game_time = DateTime::createFromFormat("Y-m-d\TH:i:s\Z", $c['time'] );

	// $diff = $game_time->diff($started_at);

	// $offset = $game_time->getTimestamp() - $vodclass->started_at->getTimestamp();

	// $time = $json['duration'];
    // $timeInSeconds = strtotime($time) - strtotime('TODAY');

	$proc = ( $vodclass->duration / $c['duration'] ) * 100;

	echo '<div title="' . $c['title'] . ' | ' . $c['game_name'] . '" class="video-chapter" style="width: ' . $proc . '%" onclick="scrub(' . $c['offset'] . ', ' . $c['duration'] . ');">';
		echo '<div class="video-chapter-title">' . $c['title'] . '</div>';
		echo '<div class="video-chapter-game">' . $c['game_name'] . '</div>';
	echo '</div>';
}

echo '</div>';

echo '<div class="video-cut">';
	echo '<button class="button" onclick="cut_video(\'in\')">in</button>';
	echo '<button class="button" onclick="cut_video(\'out\')">out</button>';
	echo '<button class="button" onclick="submit_cut();">cut</button>';
	echo '<input class="input" id="value_in">';
	echo '<input class="input" id="value_out">';
	echo '<input class="input" id="cut_video_cmd">';
echo '</div>';

echo '</div>';

?>

<script type="text/javascript">

	let game_offset = <?=$vodclass->game_offset?>;
	
	let time_in = "";
	let time_out = "";

	function cut_video( t ){

		let cmd = document.getElementById('cut_video_cmd');

		let current_time = document.getElementById('video').currentTime;

		if(t == 'in') time_in = Math.round(current_time);
		if(t == 'out') time_out = Math.round(current_time);
		
		document.getElementById('value_in').value = time_in;
		document.getElementById('value_out').value = time_out;
		// cmd.value = 'ffmpeg -i "<?=$vod?>.mp4" -ss ' + time_in + ' -t ' + ( time_out - time_in ) + ' -codec copy "<?=$vod?>-cut.mp4"'; 

	}

	function submit_cut(){
		if( time_in && time_out ){
			location.href = 'cut.php?vod=<?=$vod?>&start=' + time_in + '&end=' + time_out;
		}
	}

	function scrub(s, d){
		document.getElementById("video").currentTime = s;

		time_in = Math.round(s-game_offset);
		time_out = Math.round(s+d-game_offset);

		document.getElementById('value_in').value = time_in;
		document.getElementById('value_out').value = time_out;
	}

</script>