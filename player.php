<?php

include "class.php";

$vod = mb_ereg_replace("([^\w\s\d\-_~,;\[\]\(\).])", '', $_GET['vod']);

$vodclass = new TwitchVOD();
$vodclass->load( TwitchConfig::cfg('vod_folder') . '/' . $vod . '.json');

?>

<link href="style.css" rel="stylesheet" />

<div class="video-player">

	<video id="video" src="<?php echo TwitchConfig::cfg('vod_folder') . '/' . $vod . '.mp4'; ?>" controls width="1280"></video>


	<div class="video-chapters">

		<?php foreach ($vodclass->games as $c) { ?>

			<?php $proc = ( $vodclass->duration / $c['duration'] ) * 100; ?>

			<div title="<?php echo $c['title'] . ' | ' . $c['game_name']; ?>" class="video-chapter" style="width: <?php echo $proc; ?>%" onclick="scrub(<?php echo $c['offset']; ?>, <?php echo $c['duration']; ?>);">
				<div class="video-chapter-title"><?php echo $c['title']; ?></div>
				<div class="video-chapter-game"><?php echo $c['game_name']; ?></div>
			</div>

		<?php } ?>

	</div>

	<div class="video-cut">
		<button class="button" onclick="cut_video('in')">Mark in</button>
		<button class="button" onclick="cut_video('out')">Mark out</button>
		<button class="button" onclick="submit_cut();">Submit cut</button>
		<input class="input" id="value_in" placeholder="In timestamp">
		<input class="input" id="value_out" placeholder="Out timestamp">
		<input class="input" id="cut_video_cmd">
	</div>

</div>

<script type="text/javascript">

	let game_offset = <?php echo $vodclass->game_offset; ?>;
	
	let time_in = "";
	let time_out = "";

	function cut_video( t ){

		let cmd = document.getElementById('cut_video_cmd');

		let current_time = document.getElementById('video').currentTime;

		if(t == 'in') time_in = Math.round(current_time);
		if(t == 'out') time_out = Math.round(current_time);
		
		document.getElementById('value_in').value = time_in;
		document.getElementById('value_out').value = time_out;
		
	}

	function submit_cut(){
		if( time_in && time_out ){
			location.href = 'cut.php?vod=<?php echo $vod; ?>&start=' + time_in + '&end=' + time_out;
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