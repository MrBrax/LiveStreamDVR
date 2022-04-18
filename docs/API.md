# TwitchAutomator API
## Vod

### `GET /api/v0/vod/{basename}`
Return the stored information about the vod `basename`

### `POST /api/v0/vod/{basename}/search_chatdump`
#### POST parameters
|Name |Description            |
|-----|-----------------------|
|words|The words to search for|

Search the captured chatdump.

### `POST /api/v0/vod/{basename}/download_chat`
Download the chat to `{basename}.chat`

### `POST /api/v0/vod/{basename}/download`
Download the VOD to `{basename}_vod.mp4`

This file will be muted if twitch muted it too.

### `POST /api/v0/vod/{basename}/check_mute`
Check if the published VOD is muted.

### `POST /api/v0/vod/{basename}/full_burn`
Download the VOD if the captured one is muted, download the chat if it isn't downloaded, render the chat to video, then burn it to the VOD on new copy on disk.

### `POST /api/v0/vod/{basename}/renderwizard`
Burn the chat to the VOD on new copy on disk.
#### JSON parameters
| Name           | Type    | Description                                   |
|----------------|---------|-----------------------------------------------|
| chatWidth      | number  | Width of the chat in pixels                   |
| chatHeight     | number  | Height of the chat in pixels                  |
| renderChat     | boolean | Whether to render the chat                    |
| burnChat       | boolean | Whether to burn the chat                      |
| vodSource      | string  | The source of the VOD (downloaded, captured)  |
| chatSource     | string  | The source of the chat (downloaded, captured) |
| chatFont       | string  | The font to use for the chat                  |
| chatFontSize   | number  | The font size to use for the chat             |
| burnHorizontal | string  | Horizontal burn mode (left, right)            |
| burnVertical   | string  | Vertical burn mode (top, bottom)              |
| ffmpegPreset   | string  | The ffmpeg preset to use (slow, fast, etc)    |
| ffmpegCrf      | number  | The ffmpeg crf to use (e.g. 20)               |

Render chat to video.

### `POST /api/v0/vod/{basename}/delete`
Delete the VOD and all its metadata.

### `POST /api/v0/vod/{basename}/save`
Archive the VOD.

---

## Channels
### `GET /api/v0/channels`
List all channels and their vods

### `POST /api/v0/channels`
Add channel
#### JSON parameters
| Key           | Type    | Description   |
|---------------|---------|---------------|
| login         | string  | Channel login |
| quality       | string  | Quality       |
| match         | string  | Keyword match |
| download_chat | boolean | Download chat |
| burn_chat     | boolean | Burn chat     |
| no_capture    | boolean | Don't capture |

### `GET /api/v0/channels/{login}`
Get information on the channel itself

### `PUT /api/v0/channels/{login}`
Modify channel
#### JSON parameters
| Key           | Type    | Description   |
|---------------|---------|---------------|
| login         | string  | Channel login |
| quality       | string  | Quality       |
| match         | string  | Keyword match |
| download_chat | boolean | Download chat |
| burn_chat     | boolean | Burn chat     |
| no_capture    | boolean | Don't capture |

### `DELETE /api/v0/channels/{login}`
Delete channel

### `GET /api/v0/channels/{login}/force_record`
Force record the current stream

### `GET /api/v0/channels/{login}/dump_playlist`
Dump the stream from the playlist (vod)

### `GET /api/v0/channels/{login}/subscription`
Show the (webhook) subscription for the channel

---