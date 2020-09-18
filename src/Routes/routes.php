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
use App\Controller\ApiController;

// Define named route
$app->get('/', function (Request $request, Response $response, array $args) use ($app) {
    $response->getBody()->write("Hello, World! Visit <a href=\"./dashboard\">/dashboard</a> to continue.<br>Slim 4 doesn't seem to support relative redirects.");
    return $response;
})->setName('index');

$app->get('/dashboard', DashboardController::class . ':dashboard')->setName('dashboard');
$app->get('/about', AboutController::class . ':about')->setName('about');

$app->get('/settings', SettingsController::class . ':settings')->setName('settings');
$app->post('/settings/save', SettingsController::class . ':settings_save')->setName('settings_save');
$app->post('/settings/streamer/add', SettingsController::class . ':streamer_add')->setName('streamer_add');
$app->post('/settings/streamer/delete', SettingsController::class . ':streamer_delete')->setName('streamer_delete');
$app->post('/settings/streamer/update', SettingsController::class . ':streamer_update')->setName('streamer_update');
$app->post('/settings/favourites/save', SettingsController::class . ':favourites_save')->setName('favourites_save');

$app->get('/player/{vod}', PlayerController::class . ':player')->setName('player');
$app->post('/cut', VodController::class . ':cut')->setName('cut');
$app->get('/chat/{vod}', VodController::class . ':chat')->setName('chat');
$app->get('/save/{vod}', VodController::class . ':save')->setName('save');
$app->get('/delete/{vod}', VodController::class . ':delete')->setName('delete');
$app->get('/convert/{vod}', VodController::class . ':convert')->setName('convert');
$app->get('/download/{vod}', VodController::class . ':download')->setName('download');
$app->get('/troubleshoot/{vod}', VodController::class . ':troubleshoot')->setName('troubleshoot');

$app->get('/hook', HookController::class . ':hook')->setName('hook');
$app->post('/hook', HookController::class . ':hook')->setName('hook_post');

$app->get('/sub', SubController::class . ':sub')->setName('sub');
$app->get('/subs', SubController::class . ':subs')->setName('subs');

$app->get('/api/v0/list', ApiController::class . ':list')->setName('api_list');
$app->get('/api/v0/vod/{vod}', ApiController::class . ':vod')->setName('api_vod');
$app->get('/api/v0/render/streamer/{username}', ApiController::class . ':render_streamer')->setName('api_render_streamer');
$app->get('/api/v0/render/log/[{filename}]', ApiController::class . ':render_log')->setName('api_render_log');
$app->get('/api/v0/check_vods', ApiController::class . ':check_vods')->setName('check_vods');

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

// abort recording of streamer
$app->get('/abort_record/{username}', function (Request $request, Response $response, array $args) {

    $vods = glob(TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $args['username'] . "_*.json");

    foreach ($vods as $k => $v) {

        $vodclass = new App\TwitchVOD();
        $vodclass->load($v);

        $pid = $vodclass->getCapturingStatus();
        if($pid){
            $output = shell_exec("pkill " . escapeshellarg($pid));
            $response->getBody()->write( "<pre>" . $output . "</pre><br>");
        }

    }
    
})->setName('abort_record');

