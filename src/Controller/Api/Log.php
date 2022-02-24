<?php

namespace App\Controller\Api;

use App\TwitchConfig;
use App\TwitchHelper;
use Slim\Psr7\Request;
use Slim\Psr7\Response;

class Log
{
    public function display_log(Request $request, Response $response, $args)
    {

        $log_lines = [];

        $current_log    = $args['filename'];
        $last_line      = isset($args['last_line']) ? $args['last_line'] : null;

        $filter = isset($_GET['filter']) ? $_GET['filter'] : null;

        $log_path = TwitchHelper::$logs_folder . DIRECTORY_SEPARATOR . $current_log . ".log.jsonline";
        $logs = array_map(function ($value) {
            return substr(basename($value), 0, 10);
        }, glob(TwitchHelper::$logs_folder . DIRECTORY_SEPARATOR . "*.jsonline"));

        $line_num = 0;

        if (file_exists($log_path)) {

            $handle = fopen($log_path, "r");
            if ($handle) {

                while (($raw_line = fgets($handle)) !== false) {

                    $line = json_decode($raw_line, true);

                    $line_num++;
                    if ($last_line && $line_num <= $last_line) continue;

                    if (!TwitchConfig::cfg("debug") && $line["level"] == 'DEBUG') continue;

                    // filter
                    if (isset($filter) && isset($line['module']) && $filter != $line['module']) {
                        continue;
                    }

                    if ($line["date"]) {
                        $dt = \DateTime::createFromFormat("U.u", (string)$line["date"]);
                        if (!$dt) $dt = \DateTime::createFromFormat("U", (string)$line["date"]);
                        if ($dt) {
                            $dt->setTimezone(TwitchConfig::$timezone);
                            $line['date_string'] = $dt->format("Y-m-d H:i:s.v");
                        } else {
                            $line['date_string'] = "ERROR:" . $line["date"];
                        }
                    } else {
                        $line['date_string'] = '???';
                    }

                    $log_lines[] = $line;
                }

                fclose($handle);
            }

            /*
            $json = json_decode(file_get_contents($log_path), true);

            if ($json) {
                
                foreach ($json as $line) {

                    $line_num++;
                    if($last_line && $line_num <= $last_line) continue;

                    if (!TwitchConfig::cfg("debug") && $line["level"] == 'DEBUG') continue;

                    // filter
                    if (isset($filter) && isset($line['module']) && $filter != $line['module']) {
                        continue;
                    }

                    if ($line["date"]) {
                        $dt = \DateTime::createFromFormat("U.u", (string)$line["date"]);
                        if (!$dt) $dt = \DateTime::createFromFormat("U", (string)$line["date"]);
                        if ($dt) {
                            $dt->setTimezone(TwitchConfig::$timezone);
                            $line['date_string'] = $dt->format("Y-m-d H:i:s.v");
                        } else {
                            $line['date_string'] = "ERROR:" . $line["date"];
                        }
                    } else {
                        $line['date_string'] = '???';
                    }

                    $log_lines[] = $line;
                }
            }
            */
        }

        $payload = json_encode([
            'data' => [
                'lines' => $log_lines,
                'last_line' => $line_num,
                'logs' => $logs,
            ],
            'status' => 'OK'
        ]);

        $response->getBody()->write($payload);
        return $response->withHeader('Content-Type', 'application/json');
    }
}
