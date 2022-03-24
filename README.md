# TwitchAutomator

![1603661434863-wc](https://user-images.githubusercontent.com/1517911/97119662-fe1b0a80-1711-11eb-8f40-20c1690a01c9.png)

***⚠ SINCE MID 2021, A DOMAIN WITH HTTPS IS REQUIRED ⚠***

## Features
- Automatic VOD recording pretty much the second the stream goes live, instead of checking it every minute like many other scripts do.
- Cyclic recording, as in when a specified amount or storage per streamer is reached, the oldest stream gets deleted.
- Tons of metadata, maybe too much. Stores info about games played, stream titles, duration, if the stream got muted from copyrighted music, etc.
- [Video player](https://github.com/MrBrax/twitch-vod-chat) with chat playback.
- Video cutter with chapter display for easy exporting, also cuts the downloaded chat for synced rendering.
- Notifications with optional speech when the website is open, get stream live notifications far earlier than the mobile app does.
- Writes a [losslesscut](https://github.com/mifi/lossless-cut/) compatible csv file for the full VOD so you don't have to find all the games.
- Uses `ts` instead of `mp4` so if the stream or program crashes, the file won't be corrupted.
- Optionally either dumps chat while capturing (unstable) or downloads the chat file after it's done.
- Basic tools for downloading any VOD or chat.
- Can be set to automatically download the whole stream chat to a JSON file, to be used in my [twitch-vod-chat](https://github.com/MrBrax/twitch-vod-chat) webapp or automatically burned in with [TwitchDownloader](https://github.com/lay295/TwitchDownloader).
- Basic webhook support for external scripting.

*One high-profile streamer VOD of 10 hours at 1080p60 is about 30-50GB.*

Post issues/help on the issues tab above. I already run an up to date version, so starting fresh might break stuff.

## Docker setup

Reminder that i don't use docker myself on my capturing setup, so any specific errors to this are hard to test.


### Docker hub

1. Download the [docker-compose.yml](https://raw.githubusercontent.com/MrBrax/TwitchAutomator/master/docker-compose.yml) file and place it in a directory.
2. Run `docker-compose pull` and `docker-compose up -d` to start it.
3. Visit the webapp at `localhost:8082`
4. Check stored vods in the `/storage` directory. Permissions might be an issue.

Hub: https://hub.docker.com/r/mrbrax/twitchautomator

*The dockerhub build is preconfigured to be hosted at the root (`/`) and such, does not work when placed in a subdirectory.*

### Manual build
Run `docker-compose up --build -d` in the app directory. The `docker-compose.yml` file is required.

If you want the public webapp to have a custom base folder, you must provide `BASE_URL` and `VUE_APP_BASE_URL` in the environment variable settings.

## Standalone setup

1. Place the downloaded files in a separate folder from your www directory.
2. Enter the root folder and run `pip install -r requirements.txt`
3. Enter the `/client-vue` folder and run `yarn install` and `yarn run build`.
4. Enter the `/server` folder and run `yarn install` and `yarn run build`.

5. In the `/server` folder, run `yarn run start` to start the server in production mode.
6. Go to the settings page and set up basic stuff, get api key from twitch dev site.
7. Check the About page for subscription status.
8. Optionally add cronjobs shown on the settings page.
9. Check stored vods in the `/storage` directory. Permissions might be an issue.


Follow this guide to hackjob nginx: https://serversforhackers.com/c/nginx-php-in-subdirectory

### Main requirements
- HTTPS enabled with a valid certificate on the default port 443
- Python 3.7+
- [pip](https://pypi.org/project/pip/)
- [FFmpeg](https://ffmpeg.org/download.html)
- [MediaInfo](https://mediaarea.net/en/MediaInfo)
- [TwitchDownloader](https://github.com/lay295/TwitchDownloader) (optional for chat burning)
- [node.js](https://nodejs.org/) (optional, for live chat dumping)
- Public facing webserver (nginx, apache, etc) for reverse proxy (optional)

### pip packages
- [streamlink](https://github.com/streamlink/streamlink) (required)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) (recommended)
- [pipenv](https://github.com/pypa/pipenv) (optional, experimental)
