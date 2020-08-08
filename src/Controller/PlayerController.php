<?php

namespace App\Controller;

use Slim\Psr7\Request;
use Slim\Psr7\Response;

use Slim\Views\Twig;

use App\TwitchAutomator;
use App\TwitchConfig;
use App\TwitchHelper;
use App\TwitchVOD;

class PlayerController
{

    /**
     * @var Twig
     */
    private $twig;

    public function __construct(Twig $twig)
    {
        $this->twig = $twig;
    }

    public function player( Request $request, Response $response, $args )
    {

        $start_offset = isset($_GET['start']) ? $_GET['start'] : 0;

        $vod = mb_ereg_replace("([^\w\s\d\-_~,;\[\]\(\).])", '', $_GET['vod']);

        $vodclass = new TwitchVOD();
        $vodclass->load( TwitchHelper::vod_folder() . DIRECTORY_SEPARATOR . $vod . '.json');

        return $this->twig->render($response, 'player.twig', [
            'start_offset' => $start_offset,
            'vodclass' => $vodclass
        ]);

    }
}