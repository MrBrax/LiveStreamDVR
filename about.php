<?php

include "class.php";

echo '<html>';
    
    echo '<head>';
        echo ' <meta name="referrer" content="no-referrer" />';
        echo '<title>' . TwitchConfig::cfg('app_name') . '</title>';
        echo '<link href="style.css" rel="stylesheet" />';
    echo '</head>';

    echo '<body>';

        echo '<div class="container">';

            echo '<section class="section">';

                echo '<div class="section-content">';

                    echo '<h1>Utilities status</h1>';

                    echo '<strong>FFMpeg:</strong> ';
                    if( file_exists( TwitchConfig::cfg("ffmpeg_path") ) ){
                        $out = shell_exec( TwitchConfig::cfg("ffmpeg_path") . " -version");
                        $out = explode("\n", $out)[0];
                        echo $out;
                    }else{
                        echo 'Not installed.';
                    }

                    echo '<br><strong>Twitch chat downloader:</strong> ';
                    if( file_exists( TwitchHelper::path_tcd() ) ){
                        $out = shell_exec( TwitchHelper::path_tcd() . " --version");
                        echo $out;
                    }else{
                        echo 'Not installed.';
                    }

                    echo '<br><strong>Streamlink:</strong> ';
                    if( file_exists( TwitchHelper::path_streamlink() ) ){
                        $out = shell_exec( TwitchHelper::path_streamlink() . " --version");
                        echo $out;
                    }else{
                        echo 'Not installed.';
                    }

                    echo '<br><strong>youtube-dl:</strong> ';
                    if( file_exists( TwitchHelper::path_youtubedl() ) ){
                        $out = shell_exec( TwitchHelper::path_youtubedl() . " --version");
                        echo $out;
                    }else{
                        echo 'Not installed.';
                    }

                    echo '<br><strong>Pipenv:</strong> ';
                    if( file_exists( TwitchHelper::path_pipenv() ) ){
                        $out = shell_exec( TwitchHelper::path_pipenv() . " --version");
                        echo $out;
                    }else{
                        echo 'Not installed';
                    }

                    echo TwitchConfig::cfg('pipenv') ? ', enabled.' : ', not enabled.';
                
                echo '</div>';

            echo '</section>';

        echo '</div>';

    echo '</body>';

echo '</html>';