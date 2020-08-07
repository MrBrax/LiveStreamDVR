<?php

require( __DIR__ . "/../app/class.php");

$TwitchAutomator = new TwitchAutomator();

set_time_limit(0);

if( $_GET['hub_challenge'] ){
	echo $_GET['hub_challenge'];
	return;
}

if( $_GET['hub.challenge'] ){
	echo $_GET['hub.challenge'];
	return;
}

$data = json_decode( file_get_contents('php://input'), true );

$post_json = $_POST['json'];

if( $post_json ){
	$data = json_decode( $post_json, true );
}

if($data){

	file_put_contents( __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . 'payloads' . DIRECTORY_SEPARATOR . date("Y-m-d.h_i_s") . '.json', json_encode($data));

	$data_id = $data['data'][0]['id'];
	$data_title = $data['data'][0]['title'];
	$data_started = $data['data'][0]['started_at'];
	$data_game_id = $data['data'][0]['game_id'];
	$data_username = $data['data'][0]['user_name'];

	$TwitchAutomator->handle( $data );

}else{

	echo 'No data supplied';

}
