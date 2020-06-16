# TwitchAutomator

*Note that this thing is written without a framework or any real standards, so the code is pretty messy. Might refactor it one day with html templates and such.*

Configure using the `config.json` file in the `config` directory, not `.env`, it's outdated.

Needs python `streamlink`, `youtube-dl`, and `tcd` to fully work.

Denying access in your webserver to the `config` directory is highly recommended.

## Features
- Automatic VOD recording pretty much the second the stream goes live, instead of checking it every minute like many other scripts do
- Basic video cutter with chapter display for easy exporting
- Writes a [losslesscut](https://github.com/mifi/lossless-cut/) compatible csv file for the full VOD so you don't have to find all the games.
- Uses `ts` instead of `mp4` so if the stream or program crashes, the file won't be corrupted
- Can be set to automatically download the whole stream chat to a JSON file, to be used in my [twitch-vod-chat](https://github.com/MrBrax/twitch-vod-chat) webapp.

## Some config help

`bin_dir`

where streamlink, youtube-dl, and tcd is installed with python

---
`hook_callback`

full url of where the webhook from twitch should post to

---
`vods_to_keep`
`storage_per_streamer`

vods per streamer and gigabytes per streamer to keep at one time before removing the oldest ones

---
`download_chat`

automatically download vod chat after capturing is completed