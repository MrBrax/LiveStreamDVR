<?php





use DI\Container;
use Slim\Factory\AppFactory;
use Slim\Views\Twig;
use Slim\Views\TwigMiddleware;

require __DIR__ . '/../app/class.php';

require __DIR__ . '/../vendor/autoload.php';

// Create Container
$container = new Container();
AppFactory::setContainer($container);

// Create Twig
// Set view in Container
$container->set('view', function() {
    return Twig::create('../templates', [
        'cache' => false,
        'debug' => true
    ]);
});

// Create App
$app = AppFactory::create();

// Add Twig-View Middleware
$app->add(TwigMiddleware::createFromContainer($app));

// config available everywhere
$container->get('view')->getEnvironment()->addGlobal('config', TwitchConfig::$config);

// test
$container->get('view')->getEnvironment()->addFilter( new \Twig\TwigFilter('formatBytes', function ($string) {
    return TwitchHelper::formatBytes( $string );
}));


$container->get('view')->getEnvironment()->addExtension(new \Twig\Extension\DebugExtension());
  
  
// Define named route

$app->get('/dashboard', function ($request, $response, $args) {

    $total_size = 0;

    $streamerListStatic = TwitchConfig::getStreamers();
    $streamerList = [];

    $is_a_vod_deleted = false;

    $checkvod = isset($_GET['checkvod']);

    foreach( $streamerListStatic as $streamer ){

        $data = $streamer;

        $data['vods_raw'] = glob( TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $streamer['username'] . "_*.json");
        
        $data['vods_list'] = [];

        $data['vods_size'] = 0;

        foreach( $data['vods_raw'] as $k => $v ){

            $vodclass = new TwitchVOD();
            $vodclass->load($v);

            if( $vodclass->is_recording ) $data['is_live'] = true;

            if( $checkvod && !$vodclass->is_recording ){
                $isvalid = $vodclass->checkValidVod();
                if(!$isvalid){
                    $is_a_vod_deleted = true;
                    echo '<!-- deleted: ' . $vodclass->basename . ' -->';
                }
            }

            if($vodclass->segments){
                foreach($vodclass->segments as $s){
                    $data['vods_size'] += filesize( TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . basename($s) );
                }
            }
            
            $data['vods_list'][] = $vodclass;

        }

        $streamerList[] = $data;

    }
    
    return $this->get('view')->render($response, 'dashboard.twig', [
        'streamerList' => $streamerList,
        'clips' => glob( TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . "clips" . DIRECTORY_SEPARATOR . "*.mp4"),
        'total_size' => $total_size,
        'is_a_vod_deleted' => $is_a_vod_deleted,
        'checkvod' => $checkvod
    ]);

})->setName('dashboard');

$app->get('/about', function ($request, $response, $args) {

    $bins = [];

    $bins['ffmpeg'] = [];
    $bins['ffmpeg']['path'] = TwitchConfig::cfg("ffmpeg_path");
    if( file_exists( TwitchConfig::cfg("ffmpeg_path") ) ){
        $out = shell_exec( TwitchConfig::cfg("ffmpeg_path") . " -version");
        $out = explode("\n", $out)[0];
        $bins['ffmpeg']['status'] = $out;
    }else{
        $bins['ffmpeg']['status'] = 'Not installed.';
    }


    $bins['tcd'] = [];
    $bins['tcd']['path'] = TwitchHelper::path_tcd();
    if( file_exists( TwitchHelper::path_tcd() ) ){
        $out = shell_exec( TwitchHelper::path_tcd() . " --version");
        $bins['tcd']['status'] = $out;
    }else{
        $bins['tcd']['status'] = 'Not installed.';
    }


    $bins['streamlink'] = [];
    $bins['streamlink']['path'] = TwitchHelper::path_streamlink();
    if( file_exists( TwitchHelper::path_streamlink() ) ){
        $out = shell_exec( TwitchHelper::path_streamlink() . " --version");
        $bins['streamlink']['status'] = trim($out);
    }else{
        $bins['streamlink']['status'] = 'Not installed.';
    }


    $bins['youtubedl'] = [];
    $bins['youtubedl']['path'] = TwitchHelper::path_youtubedl();
    if( file_exists( TwitchHelper::path_youtubedl() ) ){
        $out = shell_exec( TwitchHelper::path_youtubedl() . " --version");
        $bins['youtubedl']['status'] = trim($out);
    }else{
        $bins['youtubedl']['status'] = 'Not installed.';
    }


    $bins['pipenv'] = [];
    $bins['pipenv']['path'] = TwitchHelper::path_pipenv();
    if( file_exists( TwitchHelper::path_pipenv() ) ){
        $out = shell_exec( TwitchHelper::path_pipenv() . " --version");
        $bins['pipenv']['status'] = trim($out);
    }else{
        $bins['pipenv']['status'] = 'Not installed';
    }
    $bins['pipenv']['status'] .= TwitchConfig::cfg('pipenv') ? ', <em>enabled</em>.' : ', <em>not enabled</em>.';
    
    return $this->get('view')->render($response, 'about.twig', [
        'bins' => $bins
    ]);

})->setName('about');

$app->get('/settings', function ($request, $response, $args) {
    return $this->get('view')->render($response, 'settings.twig', [
        'streamers' => TwitchConfig::getStreamers(),
    ]);
})->setName('settings');

/*
$app->get('/hello/{name}', function ($request, $response, $args) {
    $view = Twig::fromRequest($request);
    return $view->render($response, 'profile.html', [
        'name' => $args['name']
    ]);
})->setName('profile');

// Render from string
$app->get('/hi/{name}', function ($request, $response, $args) {
    $view = Twig::fromRequest($request);
    $str = $view->fetchFromString(
        '<p>Hi, my name is {{ name }}.</p>',
        [
            'name' => $args['name']
        ]
    );
    $response->getBody()->write($str);
    return $response;
});
*/

// Run app
$app->run();
// TODO: make routes and views
