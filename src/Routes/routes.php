<?php

declare(strict_types=1);

use Slim\Psr7\Request;
use Slim\Psr7\Response;
use Slim\Routing\RouteCollectorProxy;

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
use App\Controller\DebugController;
use App\Controller\CronController;
use App\Controller\ToolsController;
use App\TwitchConfig;

/** @var \Slim\App $app  */

// Define named route
$app->get('/', function (Request $request, Response $response, array $args) use ($app) {
    $url = $app->getBasePath() . '/dashboard';
    return $response->withStatus(302)->withHeader("Location", $url);
})->setName('index');

$app->get('/dashboard', DashboardController::class . ':dashboard')->setName('dashboard');
$app->get('/about', AboutController::class . ':about')->setName('about');

$app->group('/settings', function (RouteCollectorProxy $group) {
    $group->get('', SettingsController::class . ':settings')->setName('settings');
    $group->post('/save', SettingsController::class . ':settings_save')->setName('settings_save');
    $group->post('/streamer/add', SettingsController::class . ':streamer_add')->setName('streamer_add');
    $group->post('/streamer/delete', SettingsController::class . ':streamer_delete')->setName('streamer_delete');
    $group->post('/streamer/update', SettingsController::class . ':streamer_update')->setName('streamer_update');
    $group->post('/favourites/save', SettingsController::class . ':favourites_save')->setName('favourites_save');
});

$app->get('/player/{vod}', PlayerController::class . ':player')->setName('player');
$app->post('/cut', VodController::class . ':cut')->setName('cut');
// $app->get('/chat/{vod}', VodController::class . ':chat')->setName('chat');
// $app->get('/save/{vod}', VodController::class . ':save')->setName('save');
// $app->get('/delete/{vod}', VodController::class . ':delete')->setName('delete');
// $app->get('/convert/{vod}', VodController::class . ':convert')->setName('convert');
// $app->get('/download/{vod}', VodController::class . ':download')->setName('download');
$app->get('/troubleshoot/{vod}', VodController::class . ':troubleshoot')->setName('troubleshoot');
// $app->get('/check_mute/{vod}', VodController::class . ':check_mute')->setName('check_mute');
// $app->get('/render_chat/{vod}', VodController::class . ':render_chat')->setName('render_chat');
// $app->get('/fullburn/{vod}', VodController::class . ':fullburn')->setName('fullburn');

$app->get('/hook', HookController::class . ':hook')->setName('hook');
$app->post('/hook', HookController::class . ':hook')->setName('hook_post');

$app->get('/sub', SubController::class . ':sub')->setName('sub');
$app->get('/subs', SubController::class . ':subs')->setName('subs');

// api v0
$app->group('/api/v0', function (RouteCollectorProxy $group) {

    $group->get('/list', ApiController::class . ':list')->setName('api_list');

    // $group->get('/help', ApiController::class . ':help')->setName('api_help');

    // vod manipulation
    $group->get('/vod/{vod}', ApiController::class . ':vod')->setName('api_vod');
    $group->get('/vod/{vod}/search_chatdump', ApiController::class . ':vod_search_chatdump')->setName('api_vod_search_chatdump');
    $group->get('/vod/{vod}/download_chat', ApiController::class . ':vod_download_chat')->setName('api_vod_download_chat');
    $group->get('/vod/{vod}/download', ApiController::class . ':vod_download')->setName('api_vod_download');
    $group->get('/vod/{vod}/check_mute', ApiController::class . ':vod_check_mute')->setName('api_vod_check_mute');
    $group->get('/vod/{vod}/full_burn', ApiController::class . ':vod_full_burn')->setName('api_vod_full_burn');
    $group->get('/vod/{vod}/render_chat', ApiController::class . ':vod_render_chat')->setName('api_vod_render_chat');
    $group->get('/vod/{vod}/delete', ApiController::class . ':vod_delete')->setName('api_vod_delete');
    $group->get('/vod/{vod}/save', ApiController::class . ':vod_save')->setName('api_vod_save');
    $group->get('/vod/{vod}/export', ApiController::class . ':vod_export')->setName('api_vod_export');

    // html render, make this obsolete some day
    $group->get('/render/menu', ApiController::class . ':render_menu')->setName('api_render_menu');
    $group->get('/render/streamer/{username}', ApiController::class . ':render_streamer')->setName('api_render_streamer');
    $group->get('/render/log/[{filename}]', ApiController::class . ':render_log')->setName('api_render_log');

    $group->get('/check_vods', ApiController::class . ':check_vods')->setName('check_vods');

    // job manipulation
    $group->get('/jobs/list', ApiController::class . ':jobs_list')->setName('api_jobs_list');
    $group->get('/jobs/kill/{job}', ApiController::class . ':jobs_kill')->setName('api_jobs_kill');

    // twitch api proxy
    $group->get('/twitchapi/videos/{username}', ApiController::class . ':twitchapi_videos')->setName('api_twitchapi_videos');
    $group->get('/twitchapi/video/{video_id}', ApiController::class . ':twitchapi_video')->setName('api_twitchapi_video');

    $group->get('/playlist_dump/{username}', ApiController::class . ':playlist_dump')->setName('api_playlist_dump');
});

// $app->get('/dialog/{type}/{text}', DebugController::class . ':dialog')->setName('dialog');

// cronjobs
$app->group('/cron', function (RouteCollectorProxy $group) {
    $group->get('/check_deleted_vods', CronController::class . ':check_deleted_vods')->setName('check_deleted_vods');
    $group->get('/check_muted_vods', CronController::class . ':check_muted_vods')->setName('check_muted_vods');
    $group->get('/dump_playlists', CronController::class . ':dump_playlists')->setName('dump_playlists');
});

// tools
$app->group('/tools', function (RouteCollectorProxy $group) {
    $group->get('', ToolsController::class . ':tools')->setName('tools');
    $group->post('/fullvodburn', ToolsController::class . ':page_fullvodburn')->setName('tools_fullvodburn');
    $group->post('/voddownload', ToolsController::class . ':page_voddownload')->setName('tools_voddownload');
    $group->post('/chatdownload', ToolsController::class . ':page_chatdownload')->setName('tools_chatdownload');
});

// force start recording of streamer
$app->get('/force_record/{username}', function (Request $request, Response $response, array $args) {
    $channel_id = TwitchHelper::getChannelId($args['username']);
    $streams = TwitchHelper::getStreams($channel_id);
    if ($streams) {
        set_time_limit(0);
        $data = [
            'data' => $streams
        ];
        $TwitchAutomator = new TwitchAutomator();
        $TwitchAutomator->force_record = true;
        $TwitchAutomator->handle($data);
    } else {
        $response->getBody()->write("No streams found for " . $args['username']);
    }
    return $response;
})->setName('force_record');
