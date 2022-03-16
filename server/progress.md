[x] GET /vod/{basename}
[ ] POST /vod/{basename}/search_chatdump
[ ] POST /vod/{basename}/download_chat
[ ] POST /vod/{basename}/download
[ ] POST /vod/{basename}/check_mute
[ ] POST /vod/{basename}/delete
[?] POST /vod/{basename}/save
[ ] POST /vod/{basename}/cut
[ ] POST /vod/{basename}/renderwizard
[ ] POST /vod/{basename}/unbreak

[x] GET /api/v0/channels
[?] POST /api/v0/channels

[x] GET /api/v0/channels/{login}
[?] PUT /api/v0/channels/{login}
[?] DELETE /api/v0/channels/{login}
[ ] GET /api/v0/channels/{login}/force_record
[ ] GET /api/v0/channels/{login}/dump_playlist
[ ] GET /api/v0/channels/{login}/subscription
[ ] GET /api/v0/channels/{login}/download/{video_id}

[?] GET /api/v0/jobs
[?] DELETE /api/v0/jobs/{job}

[ ] GET /api/v0/twitchapi/videos/{login}
[ ] GET /api/v0/twitchapi/video/{video_id}

[x] GET /api/v0/settings
[?] PUT /api/v0/settings

[?] GET /api/v0/favourites
[?] PUT /api/v0/favourites

[x] GET /api/v0/games

[x] GET /api/v0/about

// [ ] GET /api/v0/tools/fullvodburn
[ ] GET /api/v0/tools/voddownload
[ ] GET /api/v0/tools/chatdownload
[ ] GET /api/v0/tools/playlist_dump/{username}
[ ] GET /api/v0/tools/check_vods

[x] GET /subscriptions
[?] POST /subscriptions
[ ] POST /subscriptions/{id}
[?] DELETE /subscriptions/{id}

[?] GET /api/v0/cron/check_deleted_vods
[?] GET /api/v0/cron/check_muted_vods
[ ] GET /api/v0/cron/dump_playlists

[x] GET /api/v0/hook

[x] GET /api/v0/log/{filename}/{last_line}


[x] = implemented
[?] = not tested
[ ] = to do