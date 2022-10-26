# LiveStreamDVR Webhooks

JSON format. `action` key contains the action (headers below).

## chapter_update
| Key     | Type          | Description  |
|---------|---------------|--------------|
| chapter | array         | Chapter data |
| vod     | App\TwitchVOD | Assigned VOD |

## start_download
| Key     | Type          | Description  |
|---------|---------------|--------------|
| vod     | App\TwitchVOD | Assigned VOD |

When the download operation begins. Before capturing starts.

## end_download
| Key     | Type          | Description  |
|---------|---------------|--------------|
| vod     | App\TwitchVOD | Assigned VOD |

At the end of the entire download. After capture and conversion.

## start_convert
| Key     | Type          | Description  |
|---------|---------------|--------------|
| vod     | App\TwitchVOD | Assigned VOD |

Just at the start of conversion of the video.

## end_convert
| Key     | Type          | Description  |
|---------|---------------|--------------|
| vod     | App\TwitchVOD | Assigned VOD |
| success | boolean       | Success?     |

Just at the end of conversion of the video.

## start_capture
| Key     | Type          | Description  |
|---------|---------------|--------------|
| vod     | App\TwitchVOD | Assigned VOD |

Just at the start of capture with probably streamlink.

## end_capture
| Key     | Type          | Description  |
|---------|---------------|--------------|
| vod     | App\TwitchVOD | Assigned VOD |
| success | boolean       | Success?     |

Just at the end of capture with probably streamlink.

## config_save
When the config is saved

## chat_download
## vod_download

## notify
| Key     | Type          | Description  |
|---------|---------------|--------------|
| text    | string        | Alert text   |

## test
