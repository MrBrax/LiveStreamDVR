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

        $app_calc = "http" . ( $_SERVER['SERVER_PORT'] ? 's' : '' ) . "://" . $_SERVER["HTTP_HOST"] . str_replace("/settings", "", $_SERVER["REQUEST_URI"]);
        // $app_calc = 

        $games = TwitchConfig::getGames();

        return $this->twig->render($response, 'settings.twig', [
            'streamers' => TwitchConfig::getStreamers(),
            'sub_callback' => $sub_callback,
            'games' => $games,
            'settings' => TwitchConfig::$settingsFields,
            'app_calc' => $app_calc,
            'timezones' => \DateTimeZone::listIdentifiers()
        ]);

    }

    public function settings_save(Request $request, Response $response, array $args) {
        
        // $app_name               = $_POST['app_name'];
        /*
        $vods_to_keep           = $_POST['vods_to_keep'];
        $storage_per_streamer   = $_POST['storage_per_streamer'];
        $api_client_id          = $_POST['api_client_id'];
        $api_secret             = $_POST['api_secret'];
        $hook_callback          = $_POST['hook_callback'];
        $debug                  = isset($_POST['debug']);
        $disable_ads            = isset($_POST['disable_ads']);
        $app_verbose            = isset($_POST['app_verbose']);
        $basepath               = $_POST['basepath'];
        $password               = $_POST['password'];
        $channel_folders        = isset($_POST['channel_folders']);
        $hls_timeout               = $_POST['hls_timeout'];
        
        $bin_dir               = $_POST['bin_dir'];
        $ffmpeg_path           = $_POST['ffmpeg_path'];
        $mediainfo_path        = $_POST['mediainfo_path'];
        $twitchdownloader_path = $_POST['twitchdownloader_path'];

        TwitchConfig::$config['vods_to_keep'] = (int)$vods_to_keep;
        TwitchConfig::$config['storage_per_streamer'] = (int)$storage_per_streamer;
        TwitchConfig::$config['api_client_id'] = $api_client_id;
        TwitchConfig::$config['hook_callback'] = $hook_callback;
        TwitchConfig::$config['debug'] = $debug;
        TwitchConfig::$config['app_verbose'] = $app_verbose;
        TwitchConfig::$config['disable_ads'] = $disable_ads;
        TwitchConfig::$config['basepath'] = $basepath;
        TwitchConfig::$config['password'] = $password;
        TwitchConfig::$config['channel_folders'] = $channel_folders;
        TwitchConfig::$config['hls_timeout'] = $hls_timeout;

        TwitchConfig::$config['bin_dir'] = $bin_dir;
        TwitchConfig::$config['ffmpeg_path'] = $ffmpeg_path;
        TwitchConfig::$config['mediainfo_path'] = $mediainfo_path;
        TwitchConfig::$config['twitchdownloader_path'] = $twitchdownloader_path;
        if($api_secret) TwitchConfig::$config['api_secret'] = $api_secret;
        */

        foreach( TwitchConfig::$settingsFields as $setting ){

            $key = $setting['key'];

            if( $setting['type'] == "boolean" ){

                TwitchConfig::$config[ $key ] = isset($_POST[ $key ]);

            }else{

                if( isset($setting['secret']) ){
                    if( $_POST[ $key ] ){
                        TwitchConfig::$config[ $key ] = $_POST[ $key ];
                    }
                }else{
                    TwitchConfig::$config[ $key ] = $_POST[ $key ];
                }

            }
        }

        TwitchConfig::saveConfig("settings/save");

        return $this->twig->render($response, 'dialog.twig', [
            'text' => 'Settings saved.',
            'type' => 'success'
        ]);

        // return $response->withHeader('Location', $this->router->pathFor('settings') )->withStatus(200);

    }

    public function favourites_save(Request $request, Response $response, array $args) {
        
        // $app_name               = $_POST['app_name'];
        $games                  = $_POST['games'];

        $data = [];
        foreach( $games as $id => $value ){
            $data[$id] = true;
        }
        
        TwitchConfig::$config['favourites'] = $data;
        TwitchConfig::saveConfig("favourites/save");

        return $this->twig->render($response, 'dialog.twig', [
            'text' => 'Favourites saved.',
            'type' => 'success'
        ]);

        return $response;

    }

    public function streamer_add(Request $request, Response $response, array $args) {

        $username       = $_POST['username'];
        $quality        = explode(" ", $_POST['quality']);
        $match          = $_POST['match'];
        $download_chat  = isset($_POST['download_chat']);
        $burn_chat  = isset($_POST['burn_chat']);

        if( TwitchConfig::getStreamer($username) ){
            $response->getBody()->write("Streamer with that username already exists in config");
            return $response;
        }

        $tmp = TwitchHelper::getChannelData( $username );
        if(!$tmp){
            $response->getBody()->write("Streamer with that username doesn't seem to exist on Twitch");
            return $response;
        }

        // fix capitalization
        if( $tmp['display_name'] !== $username ){
            $response->getBody()->write("Username capitalization seems to be incorrect, fixing.<br>");
            $username = $tmp['display_name'];
        }

        // template
        $streamer = [
            "username" => $username,
            "quality" => $quality
        ];
    
        if( $match ){
            $streamer["match"] = explode(",", $match);
        }
    
        if( $download_chat ) $streamer["download_chat"] = true;
        if( $burn_chat ) $streamer["burn_chat"] = true;

        TwitchConfig::$config['streamers'][] = $streamer;
        TwitchConfig::saveConfig("streamer/add");

        TwitchHelper::sub( $username );

        return $this->twig->render($response, 'dialog.twig', [
            'text' => "Streamer added: " . $username . ".",
            'type' => 'success'
        ]);

    }

    public function streamer_update(Request $request, Response $response, array $args) {

        $username       = $_POST['username'];
        $quality        = explode(" ", $_POST['quality']);
        $match          = $_POST['match'];
        $download_chat  = isset($_POST['download_chat']);
        $burn_chat  = isset($_POST['burn_chat']);

        $current_username = $username;

        if( !TwitchConfig::getStreamer($username) ){
            $response->getBody()->write("Streamer with that username does not exist in config");
            return $response;
        }

        $tmp = TwitchHelper::getChannelData( $username );

        // fix capitalization
        if( $tmp['display_name'] !== $username ){
            $response->getBody()->write("Username capitalization seems to be incorrect, fixing.<br>");
            $username = $tmp['display_name'];
        }

        // template
        $streamer = [
            "username" => $username,
            "quality" => $quality
        ];
    
        if( $match ){
            $streamer["match"] = explode(",", $match);
        }
    
        if( $download_chat ) $streamer["download_chat"] = true;
        if( $burn_chat ) $streamer["burn_chat"] = true;
    
        $key = null;
        foreach( TwitchConfig::$config['streamers'] as $k => $v ){
            if( $v['username'] == $current_username ) $key = $k;
        }
        if(!$key){
            $response->getBody()->write("Streamer not found.");
            return $response;
        }
        
        TwitchConfig::$config['streamers'][ $key ] = $streamer;
        TwitchConfig::saveConfig("streamer/update");

        TwitchHelper::sub( $username );

        // $response->getBody()->write("Streamer updated.");
        // return $response;

        return $this->twig->render($response, 'dialog.twig', [
            'text' => 'Streamer updated.',
            'type' => 'success'
        ]);

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

        return $this->twig->render($response, 'dialog.twig', [
            'text' => "Streamer deleted.",
            'type' => 'success'
        ]);

    }

}