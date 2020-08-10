<?php

require_once __DIR__ . '/../vendor/autoload.php';

use App\TwitchConfig;
use App\TwitchHelper;
use DI\Container;
use Slim\Factory\AppFactory;
use Slim\Views\Twig;
use Slim\Views\TwigMiddleware;
use Twig\Extension\DebugExtension;
use Twig\TwigFilter;

// Create Container
$container = new Container();
AppFactory::setContainer($container);

// Create Twig
// Set view in Container

$twigConfig = Twig::create( __DIR__ . '/../templates', [
    'cache' => __DIR__ . '/../cache',
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

if( TwitchConfig::cfg('basepath') ){
    $app->setBasePath( TwitchConfig::cfg('basepath') );
}

// Add Twig-View Middleware
$app->add(TwigMiddleware::createFromContainer($app));

// config available everywhere
$container->get('view')->getEnvironment()->addGlobal('config', TwitchConfig::$config);

// debug available everywhere
$container->get('view')->getEnvironment()->addGlobal('debug', TwitchConfig::cfg('debug', false));

// format bytes
$container->get('view')->getEnvironment()->addFilter(new TwigFilter('formatBytes', function ($string) {
    return TwitchHelper::formatBytes($string);
}));

// human duration
$container->get('view')->getEnvironment()->addFilter(new TwigFilter('humanDuration', function ($string) {
    return TwitchHelper::printHumanDuration($string);
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

