# TwitchAutomator

![1603661434863-wc](https://user-images.githubusercontent.com/1517911/97119662-fe1b0a80-1711-11eb-8f40-20c1690a01c9.png)

## Features
- Automatic VOD recording pretty much the second the stream goes live, instead of checking it every minute like many other scripts do
- Tons of metadata, maybe too much. Stores info about games played, stream titles, duration, if the stream got muted from copyrighted music, etc.
- Basic video cutter with chapter display for easy exporting
- Writes a [losslesscut](https://github.com/mifi/lossless-cut/) compatible csv file for the full VOD so you don't have to find all the games.
- Uses `ts` instead of `mp4` so if the stream or program crashes, the file won't be corrupted
- Optionall either dumps chat while capturing (unstable) or downloads the chat file after it's done.
- Basic tools for downloading any VOD or chat.
- Can be set to automatically download the whole stream chat to a JSON file, to be used in my [twitch-vod-chat](https://github.com/MrBrax/twitch-vod-chat) webapp or automatically burned in with TwitchDownloader.

## Standalone setup

1. Place the downloaded files in a separate folder from your www directory.
2. Install dependencies with composer.
3. Install utilities with pip, see below
4. Point your webserver virtualhost to the `public` directory of this app, not the root.
5. Go to the settings page and set up basic stuff, get api key from twitch dev site
6. Visit `/sub` in your web browser to check that subscribing to the webhooks work.
7. Add cronjobs shown on the settings page.

Check `/subs` for subscription status.

**This thing requires a public facing webserver.**

Follow this guide to hackjob nginx: https://serversforhackers.com/c/nginx-php-in-subdirectory

Post issues/help on the issues tab above. I already run an up to date version, so starting fresh might break stuff.

When upgrading, delete the `twig` folder in the `cache` folder.

*One high-profile streamer VOD of 10 hours is about 30-50GB.*

### Main requirements
- PHP 7.4+
- Python 3.6
    - Python 3.7+ for tcd support
- [pip](https://pypi.org/project/pip/)
- [Composer](https://getcomposer.org/)
- [FFmpeg](https://ffmpeg.org/download.html)
- [Mediainfo](https://mediaarea.net/en/MediaInfo)
- [TwitchDownloader](https://github.com/lay295/TwitchDownloader) (optional for chat burning)

### pip packages
- [streamlink](https://github.com/streamlink/streamlink) (required)
- [youtube-dl](https://github.com/ytdl-org/youtube-dl) (recommended) (dmca'd, unfortunate)
- [tcd](https://pypi.org/project/tcd/) (optional)
- [pipenv](https://github.com/pypa/pipenv) (optional, experimental)

## Docker setup

Run `docker-compose up --build -d` or build it in beforehand. Not fully tested.

Docker hub: https://hub.docker.com/repository/docker/mrbrax/twitchautomator

Known issues:
- No cron jobs yet
- GLOB_BRACE issue?