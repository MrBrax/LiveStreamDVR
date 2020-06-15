# TwitchAutomator

Configure using the config.json file, not .env, it's outdated.

Needs python `streamlink`, `youtube-dl`, and `tcd` to fully work.

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