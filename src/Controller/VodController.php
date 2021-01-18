<?php

declare(strict_types=1);

namespace App\Controller;

use Slim\Psr7\Request;
use Slim\Psr7\Response;

use App\TwitchAutomator;
use App\TwitchConfig;
use App\TwitchHelper;
use App\TwitchVOD;
use App\TwitchAutomatorJob;
use Slim\Views\Twig;

use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;

class VodController
{

    /**
     * @var Twig
     */
    private $twig;

    public function __construct(Twig $twig)
    {
        $this->twig = $twig;
    }

    /*
    public function convert(Request $request, Response $response, $args)
    {

        $vod = $args['vod'];
        // $vod = mb_ereg_replace("([^\w\s\d\-_~,;\[\]\(\).])", '', $_GET['vod']);
        $username = explode("_", $vod)[0];

        $vodclass = new TwitchVOD();
        $vodclass->load(TwitchHelper::vodFolder($username) . DIRECTORY_SEPARATOR . $vod . '.json');
        $vodclass->convert();

        $response->getBody()->write("VOD converted");

        return $response;
    }
    */

    public function troubleshoot(Request $request, Response $response, $args)
    {

        $vod = $args['vod'];
        // $vod = mb_ereg_replace("([^\w\s\d\-_~,;\[\]\(\).])", '', $_GET['vod']);
        $username = explode("_", $vod)[0];

        $vodclass = new TwitchVOD();
        $vodclass->load(TwitchHelper::vodFolder($username) . DIRECTORY_SEPARATOR . $vod . '.json');

        $issue = $vodclass->troubleshoot(isset($_GET['fix']));
        if ($issue) {
            $response->getBody()->write($issue['text']);
        } else {
            $response->getBody()->write("found nothing wrong");
        }

        if (isset($_GET['fix']) && $issue['fixable']) {
            $response->getBody()->write("<br>trying to fix!");
        }

        return $response;
    }
}
