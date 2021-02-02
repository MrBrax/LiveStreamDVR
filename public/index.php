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
use Slim\Views\Twig;
use Slim\Views\TwigMiddleware;
use Twig\Extension\DebugExtension;
use Twig\TwigFilter;
use Twig\Extra\Html\HtmlExtension;
use App\MyErrorHandler;

// Create Container
$container = new Container();
AppFactory::setContainer($container);

// Create Twig
$twigConfig = Twig::create(__DIR__ . '/../templates', [
    'cache' => TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . 'twig',
    'debug' => TwitchConfig::cfg('debug', false)
]);

// Set view in Container
$container->set('view', function () use ($twigConfig) {
    return $twigConfig;
});
// what
$container->set(Twig::class, $twigConfig);

// Create App
$app = AppFactory::create();

$app->addRoutingMiddleware();

// base path
if (TwitchConfig::cfg('basepath')) {
    $app->setBasePath(TwitchConfig::cfg('basepath'));
}

// what
$twig = TwigMiddleware::createFromContainer($app);

// Add Twig-View Middleware
$app->add($twig);

// html extension
$container->get('view')->getEnvironment()->addExtension(new HtmlExtension());

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

// timezone
if (TwitchConfig::cfg('timezone', 'UTC') != 'UTC') {
    $container->get('view')->getEnvironment()->getExtension(\Twig\Extension\CoreExtension::class)->setTimezone(TwitchConfig::cfg('timezone', 'UTC'));
}

// config available everywhere
$container->get('view')->getEnvironment()->addGlobal('config', TwitchConfig::$config);

// debug available everywhere
$container->get('view')->getEnvironment()->addGlobal('debug', TwitchConfig::cfg('debug', false));

// docker
$container->get('view')->getEnvironment()->addGlobal('is_docker', getenv('TCD_DOCKER') == 1);

// version
if (file_exists(__DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "package.json")) {
    $container->get('view')->getEnvironment()->addGlobal('app_version', json_decode(file_get_contents(__DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "package.json"))->version);
}

// format bytes
$container->get('view')->getEnvironment()->addFilter(new TwigFilter('formatBytes', function ($string) {
    return TwitchHelper::formatBytes((int)$string);
}));

// human duration
$container->get('view')->getEnvironment()->addFilter(new TwigFilter('humanDuration', function ($string) {
    return TwitchHelper::printHumanDuration((int)$string);
}));

// human duration 2
$container->get('view')->getEnvironment()->addFilter(new TwigFilter('humanRealDuration', function ($string) {
    return TwitchHelper::getNiceDuration((int)$string);
}));

// human duration
$container->get('view')->getEnvironment()->addFilter(new TwigFilter('twitchDuration', function ($string) {
    return TwitchHelper::getTwitchDuration((int)$string);
}));

// human date
$container->get('view')->getEnvironment()->addFilter(new TwigFilter('humanDate', function ($string) {
    return TwitchHelper::printHumanDate((int)$string);
}));

// basename, only for debug
$container->get('view')->getEnvironment()->addFilter(new TwigFilter('basename', function ($string) {
    return basename($string);
}));

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
    $container->get('view')->getEnvironment()->addExtension(new DebugExtension());
    $errorMiddleware = $app->addErrorMiddleware(true, true, true);
} else {
    // $myErrorHandler = new MyErrorHandler($app->getCallableResolver(), $app->getResponseFactory());
    // $errorMiddleware = $app->addErrorMiddleware(true, true, true);
    // $errorMiddleware->setDefaultErrorHandler($myErrorHandler);
}

require __DIR__ . "/../src/Routes/routes.php";

// Run app
$app->run();
