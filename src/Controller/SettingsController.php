<?php

namespace App\Controller;

use App\TwitchConfig;
use App\TwitchHelper;
use App\TwitchAutomator;
use Slim\Psr7\Request;
use Slim\Psr7\Response;
use Slim\Views\Twig;

/**
 * Settings page
 */
class SettingsController
{

    /**
     * @var Twig
     */
    private $twig;

    public function __construct(Twig $twig) {
        $this->twig = $twig;
    }

    public function settings(Request $request, Response $response, array $args) {
        
        $sub_callback = TwitchConfig::cfg('hook_callback');
        $sub_callback = str_replace('/hook', '/sub', $sub_callback);

        $games = TwitchConfig::getGames();

        return $this->twig->render($response, 'settings.twig', [
            'streamers' => TwitchConfig::getStreamers(),
            'sub_callback' => $sub_callback,
            'games' => $games
        ]);

    }

    public function settings_save(Request $request, Response $response, array $args) {
        
        // $app_name               = $_POST['app_name'];
        $vods_to_keep           = $_POST['vods_to_keep'];
        $storage_per_streamer   = $_POST['storage_per_streamer'];
        $api_client_id          = $_POST['api_client_id'];
        $api_secret             = $_POST['api_secret'];
        $hook_callback          = $_POST['hook_callback'];
        $debug                  = isset($_POST['debug']);
        $basepath               = $_POST['basepath'];
        $password               = $_POST['password'];
        
        $bin_dir               = $_POST['bin_dir'];
        $ffmpeg_path           = $_POST['ffmpeg_path'];
        $mediainfo_path        = $_POST['mediainfo_path'];

        // TwitchConfig::$config['app_name'] = $app_name;
        TwitchConfig::$config['vods_to_keep'] = (int)$vods_to_keep;
        TwitchConfig::$config['storage_per_streamer'] = (int)$storage_per_streamer;
        TwitchConfig::$config['api_client_id'] = $api_client_id;
        TwitchConfig::$config['hook_callback'] = $hook_callback;
        TwitchConfig::$config['debug'] = $debug;
        TwitchConfig::$config['basepath'] = $basepath;
        TwitchConfig::$config['password'] = $password;
        TwitchConfig::$config['bin_dir'] = $bin_dir;
        TwitchConfig::$config['ffmpeg_path'] = $ffmpeg_path;
        TwitchConfig::$config['mediainfo_path'] = $mediainfo_path;
        if($api_secret) TwitchConfig::$config['api_secret'] = $api_secret;

        TwitchConfig::saveConfig("settings/save");

        $response->getBody()->write("Settings saved.");
        return $response;

        // return $response->withHeader('Location', $this->router->pathFor('settings') )->withStatus(200);

    }

    public function favourites_save(Request $request, Response $response, array $args) {
        
        // $app_name               = $_POST['app_name'];
        $games                  = $_POST['games'];

        $data = [];
        foreach( $games as $id => $value ){
            $data[$id] = true;
        }

        // var_dump($data);
        
        TwitchConfig::$config['favourites'] = $data;
        TwitchConfig::saveConfig("favourites/save");
        $response->getBody()->write("Favourites saved.");

        return $response;

    }

    public function streamer_add(Request $request, Response $response, array $args) {

        $username       = $_POST['username'];
        $quality        = explode(" ", $_POST['quality']);
        $match          = $_POST['match'];
        $download_chat  = isset($_POST['download_chat']);

        if( TwitchConfig::getStreamer($username) ){
            $response->getBody()->write("Streamer with that username already exists in config");
            return $response;
        }

        $tmp = TwitchHelper::getChannelData( $username );
        if(!$tmp){
            $response->getBody()->write("Streamer with that username doesn't seem to exist on Twitch");
            return $response;
        }

        // template
        $streamer = [
            "username" => $username,
            "quality" => $quality
        ];
    
        if( $match ){
            $streamer["match"] = explode(",", $match);
        }
    
        if( $download_chat ){
            $streamer["download_chat"] = 1;
        }

        TwitchConfig::$config['streamers'][] = $streamer;
        TwitchConfig::saveConfig("streamer/add");

        TwitchHelper::sub( $username );

        $response->getBody()->write("Streamer added.");
        return $response;

    }

    public function streamer_update(Request $request, Response $response, array $args) {

        $username       = $_POST['username'];
        $quality        = explode(" ", $_POST['quality']);
        $match          = $_POST['match'];
        $download_chat  = isset($_POST['download_chat']);

        if( TwitchConfig::getStreamer($username) ){
            $response->getBody()->write("Streamer with that username already exists in config");
            return $response;
        }

        // template
        $streamer = [
            "username" => $username,
            "quality" => $quality
        ];
    
        if( $match ){
            $streamer["match"] = explode(",", $match);
        }
    
        if( $download_chat ){
            $streamer["download_chat"] = 1;
        }
    
        $key = null;
        foreach( TwitchConfig::$config['streamers'] as $k => $v ){
            if( $v['username'] == $username ) $key = $k;
        }
        if(!$key){
            $response->getBody()->write("Streamer not found.");
            return $response;
        }
        
        TwitchConfig::$config['streamers'][ $key ] = $streamer;
        TwitchConfig::saveConfig("streamer/update");

        TwitchHelper::sub( $username );

        $response->getBody()->write("Streamer updated.");
        return $response;

    }

    public function streamer_delete(Request $request, Response $response, array $args) {

        $username = $_POST['username'];

        if( !TwitchConfig::getStreamer($username) ){
            $response->getBody()->write("Streamer with that username does not exist in config");
            return $response;
        }
    
        $key = null;
        foreach( TwitchConfig::$config['streamers'] as $k => $v ){
            if( $v['username'] == $username ) $key = $k;
        }
        if(!$key){
            $response->getBody()->write("Streamer not found.");
            return $response;
        }

        TwitchHelper::unsub( $username );
        
        unset(TwitchConfig::$config['streamers'][ $key ]);
        TwitchConfig::saveConfig("streamer/deleted");

        $response->getBody()->write("Streamer deleted.");
        return $response;

    }

}