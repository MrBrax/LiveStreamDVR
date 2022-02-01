<?php

declare(strict_types=1);

if (version_compare(PHP_VERSION, '7.4.0', '<')) {
    die("PHP needs to be at least on version 7.4.0, your version: " . PHP_VERSION . "\n");
}

require_once __DIR__ . '/../vendor/autoload.php';

ini_set('memory_limit', '1024M');

use Slim\Psr7\Request;
use Slim\Psr7\Response;
use App\TwitchConfig;
use App\TwitchHelper;
use DI\Container;
use Slim\Factory\AppFactory;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;

// Create Container
$container = new Container();
AppFactory::setContainer($container);


// Create App
$app = AppFactory::create();

$app->addBodyParsingMiddleware();

$app->addRoutingMiddleware();

// base path
if (TwitchConfig::cfg('basepath')) {
    $app->setBasePath(TwitchConfig::cfg('basepath'));
}

// this seems cool, but i have no idea how to access it later :(
$container->set('guzzle', function () {
    return new \GuzzleHttp\Client([
        'base_uri' => 'https://api.twitch.tv',
        'headers' => [
            'Client-ID' => TwitchConfig::cfg('api_client_id'),
            'Content-Type' => 'application/json',
            'Authorization' => 'Bearer ' . TwitchHelper::getAccessToken(),
        ]
    ]);
});

// authentication
if (TwitchConfig::cfg('password')) {
    $app->add(new Tuupola\Middleware\HttpBasicAuthentication([
        "path" => ["/"],
        "ignore" => [
            "/api/v0/hook",
            "/api/v0/cron/sub",
            "/api/v0/cron/check_muted_vods",
            "/api/v0/cron/check_deleted_vods",
            "/api/v0/cron/playlist_dump"
        ],
        "realm" => "Protected",
        "secure" => TwitchConfig::cfg('password_secure', true) == true,
        "users" => [
            "admin" => TwitchConfig::cfg('password')
        ]
    ]));
}

// debug settings
if (TwitchConfig::cfg('debug', false)) {
    // TwitchHelper::log( TwitchHelper::LOG_DEBUG, "Enabling debugging settings for slim..." );
    //$container->get('view')->getEnvironment()->addExtension(new DebugExtension());
    $errorMiddleware = $app->addErrorMiddleware(true, true, true);

    /*
    $debugMiddleware = function (Request $request, RequestHandler $handler) {
        TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "automator", ">>> {$request->getUri()} <<< accessed.");
        $response = $handler->handle($request);    
        return $response;
    };

    $app->add($debugMiddleware);
    */

} else {
    // $myErrorHandler = new MyErrorHandler($app->getCallableResolver(), $app->getResponseFactory());
    // $errorMiddleware = $app->addErrorMiddleware(true, true, true);
    // $errorMiddleware->setDefaultErrorHandler($myErrorHandler);
}

require __DIR__ . "/../src/Routes/routes.php";

// Run app
$app->run();
