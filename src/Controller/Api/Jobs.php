<?php
declare(strict_types=1);
namespace App\Controller\Api;

use App\TwitchAutomatorJob;
use App\TwitchHelper;
use Slim\Psr7\Request;
use Slim\Psr7\Response;

class Jobs {
    public function jobs_list(Request $request, Response $response, $args)
    {

        $current_jobs_raw = glob(TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . "*.json");
        $current_jobs = [];
        foreach ($current_jobs_raw as $v) {
            // $pid = file_get_contents($v);
            $job = TwitchAutomatorJob::load(basename($v, ".json"));
            $job->getStatus();
            $current_jobs[] = $job;
        }

        $payload = json_encode([
            'data' => $current_jobs,
            'status' => 'OK'
        ]);

        $response->getBody()->write($payload);
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function jobs_kill(Request $request, Response $response, $args)
    {

        $job = TwitchAutomatorJob::load($args['job']);
        if ($job) {
            $out = $job->kill();
            $payload = json_encode([
                'data' => $out == '' ? true : $out,
                'status' => 'OK'
            ]);
        } else {
            $response->getBody()->write(json_encode([
                'error' => 'Failed loading job',
                'status' => 'ERROR'
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        $response->getBody()->write($payload);

        return $response->withHeader('Content-Type', 'application/json');
    }
}