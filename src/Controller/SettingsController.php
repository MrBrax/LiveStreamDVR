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

        return $this->twig->render($response, 'settings.twig', [
            'streamers' => TwitchConfig::getStreamers(),
            'sub_callback' => $sub_callback
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

        // TwitchConfig::$config['app_name'] = $app_name;
        TwitchConfig::$config['vods_to_keep'] = (int)$vods_to_keep;
        TwitchConfig::$config['storage_per_streamer'] = (int)$storage_per_streamer;
        TwitchConfig::$config['api_client_id'] = $api_client_id;
        TwitchConfig::$config['hook_callback'] = $hook_callback;
        TwitchConfig::$config['debug'] = $debug;
        TwitchConfig::$config['basepath'] = $basepath;
        TwitchConfig::$config['password'] = $password;
        if($api_secret) TwitchConfig::$config['api_secret'] = $api_secret;

        TwitchConfig::saveConfig();

        $response->getBody()->write("Settings saved.");
        return $response;

        // return $response->withHeader('Location', $this->router->pathFor('settings') )->withStatus(200);

    }

    public function streamer_add(Request $request, Response $response, array $args) {

        $username       = $_POST['username'];
        $quality        = $_POST['quality'];
        $match          = $_POST['match'];
        $download_chat  = isset($_POST['download_chat']);

        if( TwitchConfig::getStreamer($username) ){
            $response->getBody()->write("Streamer with that username already exists");
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
        TwitchConfig::saveConfig();

        TwitchHelper::sub( $username );

        $response->getBody()->write("Streamer added.");
        return $response;

    }

    public function streamer_update(Request $request, Response $response, array $args) {

        $username       = $_POST['username'];
        $quality        = $_POST['quality'];
        $match          = $_POST['match'];
        $download_chat  = isset($_POST['download_chat']);

        if( TwitchConfig::getStreamer($username) ){
            $response->getBody()->write("Streamer with that username already exists");
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
        TwitchConfig::saveConfig();

        TwitchHelper::sub( $username );

        $response->getBody()->write("Streamer added.");
        return $response;

    }

    public function streamer_delete(Request $request, Response $response, array $args) {

        $username = $_POST['username'];

        if( !TwitchConfig::getStreamer($username) ){
            $response->getBody()->write("Streamer with that username does not exist");
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
        TwitchConfig::saveConfig();

        $response->getBody()->write("Streamer deleted.");
        return $response;

    }

}