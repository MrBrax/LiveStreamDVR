<?php

include "class.php";

$streamers = TwitchConfig::getStreamers();

$action = $_GET['action'];

if( $action == 'delete' ){

    $key = $_POST['key'];

    $TwitchAutomator = new TwitchAutomator();
    $TwitchAutomator->unsub( $_POST['username'] );

    $json = json_decode( file_get_contents('config/config.json'), true );
    array_splice($json['streamers'], $key );
    file_put_contents('config/config.json', json_encode($json));

    header("Location: settings.php");
    return;

}

if( $action == 'create' ){

    $key = $_POST['key'];

    $username       = $_POST['username'];
    $quality        = $_POST['quality'];
    $match          = $_POST['match'];
    $download_chat  = $_POST['download_chat'];


    $streamer = [
        "username" => $username,
        "quality" => $quality
    ];

    if( $match ){
        $streamer["match"] = explode(",", $match);
    }

    if( $download_chat ){
        $streamer["download_chat"] = 1;
    }

    $json = json_decode( file_get_contents('config/config.json'), true );
    $json['streamers'][] = $streamer;
    file_put_contents('config/config.json', json_encode($json));

    $TwitchAutomator = new TwitchAutomator();
    $TwitchAutomator->sub( $username );

    header("Location: settings.php");
    return;

}

if( $action == 'update' ){

    $key = $_POST['key'];

    $username       = $_POST['username'];
    $quality        = $_POST['quality'];
    $match          = $_POST['match'];
    $download_chat  = $_POST['download_chat'];

    $streamer = [
        "username" => $username,
        "quality" => $quality
    ];

    if( $match ){
        $streamer["match"] = explode(",", $match);
    }

    if( $download_chat ){
        $streamer["download_chat"] = 1;
    }

    $json = json_decode( file_get_contents('config/config.json'), true );
    $json['streamers'][ $key ] = $streamer;
    file_put_contents('config/config.json', json_encode($json));

    header("Location: settings.php");
    return;

}

if( $action == 'settings' ){

    $vods_to_keep           = $_POST['vods_to_keep'];
    $storage_per_streamer   = $_POST['storage_per_streamer'];
    $api_client_id          = $_POST['api_client_id'];
    $api_secret             = $_POST['api_secret'];

    $json = json_decode( file_get_contents('config/config.json'), true );

    $json['vods_to_keep'] = (int)$vods_to_keep;
    $json['storage_per_streamer'] = (int)$storage_per_streamer;
    if($api_client_id) $json['api_client_id'] = $api_client_id;
    if($api_secret) $json['api_secret'] = $api_secret;

    file_put_contents('config/config.json', json_encode($json));

    header("Location: settings.php");
    return;

}

?>

