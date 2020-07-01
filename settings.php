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

    $username = $_POST['username'];
    $quality = $_POST['quality'];
    $match = $_POST['match'];


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

?>

<html>
    <head>
        <title><?php echo TwitchConfig::cfg('app_name'); ?> - Settings</title>
        <link href="style.css" rel="stylesheet" />
    </head>
    <body>

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
                                <input class="input" type="text" name="quality" value="<?php echo $streamer['quality']; ?>" /> Quality
                                <br><input class="input" type="text" name="match" value="<?php echo join(",", $streamer['match']); ?>" /> Match keywords
                                <br><button class="button" type="submit">Save</button>
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
                        <input class="input" type="text" name="username" value="" /> Username
                        <br><input class="input" type="text" name="quality" value="" /> Quality
                        <br><input class="input" type="text" name="match" value="" /> Match keywords
                        <br><button class="button" type="submit">Create</button>
                    </form>
                    
                </div>

            </section>

        </div>

    </body>

</html>