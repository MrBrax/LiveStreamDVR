<?php

require( __DIR__ . "/../app/class.php");

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

                    echo '<table class="table">';

                        echo '<tr>';
                            echo '<th>Name</th>';
                            echo '<th>Path</th>';
                            echo '<th>Status</th>';
                        echo '</tr>';

                        echo '<tr>';

                            echo '<td>FFmpeg</td>';

                            echo '<td>' . TwitchConfig::cfg("ffmpeg_path") . '</td>';

                            echo '<td>';
                                if( file_exists( TwitchConfig::cfg("ffmpeg_path") ) ){
                                    $out = shell_exec( TwitchConfig::cfg("ffmpeg_path") . " -version");
                                    $out = explode("\n", $out)[0];
                                    echo $out;
                                }else{
                                    echo 'Not installed.';
                                }
                            echo '</td>';

                        echo '</tr>';

                        echo '<tr>';

                            echo '<td>Twitch chat downloader</td>';

                            echo '<td>' . TwitchHelper::path_tcd() . '</td>';

                            echo '<td>';

                                if( file_exists( TwitchHelper::path_tcd() ) ){
                                    $out = shell_exec( TwitchHelper::path_tcd() . " --version");
                                    echo $out;
                                }else{
                                    echo 'Not installed.';
                                }

                            echo '</td>';

                        echo '</tr>';

                        echo '<tr>';

                            echo '<td>Streamlink</td>';

                            echo '<td>' . TwitchHelper::path_streamlink() . '</td>';

                            echo '<td>';

                                if( file_exists( TwitchHelper::path_streamlink() ) ){
                                    $out = shell_exec( TwitchHelper::path_streamlink() . " --version");
                                    echo trim($out);
                                }else{
                                    echo 'Not installed.';
                                }

                            echo '</td>';

                        echo '</tr>';

                        echo '<tr>';

                            echo '<td>youtube-dl</td>';

                            echo '<td>' . TwitchHelper::path_youtubedl() . '</td>';

                            echo '<td>';

                                if( file_exists( TwitchHelper::path_youtubedl() ) ){
                                    $out = shell_exec( TwitchHelper::path_youtubedl() . " --version");
                                    echo trim($out);
                                }else{
                                    echo 'Not installed.';
                                }

                            echo '</td>';

                        echo '</tr>';

                        echo '<tr>';

                            echo '<td>Pipenv</td>';

                            echo '<td>' . TwitchHelper::path_pipenv() . '</td>';

                            echo '<td>';

                                if( file_exists( TwitchHelper::path_pipenv() ) ){
                                    $out = shell_exec( TwitchHelper::path_pipenv() . " --version");
                                    echo trim($out);
                                }else{
                                    echo 'Not installed';
                                }

                                echo TwitchConfig::cfg('pipenv') ? ', <em>enabled</em>.' : ', <em>not enabled</em>.';

                            echo '</td>';
                        
                        echo '</tr>';

                    echo '</table>';

                    echo '<hr />';
                    
                    echo '<code>';
                        echo 'pip install --user youtube-dl streamlink tcd pipenv';
                    echo '</code>';
                
                echo '</div>';

            echo '</section>';

        echo '</div>';

    echo '</body>';

echo '</html>';
