<?php

use Slim\Psr7\Request;
use Slim\Psr7\Response;

use App\TwitchHelper;
use App\TwitchAutomator;
use App\Controller\AboutController;
use App\Controller\DashboardController;
use App\Controller\HookController;
use App\Controller\VodController;
use App\Controller\PlayerController;
use App\Controller\SettingsController;
use App\Controller\SubController;

// Define named route
$app->get('/', function (Request $request, Response $response, array $args) {
    $response->getBody()->write("Hello, World! Visit /dashboard to continue.");
    return $response;
    // return $response->withHeader('Location', '/dashboard')->withStatus(200);
})->setName('index');

$app->get('/dashboard', DashboardController::class . ':dashboard')->setName('dashboard');
$app->get('/about', AboutController::class . ':about')->setName('about');

$app->get('/settings', SettingsController::class . ':settings')->setName('settings');
$app->post('/settings/save', SettingsController::class . ':settings_save')->setName('settings_save');
$app->post('/settings/streamer/add', SettingsController::class . ':streamer_add')->setName('streamer_add');
$app->post('/settings/streamer/delete', SettingsController::class . ':streamer_delete')->setName('streamer_delete');
$app->post('/settings/streamer/update', SettingsController::class . ':streamer_update')->setName('streamer_update');

$app->get('/player/{vod}', PlayerController::class . ':player')->setName('player');
$app->post('/cut', VodController::class . ':cut')->setName('cut');
$app->get('/chat/{vod}', VodController::class . ':chat')->setName('chat');
$app->get('/save/{vod}', VodController::class . ':save')->setName('save');
$app->get('/delete/{vod}', VodController::class . ':delete')->setName('delete');
$app->get('/convert/{vod}', VodController::class . ':convert')->setName('convert');
$app->get('/download/{vod}', VodController::class . ':download')->setName('download');

$app->get('/hook', HookController::class . ':hook')->setName('hook');
$app->post('/hook', HookController::class . ':hook')->setName('hook_post');

$app->get('/sub', SubController::class . ':sub')->setName('sub');
$app->get('/subs', SubController::class . ':subs')->setName('subs');

// force start recording of streamer
$app->get('/force_record/{username}', function (Request $request, Response $response, array $args) {
    $streams = TwitchHelper::getStreams( TwitchHelper::getChannelId( $args['username'] ) );
    if($streams){
        set_time_limit(0);
        $data = [
            'data' => $streams
        ];
        $TwitchAutomator = new TwitchAutomator();
        $TwitchAutomator->handle( $data );
    }else{
        $response->getBody()->write("No streams found for " . $args['username']);
    }
    return $response;
})->setName('force_record');
