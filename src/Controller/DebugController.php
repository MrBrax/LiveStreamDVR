<?php

namespace App\Controller;

use Slim\Psr7\Request;
use Slim\Psr7\Response;
use Slim\Views\Twig;

class DebugController
{

    /**
     * @var Twig
     */
    private $twig;

    public function __construct(Twig $twig) {
        $this->twig = $twig;
    }

    /**
     * Cut up the vod
     *
     * @return void
     */
    public function dialog( Request $request, Response $response, $args ) {
        
        return $this->twig->render($response, 'dialog.twig', [
            'text' => $args['text'],
            'type' => $args['type']
        ]);
        
    }

}