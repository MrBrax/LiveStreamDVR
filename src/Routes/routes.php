<?php

declare(strict_types=1);

use Slim\Psr7\Request;
use Slim\Psr7\Response;
use Slim\Routing\RouteCollectorProxy;

use App\Controller\HookController;
use App\Controller\SubController;
use App\Controller\ApiController;
use App\Controller\CronController;

use App\TwitchConfig;

/** @var \Slim\App $app  */

// Define named route

/*
$app->any("/*", function (Request $request, Response $response, array $args) use ($app) {
    die('yee');
});
*/

/*
$app->get('/', function (Request $request, Response $response, array $args) use ($app) {
    $url = $app->getBasePath() . '/dashboard';
    return $response->withStatus(302)->withHeader("Location", $url);
})->setName('index');
*/


/*
$app->any('/', function (Request $request, Response $response, array $args) use ($app) {
    $i = __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "client-vue" . DIRECTORY_SEPARATOR . "dist" . DIRECTORY_SEPARATOR . "index.html";
    $response->getBody()->write(file_get_contents($i));
    return $response;
});
*/

// $app->get('/dashboard', DashboardController::class . ':dashboard')->setName('dashboard');
// $app->get('/about', AboutController::class . ':about')->setName('about');

/*
$app->group('/settings', function (RouteCollectorProxy $group) {
    $group->get('', SettingsController::class . ':settings')->setName('settings');
    // $group->post('/save', SettingsController::class . ':settings_save')->setName('settings_save');
    // $group->post('/streamer/add', SettingsController::class . ':streamer_add')->setName('streamer_add');
    // $group->post('/streamer/delete', SettingsController::class . ':streamer_delete')->setName('streamer_delete');
    // $group->post('/streamer/update', SettingsController::class . ':streamer_update')->setName('streamer_update');
    // $group->post('/favourites/save', SettingsController::class . ':favourites_save')->setName('favourites_save');
});
*/

// $app->get('/player/{vod}', PlayerController::class . ':player')->setName('player');
// $app->post('/cut', VodController::class . ':cut')->setName('cut');
// $app->get('/chat/{vod}', VodController::class . ':chat')->setName('chat');
// $app->get('/save/{vod}', VodController::class . ':save')->setName('save');
// $app->get('/delete/{vod}', VodController::class . ':delete')->setName('delete');
// $app->get('/convert/{vod}', VodController::class . ':convert')->setName('convert');
// $app->get('/download/{vod}', VodController::class . ':download')->setName('download');
// $app->get('/troubleshoot/{vod}', VodController::class . ':troubleshoot')->setName('troubleshoot');
// $app->get('/check_mute/{vod}', VodController::class . ':check_mute')->setName('check_mute');
// $app->get('/render_chat/{vod}', VodController::class . ':render_chat')->setName('render_chat');
// $app->get('/fullburn/{vod}', VodController::class . ':fullburn')->setName('fullburn');

// $app->get('/hook', HookController::class . ':hook')->setName('hook');
// $app->post('/hook', HookController::class . ':hook')->setName('hook_post');

// $app->get('/sub', SubController::class . ':sub')->setName('sub'); /** @deprecated */
// $app->get('/subs', SubController::class . ':subs')->setName('subs');
// $app->get('/unsub_all', SubController::class . ':unsub_all')->setName('unsub_all');