<html>
    <head>
        <title><?php echo TwitchConfig::cfg('app_name'); ?> - Settings</title>
        <link href="style.css" rel="stylesheet" />
    </head>
    <body>

        <div class="top-menu">
        <div class="top-menu-item title"><?php echo TwitchConfig::cfg('app_name'); ?></div>
        <div class="top-menu-item right">
            <a href="index.php">Dashboard</a>
            <a class="linkback" href="https://github.com/MrBrax/TwitchAutomator" target="_blank" rel="noreferrer">GitHub</a>
        </div>
    </div>

        <div class="container">

            <section class="section">

                <div class="section-title"><h1>Streamers</h1></div>

                <div class="section-content">

                    <?php foreach( $streamers as $i => $streamer ){ ?>

                        <div>
                            <h2><?php echo $streamer['username']; ?></h2>
                            <form method="POST" action="?action=update">
                                <input type="hidden" name="key" value="<?php echo $i; ?>" />
                                <input type="hidden" name="username" value="<?php echo $streamer['username']; ?>" />
                                <div class="control">
                                    <label><input class="input" type="text" name="quality" value="<?php echo $streamer['quality']; ?>" /> Quality</label>
                                    <div class="help">Separate by spaces, e.g. best 1080p 720p audio_only</div>
                                </div>
                                <div class="control">
                                    <label><input class="input" type="text" name="match" value="<?php echo join(",", $streamer['match']); ?>" /> Match keywords</label>
                                    <div class="help">Separate by commas, e.g. christmas,media share,opening,po box</div>
                                </div>
                                <div class="control">
                                    <label><input class="input" type="checkbox" name="download_chat" value="1" <?php echo $streamer['download_chat'] ? 'checked="checked"' : ''; ?>" /> Download chat</label><br><br>
                                </div>
                                <div class="control">
                                    <button class="button" type="submit">Save</button>
                                </div>
                            </form>
                            <form method="POST" action="?action=delete">
                                <input type="hidden" name="key" value="<?php echo $i; ?>" />
                                <input type="hidden" name="username" value="<?php echo $streamer['username']; ?>" />
                                <button class="button" type="submit">Delete</button> (no undo, no confirmation)
                            </form>
                        </div>

                        <hr />

                    <?php } ?>

                </div>

            </section>

            <section class="section">

                <div class="section-title"><h1>New streamer</h1></div>

                <div class="section-content">

                    <form method="POST" action="?action=create">
                        <div class="control">
                            <label><input class="input" type="text" name="username" value="" /> Username</label>
                            <div class="help">Streamer username, preferably case sensitive</div>
                        </div>
                        <div class="control">
                            <label><input class="input" type="text" name="quality" value="" /> Quality</label>
                            <div class="help">Separate by spaces, e.g. best 1080p 720p audio_only</div>
                        </div>
                        <div class="control">
                            <label><input class="input" type="text" name="match" value="" /> Match keywords</label>
                            <div class="help">Separate by commas, e.g. christmas,media share,opening,po box</div>
                        </div>
                        <div class="control">
                                    <label><input class="input" type="checkbox" name="download_chat" value="1" /> Download chat</label><br><br>
                                </div>
                        <div class="control">
                            <button class="button" type="submit">Create</button>
                        </div>
                    </form>
                    
                </div>

            </section>

            <section class="section">

                <div class="section-title"><h1>Settings</h1></div>

                <div class="section-content">

                    <form method="POST" action="?action=settings">
                        <div class="control">
                            <label><input class="input" type="text" name="app_name" value="<?php echo TwitchConfig::cfg('app_name'); ?>" /> App name</label>
                        </div>
                        <div class="control">
                            <label><input class="input" type="text" name="vods_to_keep" value="<?php echo TwitchConfig::cfg('vods_to_keep'); ?>" /> VODs to keep</label>
                        </div>
                        <div class="control">
                            <label><input class="input" type="text" name="storage_per_streamer" value="<?php echo TwitchConfig::cfg('storage_per_streamer'); ?>" /> Gigabytes of storage per streamer</label>
                        </div>
                        <div class="control">
                            <label><input class="input" type="text" name="api_client_id" value="" /> Twitch client ID (keep blank to not change)</label>
                        </div>
                        <div class="control">
                            <label><input class="input" type="text" name="api_secret" value="" /> Twitch secret (keep blank to not change)</label>
                        </div>
                        <div class="control">
                            <label><input class="input" type="text" name="vod_container" value="<?php echo TwitchConfig::cfg('vod_container', 'mp4'); ?>" /> VOD container (mp4/mkv)</label>
                        </div>
                        <div class="control">
                            <button class="button" type="submit">Save</button>
                        </div>
                    </form>

                    <hr>

                    <strong>Crontab example</strong><br>
                    <code>0 5 * * 1 curl <?php echo TwitchConfig::cfg('hook_callback'); ?></code>

                    <hr>
                    <strong>OAuth</strong><br>
                    <?php
                        $dt = new DateTime();
                        $dt->setTimestamp( filemtime("config/oauth.bin") );
                        echo 'Generated: ' . $dt->format("Y-m-d H:i:s") . '<br>';
                        $dt->add( new DateInterval("P60D") );
                        echo 'Expires: ' . $dt->format("Y-m-d H:i:s") . '<br>';

                        $tokenRefresh = time() - filemtime("config/oauth.bin") > TwitchHelper::$accessTokenRefresh;
                        $tokenExpire = time() - filemtime("config/oauth.bin") > TwitchHelper::$accessTokenExpire;

                        var_dump($tokenRefresh);
                        var_dump($tokenExpire);

                    ?>

                    
                </div>

            </section>

        </div>

    </body>

</html>