# TwitchAutomator API

## `GET /api/v0/list`
Return all streamers with all their vods

## `GET /api/v0/vod/{basename}`
Return the stored information about the vod `basename`

## `GET /api/v0/vod/{basename}/search_chatdump`
### GET parameters
|Name |Description            |
|-----|-----------------------|
|words|The words to search for|

Search the captured chatdump.

## `GET /api/v0/vod/{basename}/download_chat`
Download the chat to `{basename}.chat`

## `GET /api/v0/vod/{basename}/download`
Download the VOD to `{basename}_vod.mp4`

This file will be muted if twitch muted it too.

## `GET /api/v0/vod/{basename}/check_mute`
Check if the published VOD is muted.

## `GET /api/v0/vod/{basename}/full_burn`

Download the VOD if the captured one is muted, download the chat if it isn't downloaded, render the chat to video, then burn it to the VOD on new copy on disk.

## `GET /api/v0/vod/{basename}/render_chat`
### GET parameters
|Name   |Description                                 |
|-------|--------------------------------------------|
|use_vod|Use downloaded VOD instead of captured video|

Render the downloaded chat to video.

## `GET /api/v0/vod/{basename}/delete`
Delete the VOD and all its metadata.

## `GET /api/v0/vod/{basename}/save`
Archive the VOD.