// api v0
$app->group('/api/v0', function (RouteCollectorProxy $group) {

    // @deprecated 4.1.0
    // $group->get('/list', ApiController::class . ':list')->setName('api_list');

    // $group->get('/help', ApiController::class . ':help')->setName('api_help');

    // vod manipulation
    $group->group('/vod/{vod}', function (RouteCollectorProxy $group) {
        $group->get('/', ApiController::class . ':vod')->setName('api_vod');
        $group->post('/search_chatdump', ApiController::class . ':vod_search_chatdump')->setName('api_vod_search_chatdump');
        $group->post('/download_chat', ApiController::class . ':vod_download_chat')->setName('api_vod_download_chat');
        $group->post('/download', ApiController::class . ':vod_download')->setName('api_vod_download');
        $group->post('/check_mute', ApiController::class . ':vod_check_mute')->setName('api_vod_check_mute');
        $group->post('/full_burn', ApiController::class . ':vod_full_burn')->setName('api_vod_full_burn');
        $group->post('/render_chat', ApiController::class . ':vod_render_chat')->setName('api_vod_render_chat');
        $group->post('/delete', ApiController::class . ':vod_delete')->setName('api_vod_delete');
        $group->post('/save', ApiController::class . ':vod_save')->setName('api_vod_save');
        // $group->post('/export', ApiController::class . ':vod_export')->setName('api_vod_export');
        $group->post('/cut', ApiController::class . ':vod_cut')->setName('api_vod_cut');
    });

    // channels
    $group->group('/channels', function (RouteCollectorProxy $group) {
        $group->get('/list', ApiController::class . ':channels_list')->setName('api_channels_list');
        $group->post('/add', ApiController::class . ':channels_add')->setName('api_channels_add');
        $group->post('/update', ApiController::class . ':channels_update')->setName('api_channels_update');
        $group->post('/delete', ApiController::class . ':channels_delete')->setName('api_channels_delete');
    });

    // channel
    $group->group('/channel/{username}', function (RouteCollectorProxy $group) {
        $group->get('', ApiController::class . ':channel')->setName('api_channel');
        $group->get('/force_record', ApiController::class . ':channel_force_record')->setName('api_channel_force_record');
        $group->get('/dump_playlist', ApiController::class . ':channel_dump_playlist')->setName('api_channel_dump_playlist');
        $group->get('/subscription', ApiController::class . ':channel_subscription')->setName('api_channel_subscription');
    });

    // html render, make this obsolete some day
    // $group->get('/render/menu', ApiController::class . ':render_menu')->setName('api_render_menu');
    // $group->get('/render/streamer/{username}', ApiController::class . ':render_streamer')->setName('api_render_streamer');
    // $group->get('/render/log/[{filename}]', ApiController::class . ':render_log')->setName('api_render_log');

    $group->get('/check_vods', ApiController::class . ':check_vods')->setName('check_vods');

    // job manipulation
    $group->get('/jobs/list', ApiController::class . ':jobs_list')->setName('api_jobs_list');
    $group->post('/jobs/kill/{job}', ApiController::class . ':jobs_kill')->setName('api_jobs_kill');

    // twitch api proxy
    $group->get('/twitchapi/videos/{username}', ApiController::class . ':twitchapi_videos')->setName('api_twitchapi_videos');
    $group->get('/twitchapi/video/{video_id}', ApiController::class . ':twitchapi_video')->setName('api_twitchapi_video');

    // settings
    $group->get('/settings/list', ApiController::class . ':settings_list')->setName('api_settings_list');
    $group->post('/settings/save', ApiController::class . ':settings_save')->setName('api_settings_save');

    $group->get('/favourites/list', ApiController::class . ':favourites_list')->setName('api_favourites_list');
    $group->post('/favourites/save', ApiController::class . ':favourites_save')->setName('api_favourites_save');

    $group->get('/games/list', ApiController::class . ':games_list')->setName('api_games_list');

    $group->get('/about', ApiController::class . ':about')->setName('api_about');

    /** @todo: rename */
    $group->group('/tools', function (RouteCollectorProxy $group) {
        $group->post('/fullvodburn', ApiController::class . ':tools_fullvodburn')->setName('api_tools_fullvodburn');
        $group->post('/voddownload', ApiController::class . ':tools_voddownload')->setName('api_tools_voddownload');
        $group->post('/chatdownload', ApiController::class . ':tools_chatdownload')->setName('api_tools_chatdownload');
    });

    $group->group('/subscriptions', function (RouteCollectorProxy $group) {
        $group->get('/sub', ApiController::class . ':subscriptions_sub')->setName('api_subscriptions_sub');
        $group->get('/list', ApiController::class . ':subscriptions_list')->setName('api_subscriptions_list');
        $group->get('/unsub', ApiController::class . ':subscriptions_unsub')->setName('api_subscriptions_unsub');
    });

    // cronjobs
    /** @todo: rename */
    $group->group('/cron', function (RouteCollectorProxy $group) {
        $group->get('/check_deleted_vods', CronController::class . ':check_deleted_vods')->setName('cron_check_deleted_vods');
        $group->get('/check_muted_vods', CronController::class . ':check_muted_vods')->setName('cron_check_muted_vods');
        $group->get('/dump_playlists', CronController::class . ':dump_playlists')->setName('cron_dump_playlists');
        $group->get('/sub', CronController::class . ':sub')->setName('cron_sub');
    });

    $group->any('/hook', ApiController::class . ':hook')->setName('hook');

    $group->get('/log/{filename}[/{last_line}]', ApiController::class . ':display_log')->setName('api_display_log');

    // $group->post('/hook', ApiController::class . ':hook')->setName('hook_post');

    // $group->get('/playlist_dump/{username}', ApiController::class . ':playlist_dump')->setName('api_playlist_dump');
});

// api 404
$app->any('/api/{any:.*}', function (Request $request, Response $response, array $args) use ($app) {
    $response->getBody()->write(json_encode(['message' => 'Invalid API endpoint', 'status' => 'ERROR']));
    return $response->withStatus(404)->withHeader('Content-Type', 'application/json');
});

$app->any('/{any:.*}', function (Request $request, Response $response, array $args) use ($app) {
    $i = __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "public" . DIRECTORY_SEPARATOR . "index.html";
    
    if(!file_exists($i)){
        $response->getBody()->write("The frontend client is not installed. Please build or download it and place it in the public/ directory.");
        return $response->withStatus(500);
    }

    $contents = file_get_contents($i);
    
    // $contents = str_replace('href="/js', 'href="' . TwitchConfig::cfg('basepath') . '/js', $contents);
    // $contents = str_replace('src="/js', 'src="' . TwitchConfig::cfg('basepath') . '/js', $contents);
    // $contents = str_replace('href="/css', 'href="' . TwitchConfig::cfg('basepath') . '/css', $contents);
    
    // $contents = str_replace('/assets/', TwitchConfig::cfg('basepath') . '/assets/', $contents);
    // $contents = str_replace('</head>', '<script>window.BASE_URL = "' . TwitchConfig::cfg('basepath') . '";</script></head>', $contents);

    $response->getBody()->write($contents);
    return $response;
});



// $app->get('/dialog/{type}/{text}', DebugController::class . ':dialog')->setName('dialog');

// tools
/*
$app->group('/tools', function (RouteCollectorProxy $group) {
    $group->get('', ToolsController::class . ':tools')->setName('tools');
    $group->post('/fullvodburn', ToolsController::class . ':page_fullvodburn')->setName('tools_fullvodburn');
    $group->post('/voddownload', ToolsController::class . ':page_voddownload')->setName('tools_voddownload');
    $group->post('/chatdownload', ToolsController::class . ':page_chatdownload')->setName('tools_chatdownload');
});
*/
