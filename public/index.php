<?php

require_once __DIR__ . '/../vendor/autoload.php';

ini_set('memory_limit','1024M');

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

// Create Container
$container = new Container();
AppFactory::setContainer($container);

// Create Twig
// Set view in Container

$twigConfig = Twig::create( __DIR__ . '/../templates', [
    'cache' => TwitchHelper::$cache_folder . DIRECTORY_SEPARATOR . 'twig',
    'debug' => TwitchConfig::cfg('debug', false)
]);

$container->set('view', function () use ($twigConfig) {
    return $twigConfig;
});

$container->set( Twig::class, $twigConfig );

// this seems cool, but i have no idea how to access it later :(
$container->set('guzzle', function(){
    return new \GuzzleHttp\Client([
        'base_uri' => 'https://api.twitch.tv',
        'headers' => [
            'Client-ID' => TwitchConfig::cfg('api_client_id'),
            'Content-Type' => 'application/json',
            'Authorization' => 'Bearer ' . TwitchHelper::getAccessToken(),
        ]
    ]);
});

// Create App
$app = AppFactory::create();

$app->addRoutingMiddleware();

if( TwitchConfig::cfg('basepath') ){
    $app->setBasePath( TwitchConfig::cfg('basepath') );
}

$twig = TwigMiddleware::createFromContainer($app);



// Add Twig-View Middleware
$app->add($twig);

// html extension
$container->get('view')->getEnvironment()->addExtension(new HtmlExtension());

// timezone
if( TwitchConfig::cfg('timezone', 'UTC') != 'UTC' ){
    $container->get('view')->getEnvironment()->getExtension(\Twig\Extension\CoreExtension::class)->setTimezone( TwitchConfig::cfg('timezone', 'UTC') );
}

// config available everywhere
$container->get('view')->getEnvironment()->addGlobal('config', TwitchConfig::$config);

// debug available everywhere
$container->get('view')->getEnvironment()->addGlobal('debug', TwitchConfig::cfg('debug', false));

// version
if( file_exists( __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "package.json" ) ) {
    $container->get('view')->getEnvironment()->addGlobal('app_version', json_decode( file_get_contents( __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "package.json" ) )->version );
}

// format bytes
$container->get('view')->getEnvironment()->addFilter(new TwigFilter('formatBytes', function ($string) {
    return TwitchHelper::formatBytes($string);
}));

// human duration
$container->get('view')->getEnvironment()->addFilter(new TwigFilter('humanDuration', function ($string) {
    return TwitchHelper::printHumanDuration($string);
}));

// human duration 2
$container->get('view')->getEnvironment()->addFilter(new TwigFilter('humanRealDuration', function ($string) {
    return TwitchHelper::getNiceDuration($string);
}));

// human duration
$container->get('view')->getEnvironment()->addFilter(new TwigFilter('twitchDuration', function ($string) {
    return TwitchHelper::getTwitchDuration($string);
}));

// human date
$container->get('view')->getEnvironment()->addFilter(new TwigFilter('humanDate', function ($string) {
    return TwitchHelper::printHumanDate($string);
}));

// basename, only for debug
$container->get('view')->getEnvironment()->addFilter(new TwigFilter('basename', function ($string) {
    return basename($string);
}));

// authentication
if( TwitchConfig::cfg('password') ){
    $app->add(new Tuupola\Middleware\HttpBasicAuthentication([
        "path" => ["/"],
        "ignore" => ["/hook", "/sub"],
        "realm" => "Protected",
        "users" => [
            "admin" => TwitchConfig::cfg('password')
        ]
    ]));
}

// debug settings
if( TwitchConfig::cfg('debug', false) ){
    // TwitchHelper::log( TwitchHelper::LOG_DEBUG, "Enabling debugging settings for slim..." );
    $container->get('view')->getEnvironment()->addExtension(new DebugExtension());
    $errorMiddleware = $app->addErrorMiddleware(true, true, true);
}

require __DIR__ . "/../src/Routes/routes.php";

// Run app
$app->run();

