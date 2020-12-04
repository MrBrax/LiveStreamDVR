<?php

namespace App;

use Slim\Handlers\ErrorHandler;
use App\TwitchHelper;

class MyErrorHandler extends ErrorHandler
{
    protected function logError(string $error): void
    {
        TwitchHelper::log(TwitchHelper::LOG_FATAL, "PHP error, please check the logs!");
        // TwitchHelper::log(TwitchHelper::LOG_FATAL, "PHP error: {$error}");
    }
}
