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

    $username   = $_POST['username'];
    $quality    = $_POST['quality'];
    $match      = $_POST['match'];


    $streamer = [
        "username" => $username,
        "quality" => $quality
    ];

    if( $match ){
        $streamer["match"] = explode(",", $match);
    }


    $json = json_decode( file_get_contents('config/config.json'), true );
    $json['streamers'][] = $streamer;
    file_put_contents('config/config.json', json_encode($json));

    $TwitchAutomator = new TwitchAutomator();
    $TwitchAutomator->sub( $username );

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
        <div class="top-menu-item"><a href="index.php">Dashboard</a></div>
        <div class="top-menu-item right linkback"><a href="https://github.com/MrBrax/TwitchAutomator" target="_blank" rel="noreferrer">GitHub</a></div>
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
                                </div>
                                <div class="control">
                                    <label><input class="input" type="text" name="match" value="<?php echo join(",", $streamer['match']); ?>" /> Match keywords</label>
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

                    <?php } ?>

                </div>

            </section>

            <section class="section">

                <div class="section-title"><h1>New streamer</h1></div>

                <div class="section-content">

                    <form method="POST" action="?action=create">
                        <div class="control">
                            <label><input class="input" type="text" name="username" value="" /> Username</label>
                        </div>
                        <div class="control">
                            <label><input class="input" type="text" name="quality" value="" /> Quality</label>
                        </div>
                        <div class="control">
                            <label><input class="input" type="text" name="match" value="" /> Match keywords</label>
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
                            <button class="button" type="submit">Save</button>
                        </div>
                    </form>

                    <strong>Crontab example</strong>
                    <br><code>0 5 * * 1 curl <?php echo TwitchConfig::cfg('hook_callback'); ?></code>
                    
                </div>

            </section>

        </div>

    </body>

</html>