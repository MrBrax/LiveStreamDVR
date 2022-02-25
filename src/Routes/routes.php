<?php

declare(strict_types=1);

use App\Controller\Api\About;
use App\Controller\Api\Channel;
use App\Controller\Api\Channels;
use App\Controller\Api\Favourites;
use App\Controller\Api\Games;
use App\Controller\Api\Hook;
use App\Controller\Api\Jobs;
use App\Controller\Api\Log;
use App\Controller\Api\Settings;
use App\Controller\Api\Subscriptions;
use App\Controller\Api\Vod;
use App\Controller\Api\Tools;
use App\Controller\Api\Twitch;
use Slim\Psr7\Request;
use Slim\Psr7\Response;
use Slim\Routing\RouteCollectorProxy;

use App\Controller\ApiController;
use App\Controller\CronController;
use App\TwitchHelper;

/** @var \Slim\App $app  */

// api v0
$app->group('/api/v0', function (RouteCollectorProxy $group) {

    // vod manipulation
    $group->group('/vod/{vod}', function (RouteCollectorProxy $group) {
        $group->get('', Vod::class . ':vod')->setName('api_vod');
        $group->post('/search_chatdump', Vod::class . ':vod_search_chatdump')->setName('api_vod_search_chatdump');
        $group->post('/download_chat', Vod::class . ':vod_download_chat')->setName('api_vod_download_chat');
        $group->post('/download', Vod::class . ':vod_download')->setName('api_vod_download');
        $group->post('/check_mute', Vod::class . ':vod_check_mute')->setName('api_vod_check_mute');
        // $group->post('/full_burn', Vod::class . ':vod_full_burn')->setName('api_vod_full_burn');
        // $group->post('/render_chat', Vod::class . ':vod_render_chat')->setName('api_vod_render_chat');
        $group->post('/delete', Vod::class . ':vod_delete')->setName('api_vod_delete');
        $group->post('/save', Vod::class . ':vod_save')->setName('api_vod_save');
        // $group->post('/export', Vod::class . ':vod_export')->setName('api_vod_export');
        $group->post('/cut', Vod::class . ':vod_cut')->setName('api_vod_cut');
        $group->post('/renderwizard', Vod::class . ':vod_renderwizard')->setName('api_vod_renderwizard');
        $group->post('/unbreak', Vod::class . ':vod_unbreak')->setName('api_vod_unbreak');
    });

    // channels
    $group->group('/channels', function (RouteCollectorProxy $group) {

        $group->get('', Channels::class . ':channels_list')->setName('api_channels_list');
        $group->post('', Channels::class . ':channels_add')->setName('api_channels_add');

        // channel
        $group->group('/{login}', function (RouteCollectorProxy $group) {
            $group->get('', Channel::class . ':channel')->setName('api_channel');
            $group->put('', Channel::class . ':channels_update')->setName('api_channels_update');
            $group->delete('', Channel::class . ':channels_delete')->setName('api_channels_delete');

            $group->get('/force_record', Channel::class . ':channel_force_record')->setName('api_channel_force_record');
            $group->get('/dump_playlist', Channel::class . ':channel_dump_playlist')->setName('api_channel_dump_playlist');
            $group->get('/subscription', Channel::class . ':channel_subscription')->setName('api_channel_subscription');

            $group->get('/download/{video_id}', Channel::class . ':channel_download_video')->setName('api_channel_download_video');
        });
    });

    // job manipulation
    $group->group('/jobs', function (RouteCollectorProxy $group) {
        $group->get('', Jobs::class . ':jobs_list')->setName('api_jobs_list');
        $group->group('/{job}', function (RouteCollectorProxy $group) {
            $group->delete('', Jobs::class . ':jobs_kill')->setName('api_jobs_kill');
        });
    });

    // twitch api proxy
    $group->group('/twitchapi', function (RouteCollectorProxy $group) {
        $group->get('/videos/{login}', Twitch::class . ':twitchapi_videos')->setName('api_twitchapi_videos');
        $group->get('/video/{video_id}', Twitch::class . ':twitchapi_video')->setName('api_twitchapi_video');
    });

    // settings
    $group->group('/settings', function (RouteCollectorProxy $group) {
        $group->get('', Settings::class . ':settings_list')->setName('api_settings_list');
        $group->put('', Settings::class . ':settings_save')->setName('api_settings_save');
    });

    $group->group('/favourites', function (RouteCollectorProxy $group) {
        $group->get('', Favourites::class . ':favourites_list')->setName('api_favourites_list');
        $group->put('', Favourites::class . ':favourites_save')->setName('api_favourites_save');
    });

    $group->get('/games', Games::class . ':games_list')->setName('api_games_list');

    $group->get('/about', About::class . ':about')->setName('api_about');

    /** @todo: rename */
    $group->group('/tools', function (RouteCollectorProxy $group) {
        $group->post('/fullvodburn', Tools::class . ':tools_fullvodburn')->setName('api_tools_fullvodburn');
        $group->post('/voddownload', Tools::class . ':tools_voddownload')->setName('api_tools_voddownload');
        $group->post('/chatdownload', Tools::class . ':tools_chatdownload')->setName('api_tools_chatdownload');
        $group->get('/playlist_dump/{username}', Tools::class . ':playlist_dump')->setName('api_tools_playlist_dump');
        $group->get('/check_vods', Tools::class . ':check_vods')->setName('api_tools_check_vods');
    });

    $group->group('/subscriptions', function (RouteCollectorProxy $group) {
        $group->get('', Subscriptions::class . ':subscriptions_list')->setName('api_subscriptions_list');
        $group->post('', Subscriptions::class . ':subscriptions_suball')->setName('api_subscriptions_suball');
        $group->post('/{id}', Subscriptions::class . ':subscriptions_sub')->setName('api_subscriptions_sub');
        $group->delete('/{id}', Subscriptions::class . ':subscriptions_unsub')->setName('api_subscriptions_unsub');
    });

    // cronjobs
    /** @todo: rename */
    $group->group('/cron', function (RouteCollectorProxy $group) {
        $group->get('/check_deleted_vods', CronController::class . ':check_deleted_vods')->setName('cron_check_deleted_vods');
        $group->get('/check_muted_vods', CronController::class . ':check_muted_vods')->setName('cron_check_muted_vods');
        $group->get('/dump_playlists', CronController::class . ':dump_playlists')->setName('cron_dump_playlists');
        // $group->get('/sub', CronController::class . ':sub')->setName('cron_sub');
    });

    $group->any('/hook', Hook::class . ':hook')->setName('hook');

    $group->get('/log/{filename}[/{last_line}]', Log::class . ':display_log')->setName('api_display_log');

    $group->any('/test_webhook', function (Request $request, Response $response, array $args) {
        TwitchHelper::webhook([
            'action' => 'test'
        ]);
        $response->getBody()->write("Tested");
        return $response;
    });

    /*
    $group->any('/test_webhook_vod', function (Request $request, Response $response, array $args) {
        $c = new TwitchChannel();
        $c->load("sodapoppin");
        $v = $c->vods_list[0];
        TwitchHelper::webhook([
			'action' => 'end_download',
            'vod' => $v
		]);
        $response->getBody()->write("Tested");
        return $response;
    });
    */

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

    if (!file_exists($i)) {
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
