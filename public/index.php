<?php

require_once __DIR__ . '/../vendor/autoload.php';

use App\Controller\AboutController;
use App\Controller\DashboardController;
use App\Controller\HookController;
use App\Controller\VodController;
use App\Controller\PlayerController;
use App\Controller\SettingsController;
use App\Controller\SubController;
use App\TwitchConfig;
use App\TwitchHelper;
use DI\Container;
use Slim\Factory\AppFactory;
use Slim\Views\Twig;
use Slim\Views\TwigMiddleware;
use Twig\Extension\DebugExtension;
use Twig\TwigFilter;

use Slim\Psr7\Request;
use Slim\Psr7\Response;

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

$app->get('/player', PlayerController::class . ':player')->setName('player');
$app->post('/cut', VodController::class . ':cut')->setName('cut');
$app->get('/chat', VodController::class . ':chat')->setName('chat');
$app->get('/save', VodController::class . ':save')->setName('save');
$app->get('/delete', VodController::class . ':delete')->setName('delete');
$app->get('/convert', VodController::class . ':convert')->setName('convert');

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
        $TwitchAutomator = new App\TwitchAutomator();
        $TwitchAutomator->handle( $data );
    }else{
        $response->getBody()->write("No streams found for " . $args['username']);
    }
    return $response;
})->setName('force_record');


// Run app
$app->run();

