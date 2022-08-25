<template>
    <div
        v-if="vod"
        ref="vod"
        :class="{
            video: true,
            'is-animated': store.clientCfg('animationsEnabled'),
            'is-recording': vod.is_capturing,
            'is-converting': vod.is_converting,
            'is-finalized': vod.is_finalized,
            'is-favourite': vod.hasFavouriteGame(),
        }"
    >
        <div :id="'vod_' + vod.basename" class="anchor"></div>

        <!-- title -->
        <div class="video-title" @click="minimized = !minimized">
            <div class="video-title-text">
                <h3>
                    <span class="icon"><fa icon="file-video"></fa></span>
                    <span class="video-date" :title="formatDate(vod.started_at)" v-if="vod.started_at">{{
                        store.clientCfg('useRelativeTime') ? humanDate(vod.started_at, true) : formatDate(vod.started_at)
                    }}</span>
                    <span class="video-sxe">
                        {{ vod.stream_season }}x{{ vod.stream_number }}
                    </span>
                    <span class="video-filename">{{ vod.basename }}</span>
                </h3>
            </div>
            <div class="video-title-actions">
                <fa :icon="!minimized ? 'chevron-up' : 'chevron-down'"></fa>
            </div>
        </div>

        <transition name="fadeHeight">
            <div class="video-content" v-if="!minimized">

                <!-- description -->
                <div class="video-description">
                    <!-- box art -->
                    <div class="boxart-carousel is-small" v-if="vod && vod.getUniqueGames()">
                        <div v-for="game in vod.getUniqueGames()" :key="game.id" class="boxart-item">
                            <img v-if="game.box_art_url" :title="game.name" :alt="game.name" :src="game.getBoxArtUrl(140, 190)" loading="lazy" />
                            <span v-else>{{ game.name }}</span>
                        </div>
                    </div>

                    <!-- comment -->
                    <div class="video-comment" v-if="vod.comment">
                        <p>{{ vod.comment }}</p>
                    </div>
                    <div v-else>
                        <p>
                            <a href="#" @click.prevent="editVodMenu ? (editVodMenu.show = true) : ''">
                                <fa icon="comment-dots"></fa>
                                {{ $t("vod.add_comment") }}
                            </a>
                        </p>
                    </div>

                    <!-- video info -->
                    <div v-if="vod.is_finalized" class="info-columns">
                        <div class="info-column">
                            <h4>{{ $t('vod.video-info.general') }}</h4>
                            <ul class="video-info">
                                <li>
                                    <strong>{{ $t('vod.video-info.webhook-duration') }}:</strong>
                                    {{ vod.getWebhookDuration() }}
                                </li>
                                <li v-if="vod.created_at">
                                    <strong>{{ $t('vod.video-info.created') }}:</strong>
                                    {{ formatDate(vod.created_at, "yyyy-MM-dd HH:mm:ss") }}
                                </li>
                                <li v-if="vod.started_at && showAdvanced">
                                    <strong>{{ $t('vod.video-info.went-live') }}:</strong>
                                    {{ formatDate(vod.started_at, "yyyy-MM-dd HH:mm:ss") }}
                                </li>
                                <li v-if="vod.capture_started && showAdvanced">
                                    <strong>{{ $t('vod.video-info.capture-launched') }}:</strong>
                                    {{ formatDate(vod.capture_started, "yyyy-MM-dd HH:mm:ss") }}
                                </li>
                                <li v-if="vod.capture_started2 && showAdvanced">
                                    <strong>{{ $t('vod.video-info.wrote-file') }}:</strong>
                                    {{ formatDate(vod.capture_started2, "yyyy-MM-dd HH:mm:ss") }}
                                </li>
                                <li v-if="vod.ended_at">
                                    <strong>{{ $t('vod.video-info.stream-end') }}:</strong>
                                    {{ formatDate(vod.ended_at, "yyyy-MM-dd HH:mm:ss") }}
                                </li>
                                <template v-if="vod.capture_started && vod.conversion_started">
                                    <li>
                                        <strong>{{ $t('vod.video-info.capture-start') }}:</strong>
                                        {{ formatDate(vod.capture_started, "yyyy-MM-dd HH:mm:ss") }}
                                    </li>
                                    <li>
                                        <strong>{{ $t('vod.video-info.conversion-start') }}:</strong>
                                        {{ formatDate(vod.conversion_started, "yyyy-MM-dd HH:mm:ss") }}
                                    </li>
                                </template>
                                <li v-if="vod.getDuration() && showAdvanced">
                                    <strong>{{ $t('vod.video-info.missing-from-captured-file') }}:</strong>
                                    <span class="px-1" v-if="vod.twitch_vod_duration">
                                        {{ humanDuration(vod.twitch_vod_duration - vod.getDuration()) }}
                                        <strong v-if="vod.twitch_vod_duration - vod.getDuration() > 600" class="is-error"><br />A lot missing!</strong>
                                    </span>
                                    <span class="px-1" v-else>
                                        <strong><em>No data</em></strong>
                                    </span>
                                </li>
                                <li>
                                    <strong>{{ $t('vod.video-info.chat-downloaded') }}:</strong>
                                    {{ vod.is_chat_downloaded ? $t('boolean.yes') : $t('boolean.no') }}
                                </li>
                                <li>
                                    <strong>{{ $t('vod.video-info.chat-dumped') }}:</strong>
                                    {{ vod.is_chatdump_captured ? $t('boolean.yes') : $t('boolean.no') }}
                                </li>
                                <li>
                                    <strong>{{ $t('vod.video-info.chat-rendered') }}:</strong>
                                    {{ vod.is_chat_rendered ? $t('boolean.yes') : $t('boolean.no') }}
                                </li>
                                <li>
                                    <strong>{{ $t('vod.video-info.chat-burned') }}:</strong>
                                    {{ vod.is_chat_burned ? $t('boolean.yes') : $t('boolean.no') }}
                                </li>
                            </ul>
                        </div>

                        <div class="info-column">
                            <h4>{{ $t('vod.video-info.capture') }}</h4>
                            <ul class="video-info">
                                <li v-if="vod.getDuration()">
                                    <strong>{{ $t('metadata.file-duration') }}:</strong>
                                    {{ humanDuration(vod.getDuration()) }}
                                </li>
                                <li v-if="vod.segments && vod.segments.length > 0 && vod.segments[0].filesize">
                                    <strong>Size:</strong>
                                    {{ formatBytes(vod.segments[0].filesize) }}
                                </li>
                                <template v-if="vod.video_metadata && vod.video_metadata.type == 'audio'">
                                    <li>
                                        <strong>Total:</strong>
                                        {{ Math.round(vod.video_metadata.bitrate / 1000) }}kbps
                                    </li>
                                    <li>
                                        <strong>Audio:</strong>
                                        {{ vod.video_metadata.audio_codec }}
                                        {{ vod.video_metadata.audio_bitrate_mode }}
                                        {{ Math.round(vod.video_metadata.audio_bitrate / 1000) }}kbps
                                    </li>
                                </template>
                                <template v-else-if="vod.video_metadata">
                                    <li>
                                        <strong>{{ $t('metadata.dimensions') }}:</strong>
                                        {{ vod.video_metadata.width }}x{{ vod.video_metadata.height }}
                                    </li>
                                    <li>
                                        <strong>{{ $t('metadata.framerate') }}:</strong>
                                        {{ vod.video_metadata.fps_mode }}
                                        {{ vod.video_metadata.fps }}
                                    </li>
                                    <li>
                                        <strong>{{ $t('metadata.total') }}:</strong>
                                        {{ Math.round(vod.video_metadata.bitrate / 1000) }}kbps
                                    </li>
                                    <li>
                                        <strong>{{ $t('metadata.video') }}:</strong>
                                        {{ vod.video_metadata.video_codec }}
                                        {{ vod.video_metadata.video_bitrate_mode }}
                                        {{ Math.round(vod.video_metadata.video_bitrate / 1000) }}kbps
                                    </li>
                                    <li>
                                        <strong>{{ $t('metadata.audio') }}:</strong>
                                        {{ vod.video_metadata.audio_codec }}
                                        {{ vod.video_metadata.audio_bitrate_mode }}
                                        {{ Math.round(vod.video_metadata.audio_bitrate / 1000) }}kbps
                                    </li>
                                </template>
                            </ul>
                        </div>

                        <!-- Twitch VOD -->
                        <div class="info-column">
                            <h4>Twitch VOD</h4>
                            <ul class="video-info">
                                <template v-if="vod.twitch_vod_exists === true">
                                    <li>
                                        <strong>{{ $t('vod.video-info.duration') }}:</strong>
                                        <span class="px-1" v-if="vod.twitch_vod_duration">{{ humanDuration(vod.twitch_vod_duration) }}</span>
                                        <span class="px-1" v-else>
                                            <strong><em>No data</em></strong>
                                        </span>
                                    </li>
                                    <li>
                                        <strong>{{ $t('vod.video-info.id') }}:</strong>
                                        <span class="px-1" v-if="vod.twitch_vod_id">
                                            <a :href="twitchVideoLink(vod.twitch_vod_id)" rel="noreferrer" target="_blank">{{ vod.twitch_vod_id }}</a>
                                            &nbsp;<a href="javascript:void(0)" @click="matchVod()"><fa icon="sync"></fa></a>
                                        </span>
                                        <span class="px-1" v-else>
                                            <strong><em>Not matched or VOD deleted</em></strong>
                                        </span>
                                    </li>
                                    <li>
                                        <strong>{{ $t('vod.video-info.date') }}:</strong>&#32;
                                        <span class="px-1" v-if="vod.twitch_vod_date">{{ formatDate(vod.twitch_vod_date) }}</span>
                                        <span class="px-1" v-else>
                                            <strong><em>No data</em></strong>
                                        </span>
                                    </li>
                                    <li>
                                        <strong>{{ $t('vod.video-info.title') }}:</strong>
                                        <span class="px-1 text-overflow" v-if="vod.twitch_vod_title">
                                            {{ vod.twitch_vod_title }}
                                        </span>
                                        <span class="px-1" v-else>
                                            <strong><em>No data</em></strong>
                                        </span>
                                    </li>
                                    <li>
                                        <strong>{{ $t('vod.video-info.is-muted') }}:</strong>
                                        <span class="px-1" v-if="vod.twitch_vod_muted === MuteStatus.MUTED"><strong class="is-error">{{ $t('boolean.yes') }}</strong></span>
                                        <span class="px-1" v-else-if="vod.twitch_vod_muted === MuteStatus.UNMUTED">{{ $t('boolean.no') }}</span>
                                        <span class="px-1" v-else><em>{{ $t('boolean.no-data') }}</em></span>
                                    </li>
                                </template>
                                <template v-else-if="vod.twitch_vod_exists === false">
                                    <li>
                                        <strong class="is-error">{{ $t('vod.video-info.vod-is-deleted') }}</strong>
                                        &nbsp;<a href="javascript:void(0)" @click="matchVod()" title="Retry VOD match"><fa icon="sync"></fa></a>
                                    </li>
                                    <li>
                                        <span v-if="vod.twitch_vod_id">
                                            The ID was <a :href="twitchVideoLink(vod.twitch_vod_id)" rel="noreferrer" target="_blank">{{ vod.twitch_vod_id }}</a>.
                                        </span>
                                        <span v-else>{{ $t('vod.video-info.the-vod-probably-never-got-saved') }}</span>
                                    </li>
                                </template>
                                <template v-else>
                                    <li>
                                        <em>{{ $t('vod.video-info.vod-has-not-been-checked') }}</em>
                                    </li>
                                </template>
                                <li>
                                    <strong>{{ $t('vod.video-info.downloaded') }}:</strong>
                                    {{ vod.is_vod_downloaded ? $t('boolean.yes') : $t('boolean.no') }}
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div v-if="vod.is_capturing" class="info-columns">
                        <div class="info-column">
                            <h4>Recording</h4>
                            <ul class="video-info">
                                <li v-if="vod.started_at"><strong>Went live:</strong> {{ formatDate(vod.started_at) }}</li>
                                <li v-if="vod.created_at"><strong>Created:</strong> {{ formatDate(vod.created_at) }}</li>
                                <li v-if="vod.capture_started && vod.started_at">
                                    <strong>Capture launched:</strong> {{ formatDate(vod.capture_started) }} ({{
                                        humanDuration((vod.capture_started.getTime() - vod.started_at.getTime()) / 1000)
                                    }}
                                    missing)
                                </li>
                                <li v-if="vod.capture_started2"><strong>Wrote file:</strong> {{ formatDate(vod.capture_started2) }}</li>
                                <li><strong>Current duration:</strong> <duration-display :startDate="vod.started_at" outputStyle="human"></duration-display></li>
                                <li><strong>Resolution:</strong> {{ vod.stream_resolution || "Unknown" }}</li>
                                <li><strong>Watch live:</strong> <a :href="'https://twitch.tv/' + vod.streamer_login" rel="noreferrer" target="_blank">Twitch</a></li>
                            </ul>
                            <!--<button class="button is-small is-danger" @click="unbreak">Unbreak</button>-->
                        </div>
                    </div>
                </div>

                <!-- segment list -->
                <div v-if="vod.is_finalized" class="video-segments">
                    <strong>{{ $t('vod.segments') }}</strong>
                    <ul class="list-segments">
                        <li v-for="segment in vod.segments" :key="segment.basename">
                            <a :href="vod?.webpath + '/' + segment.basename" target="_blank" @click.prevent="store.playMedia(vod?.webpath + '/' + segment.basename)">
                                <span class="text-overflow">{{ segment.basename }}</span>
                                <span v-if="!segment.deleted && segment.filesize"> ({{ formatBytes(segment.filesize) }}) </span>
                            </a>
                            <span v-if="segment.deleted">
                                <strong class="is-error">&nbsp;(deleted)</strong>
                            </span>
                            <span v-else-if="!segment.filesize">
                                <strong class="is-error">&nbsp;(filesize missing)</strong>
                            </span>
                        </li>

                        <li v-if="vod.is_vod_downloaded">
                            <a :href="vod.webpath + '/' + vod.basename + '_vod.mp4'" target="_blank" @click.prevent="store.playMedia(vod?.webpath + '/' + vod?.basename + '_vod.mp4')">Downloaded VOD</a>
                        </li>

                        <template v-if="vod.is_chat_rendered">
                            <li>
                                <a :href="vod.webpath + '/' + vod?.basename + '_chat.mp4'" target="_blank">Rendered chat</a>
                            </li>
                            <li>
                                <a :href="vod.webpath + '/' + vod?.basename + '_chat_mask.mp4'" target="_blank">Rendered chat mask</a>
                            </li>
                        </template>

                        <li v-if="vod.is_chat_burned">
                            <a :href="vod?.webpath + '/' + vod?.basename + '_burned.mp4'" target="_blank">Burned chat</a>
                        </li>
                    </ul>
                    <span v-if="vod.segments.length === 0">
                        <strong class="is-error">No segments found</strong>
                    </span>
                </div>

                <!-- bookmark list -->
                <div class="video-bookmarks">
                    <strong>{{ $t('vod.bookmarks') }}</strong>
                    <ul class="list-segments">
                        <li v-for="(bookmark, i) in vod.bookmarks" :key="i">
                            {{ formatDuration(bookmark.offset || 0) }} - {{ bookmark.name }}
                            <button @click="doDeleteBookmark(i)" class="icon-button">
                                <span class="icon"><fa icon="xmark" /></span>
                            </button>
                        </li>
                    </ul>
                    <!--
                    <details class="details">
                        <summary>Create</summary>
                        <div class="field">
                            <label class="label">Name</label>
                            <input class="input" type="text" v-model="newBookmark.name">
                        </div>
                        <div class="field" v-if="vod.is_finalized">
                            <label class="label">Offset</label>
                            <input class="input" v-model="newBookmark.offset" type="number">
                        </div>
                        <button class="button is-small is-confirm" @click="doMakeBookmark">
                            <span class="icon"><fa icon="plus" /></span>
                            <span>Create</span>
                        </button>
                    </details>
                    -->
                </div>

                <!-- controls -->
                <div class="video-controls buttons" v-if="vod.is_finalized">
                    <button :class="{ 'button': true, 'details-toggle': true, 'is-active': showAdvanced }" @click="showAdvanced = !showAdvanced" title="Show advanced">
                        <span class="icon">
                            <fa v-if="showAdvanced" icon="minus"></fa>
                            <fa v-else icon="plus"></fa>
                        </span>
                    </button>
                    <!-- Editor -->
                    <router-link v-if="vod.video_metadata && vod.video_metadata.type !== 'audio'" class="button is-blue" :to="{ name: 'Editor', params: { vod: vod?.basename } }">
                        <span class="icon"><fa icon="cut" type="fa"></fa></span>
                        <span>{{ $t('vod.controls.editor') }}</span>
                    </router-link>

                    <!-- Player -->
                    <a v-if="vod.is_chat_downloaded || vod.is_chatdump_captured" class="button is-blue" target="_blank" @click="playerMenu ? (playerMenu.show = true) : ''">
                        <span class="icon"><fa icon="play" type="fa"></fa></span>
                        <span>{{ $t('vod.controls.player') }}</span>
                    </a>

                    <!-- JSON -->
                    <a v-if="showAdvanced" class="button" :href="vod?.webpath + '/' + vod?.basename + '.json'" target="_blank">
                        <span class="icon"><fa icon="database" type="fa"></fa></span>
                        <span>JSON</span>
                    </a>

                    <!-- Archive -->
                    <a class="button" @click="doArchive">
                        <span class="icon">
                            <fa icon="archive" type="fa" v-if="!taskStatus.archive"></fa>
                            <fa icon="sync" type="fa" spin v-else></fa>
                        </span>
                        <span>{{ $t('vod.controls.archive') }}</span>
                    </a>

                    <!-- Download chat-->
                    <a v-if="vod.twitch_vod_id && !vod?.is_chat_downloaded" class="button" @click="chatDownloadMenu ? (chatDownloadMenu.show = true) : ''">
                        <span class="icon">
                            <fa icon="comments" type="fa" v-if="!taskStatus.downloadChat && !compDownloadChat"></fa>
                            <fa icon="sync" type="fa" spin v-else></fa>
                        </span>
                        <span>{{ $t('vod.controls.download-chat') }}</span>
                    </a>

                    <template v-if="vod.twitch_vod_id">
                        <!-- Download VOD -->
                        <a v-if="!vod.is_vod_downloaded" class="button" @click="vodDownloadMenu ? (vodDownloadMenu.show = true) : ''">
                            <span class="icon">
                                <fa icon="download" type="fa" v-if="!taskStatus.downloadVod"></fa>
                                <fa icon="sync" type="fa" spin v-else></fa>
                            </span>
                            <span v-if="vod.twitch_vod_muted == MuteStatus.MUTED">{{ $t('vod.controls.download-vod-muted') }}</span>
                            <span v-else>{{ $t('vod.controls.download-vod') }}</span>
                        </a>
                        <!-- Check mute -->
                        <a v-if="showAdvanced" class="button" @click="doCheckMute">
                            <span class="icon">
                                <fa icon="volume-mute" type="fa" v-if="!taskStatus.vodMuteCheck"></fa>
                                <fa icon="sync" type="fa" spin v-else></fa>
                            </span>
                            <span>{{ $t('vod.controls.check-mute') }}</span>
                        </a>
                    </template>

                    <a
                        class="button"
                        @click="burnMenu ? (burnMenu.show = true) : ''"
                        v-if="vod.video_metadata && vod.video_metadata.type !== 'audio'"
                    >
                        <span class="icon">
                            <fa icon="burn" type="fa"></fa>
                        </span>
                        <span>{{ $t('vod.controls.render-menu') }}</span>
                    </a>

                    <!-- Fix issues -->
                    <a v-if="showAdvanced" class="button" @click="doFixIssues">
                        <span class="icon">
                            <fa icon="wrench" type="fa"></fa>
                        </span>
                        <span>{{ $t('vod.controls.fix-issues') }}</span>
                    </a>

                    <!-- Vod export menu -->
                    <button v-if="showAdvanced" class="button is-confirm" @click="exportVodMenu ? (exportVodMenu.show = true) : ''">
                        <span class="icon">
                            <fa icon="upload" type="fa"></fa>
                        </span>
                        <span>{{ $t('buttons.export') }}</span>
                    </button>

                    <!-- Vod edit menu -->
                    <button v-if="showAdvanced" class="button is-confirm" @click="editVodMenu ? (editVodMenu.show = true) : ''">
                        <span class="icon">
                            <fa icon="pencil" type="fa"></fa>
                        </span>
                        <span>{{ $t('buttons.edit') }}</span>
                    </button>

                    <!-- Delete -->
                    <button class="button is-danger" @click="doDelete" :disabled="vod.prevent_deletion">
                        <span class="icon">
                            <fa icon="trash" type="fa" v-if="!taskStatus.delete"></fa>
                            <fa icon="sync" type="fa" spin v-else></fa>
                        </span>
                        <span>{{ $t('buttons.delete') }}</span>
                    </button>
                </div>

                <div class="video-error" v-if="vod.failed && !vod.is_finalized && !vod.is_capturing">
                    <strong>
                        <span class="icon"><fa icon="exclamation-triangle"></fa></span> {{ $t('vod.failed') }}
                    </strong>&nbsp;
                    <!-- Delete -->
                    <button class="button is-danger is-small" @click="doDelete" :disabled="vod.prevent_deletion">
                        <span class="icon">
                            <fa icon="trash" type="fa" v-if="!taskStatus.delete"></fa>
                            <fa icon="sync" type="fa" spin v-else></fa>
                        </span>
                        <span>{{ $t('buttons.delete') }}</span>
                    </button>
                </div>
                <div class="video-status" v-else-if="!vod.is_finalized">
                    <template v-if="vod.is_converting">
                        <em>
                            <span class="icon"><fa icon="file-signature"></fa></span>
                            Converting <strong>{{ vod.basename }}.ts</strong> to <strong>{{ vod.basename }}.mp4</strong>
                        </em>
                        <br />
                        <em>
                            <span v-if="vod.getConvertingStatus()">
                                <span class="icon"><fa icon="sync" spin></fa></span>
                                Running (pid {{ vod.getConvertingStatus() }})
                            </span>
                            <span v-else>
                                <strong class="is-error flashing">
                                    <span class="icon"><fa icon="exclamation-triangle"></fa></span> Not running, did it crash?
                                </strong>
                            </span>
                        </em>
                    </template>
                    <template v-else-if="vod && vod.is_capturing">
                        <em class="text-overflow">
                            <span class="icon"><fa icon="video"></fa></span>
                            Capturing to <strong>{{ vod.basename }}.ts</strong> (<strong>{{
                                vod.getRecordingSize() ? formatBytes(vod.getRecordingSize() as number) : "unknown"
                            }}</strong
                            >)
                            <span class="icon clickable" title="Refresh" @click="vod && store.fetchAndUpdateVod(vod.basename)"><fa icon="sync"></fa></span>
                        </em>

                        <br />

                        <template v-if="store.cfg('playlist_dump')">
                            <em>
                                <span v-if="vod.getCapturingStatus()">
                                    <span class="icon"><fa icon="sync" spin></fa></span>
                                    Video capture running (pid
                                    {{ vod.getCapturingStatus() }})
                                </span>
                                <span v-else>
                                    <strong class="is-error flashing">
                                        <span class="icon"><fa icon="exclamation-triangle"></fa></span>
                                        Video capture not running, did it crash?
                                    </strong>
                                </span>
                            </em>
                            <template v-if="store.cfg('chat_dump')">
                                <br /><em>
                                    <span v-if="vod.getChatDumpStatus()">
                                        <span class="icon"><fa icon="sync" spin></fa></span>
                                        Chat dump running (pid
                                        {{ vod.getChatDumpStatus() }})
                                    </span>
                                    <span v-else>
                                        <strong class="is-error flashing">
                                            <span class="icon"><fa icon="exclamation-triangle"></fa></span>
                                            Chat dump not running, did it crash?
                                        </strong>
                                    </span>
                                </em>
                            </template>
                        </template>
                    </template>
                    <template v-else-if="!vod.is_capturing && !vod.is_converting && !vod.is_finalized">
                        <em>Waiting to finalize video (since {{ vod.ended_at ? formatDate(vod.ended_at, "yyyy-MM-dd HH:mm:ss") : "(unknown)" }})</em>
                    </template>
                    <template v-else>
                        <em>No video file or error</em>
                    </template>
                </div>

                <!-- capture length warning -->
                <div v-if="vod.is_capturing && vod.getDurationLive() > 86400" class="video-error">
                    {{ $t('vod.capture-has-been-running-for-over-24-hours-streamlink-does-not-support-this-is-the-capture-stuck') }}
                </div>

                <!-- no chapters error -->
                <div v-if="!vod.chapters" class="video-error">No chapter data!?</div>

                <!-- troubleshoot error -->
                <!--
                {% if vodclass.troubleshoot %}
                    <div class="video-error">
                        {{ vodclass.troubleshoot.text }}
                        {% if vodclass.troubleshoot.fixable %}<br /><a href="{{ url_for('troubleshoot', { 'vod': vodclass.basename }) }}?fix=1">Try to fix</a>{% endif %}
                    </div>
                {% endif %}
                -->

                <!-- game list / chapters -->
                <div class="video-chapters">
                    <table class="table game-list is-slim" v-if="vod && vod.chapters && vod.chapters.length > 0">
                        <thead>
                            <tr>
                                <th>{{ $t('vod.chapters.offset') }}</th>
                                <th v-if="showAdvanced">{{ $t('vod.chapters.started') }}</th>
                                <th v-if="showAdvanced">{{ $t('vod.chapters.ended') }}</th>
                                <th>{{ $t('vod.chapters.duration') }}</th>
                                <th>{{ $t('vod.chapters.category') }}</th>
                                <th>{{ $t('vod.chapters.title') }}</th>
                                <th v-if="hasViewerCount">{{ $t('vod.chapters.viewers') }}</th>
                                <th></th>
                            </tr>
                        </thead>

                        <tbody>
                            <tr
                                v-for="(chapter, chapterIndex) in vod.chapters"
                                :key="chapterIndex"
                                :class="{
                                    favourite: store.config && chapter.game_id && store.favourite_games.includes(chapter.game_id.toString()),
                                    current: vod && chapterIndex === vod.chapters.length - 1 && vod.is_capturing,
                                }"
                            >
                                <!-- start timestamp -->
                                <td data-contents="offset" :title="formatDate(chapter.started_at)">
                                    {{ chapter.offset !== undefined ? humanDuration(chapter.offset) : "Unknown" }}
                                </td>

                                <!-- start time -->
                                <td data-contents="started_at" :title="chapter.started_at.toISOString()" v-if="showAdvanced">
                                    <span v-if="store.clientCfg('useRelativeTime')">
                                        <duration-display :start-date="chapter.started_at" output-style="human" /> ago
                                    </span>
                                    <span v-else>{{ formatDate(chapter.started_at, "HH:mm:ss") }}</span>
                                </td>

                                <!-- end time -->
                                <td data-contents="ended_at" v-if="showAdvanced">
                                    <span v-if="chapter.offset !== undefined && chapter.duration !== undefined">
                                        {{ humanDuration(chapter.offset + chapter.duration) }}
                                    </span>
                                </td>

                                <!-- duration -->
                                <td data-contents="duration">
                                    <span class="grey" v-if="chapter.duration">
                                        {{ niceDuration(chapter.duration) }}
                                    </span>
                                    <span v-else>
                                        <duration-display :startDate="chapter.started_at" outputStyle="human"></duration-display>
                                    </span>
                                </td>

                                <!-- chapter name -->
                                <td data-contents="name">
                                    <img v-if="chapter.box_art_url" class="boxart" :src="chapter.box_art_url" :alt="chapter.game_name" loading="lazy" />
                                    <template v-if="vod?.is_finalized">
                                        <span class="game-name">
                                            <!-- title with video player link -->
                                            <a class="px-1" target="_blank" :href="playerLink(chapter.offset)">
                                                {{ chapter.game_name ? chapter.game_name : "None" }}
                                            </a>

                                            <!-- video editor -->
                                            <router-link
                                                rel="noreferrer"
                                                aria-label="Open in editor"
                                                title="Open in editor"
                                                :to="{
                                                    name: 'Editor',
                                                    params: { vod: vod.basename },
                                                    query: { start: chapter.offset, end: (chapter.offset || 0) + (chapter.duration || 0), chapter: chapterIndex },
                                                }"
                                            >
                                                <span class="icon"><fa icon="cut"></fa></span>
                                            </router-link>

                                            <!-- open on twitch link -->
                                            <a
                                                v-if="vod.twitch_vod_exists && vod.twitch_vod_id && chapter.offset"
                                                :href="twitchVideoLink(vod.twitch_vod_id) + '?t=' + twitchDuration(chapter.offset)"
                                                target="_blank"
                                                rel="noreferrer"
                                                aria-label="Open on Twitch"
                                                title="Open on Twitch"
                                            >
                                                <span class="icon"><fa icon="external-link-alt"></fa></span>
                                            </a>
                                        </span>
                                    </template>
                                    <template v-else>
                                        <span class="game-name px-1">{{ chapter.game_name ? chapter.game_name : "None" }}</span>
                                    </template>
                                    <!-- favourite button -->
                                    <button
                                        class="icon-button favourite-button"
                                        v-if="store.config && chapter.game_id && !store.favourite_games.includes(chapter.game_id.toString())"
                                        title="Add to favourites"
                                        @click="chapter.game_id && addFavouriteGame(chapter.game_id.toString())"
                                    >
                                        <span class="icon"><fa icon="star"></fa></span>
                                    </button>
                                </td>

                                <!-- title -->
                                <td>
                                    <span class="text-overflow is-text-darker">{{ chapter.title }}</span>
                                </td>

                                <!-- viewer count -->
                                <td v-if="hasViewerCount">
                                    <span class="grey" v-if="chapter.viewer_count">{{ formatNumber(chapter.viewer_count) }}</span>
                                </td>

                                <!-- mature -->
                                <td>
                                    <span v-if="chapter.is_mature">🔞</span>
                                </td>
                            </tr>

                            <tr v-if="vod.ended_at">
                                <td :title="formatDate(vod.ended_at)">
                                    {{ vod.getWebhookDuration() }}
                                </td>
                                <td colspan="10">
                                    <em>{{ $t('vod.chapters.end') }}</em>
                                </td>
                            </tr>

                            <tr v-else>
                                <td v-if="vod.started_at">
                                    <!--{{ humanDuration(vod?.api_getDurationLive) }}-->
                                    <duration-display :startDate="vod.started_at"></duration-display>
                                </td>
                                <td colspan="10">
                                    <em><strong>{{ $t('vod.chapters.ongoing') }}</strong></em>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <div v-else>
                        <div class="is-error padding-1">No chapters found</div>
                    </div>
                </div>

            </div>
        </transition>
    </div>
    <modal-box ref="burnMenu" title="Render Menu" v-if="vod && vod.is_finalized && vod.video_metadata && vod.video_metadata.type !== 'audio'">
        <div>
            <pre>{{ vod.basename }}</pre>
            <ul class="list" v-if="vod.video_metadata">
                <li>
                    <strong>{{ $t('metadata.format') }}</strong>
                    {{ vod.video_metadata.width }}x{{ vod.video_metadata.height }}@
                    {{ vod.video_metadata.fps }}
                </li>

                <li>
                    <strong>{{ $t('metadata.video') }}</strong>
                    {{ vod.video_metadata.video_codec }}
                    {{ vod.video_metadata.video_bitrate_mode }}
                    {{ Math.round(vod.video_metadata.video_bitrate / 1000) }}kbps
                </li>

                <li>
                    <strong>{{ $t('metadata.audio') }}</strong>
                    {{ vod.video_metadata.audio_codec }}
                    {{ vod.video_metadata.audio_bitrate_mode }}
                    {{ Math.round(vod.video_metadata.audio_bitrate / 1000) }}kbps
                </li>

                <li>
                    <strong>{{ $t('metadata.general') }}</strong>
                    {{ formatBytes(vod.video_metadata.size) }} / {{ vod.video_metadata.duration }}
                </li>
            </ul>
            <p>Burning chat seems to work pretty good, but dumped chat+video has a pretty large offset, I have yet to find the offset anywhere.</p>
        </div>
        <div class="burn-preview">
            <div class="burn-preview-chat" :style="burnPreviewChat">
                Anon: Hello World<br />
                Anon: Hello World<br />
                Anon: Hello World<br />
                Anon: Hello World<br />
                Anon: Hello World<br />
                Anon: Hello World<br />
                Anon: Hello World<br />
                Anon: Hello World<br />
                Anon: Hello World<br />
                Anon: Hello World<br />
                Anon: Hello World<br />
                Anon: Hello World<br />
                Anon: Hello World<br />
                Anon: Hello World<br />
                Anon: Hello World<br />
                Anon: Hello World<br />
                Anon: Hello World<br />
                Anon: Hello World<br />
                Anon: Hello World<br />
                Anon: Hello World<br />
                Anon: Hello World<br />
                Anon: Hello World<br />
                Anon: Hello World<br />
                Anon: Hello World<br />
                Anon: Hello World<br />
                Anon: Hello World<br />
                Anon: Hello World<br />
                Anon: Hello World<br />
                Anon: Hello World<br />
                Anon: Hello World<br />
                Anon: Hello World<br />
                Anon: Hello World<br />
                Anon: Hello World<br />
                Anon: Hello World<br />
                Anon: Hello World<br />
                Anon: Hello World<br />
            </div>
        </div>
        <div class="field-group">
            <div class="field">
                <label><input type="checkbox" v-model="burnSettings.renderChat" /> Render chat <strong v-if="vod.is_chat_rendered">(Exists)</strong></label>
            </div>
            <template v-if="burnSettings.renderChat">
                <!--<div class="field">
                    <label><input type="checkbox" v-model="burnSettings.renderTest" /> Test duration</label>
                </div>-->
                <div class="field">
                    <label>
                        <p>Chat width</p>
                        <input class="input" type="range" min="1" :max="vod.video_metadata.width" v-model="burnSettings.chatWidth" />
                        <br /><input class="input" type="number" v-model="burnSettings.chatWidth" />
                        <span :class="{ 'input-help': true, error: burnSettings.chatWidth % 2 }">Chat width must be an even number.</span>
                    </label>
                </div>
                <div class="field">
                    <label>
                        <p>Chat height</p>
                        <input class="input" type="range" min="1" :max="vod.video_metadata.height" v-model="burnSettings.chatHeight" />
                        <br /><input class="input" type="number" v-model="burnSettings.chatHeight" />
                        <span :class="{ 'input-help': true, error: burnSettings.chatHeight % 2 }">Chat height must be an even number.</span>
                    </label>
                </div>
                <div class="field">
                    <label>
                        <p>Video source</p>
                        <select class="input" v-model="burnSettings.vodSource">
                            <option value="captured">Captured</option>
                            <option value="downloaded" :disabled="!vod.is_vod_downloaded">Downloaded</option>
                        </select>
                    </label>
                </div>
                <div class="field">
                    <label>
                        <p>Chat source</p>
                        <select class="input" v-model="burnSettings.chatSource">
                            <option value="captured">Captured</option>
                            <option value="downloaded" :disabled="!vod.is_chat_downloaded">Downloaded</option>
                        </select>
                    </label>
                </div>
                <div class="field">
                    <label>
                        <p>Font</p>
                        <select class="input" v-model="burnSettings.chatFont">
                            <option value="Inter">Inter</option>
                            <option value="Arial">Arial</option>
                        </select>
                    </label>
                </div>
                <div class="field">
                    <label>
                        <p>Font size</p>
                        <input class="input" type="range" min="1" max="72" v-model="burnSettings.chatFontSize" />
                        <br /><input class="input" type="number" v-model="burnSettings.chatFontSize" />
                    </label>
                </div>
            </template>
        </div>
        <div class="field-group">
            <div class="field">
                <label>
                    <input type="checkbox" v-model="burnSettings.burnChat" :disabled="!burnSettings.renderChat && !vod.is_chat_rendered" />
                    Burn chat <strong v-if="vod.is_chat_burned">(Exists)</strong>
                </label>
            </div>
            <template v-if="burnSettings.burnChat">
                <!--<div class="field">
                    <label><input type="checkbox" v-model="burnSettings.burnTest" /> Test duration</label>
                </div>-->
                <div class="field">
                    <label>
                        <p>Chat horizontal</p>
                        <select class="input" v-model="burnSettings.burnHorizontal">
                            <option value="left">Left</option>
                            <option value="right">Right</option>
                        </select>
                    </label>
                </div>
                <div class="field">
                    <label>
                        <p>Chat vertical</p>
                        <select class="input" v-model="burnSettings.burnVertical">
                            <option value="top">Top</option>
                            <option value="bottom">Bottom</option>
                        </select>
                    </label>
                </div>
                <div class="field">
                    <label>
                        <p>ffmpeg preset</p>
                        <select class="input" v-model="burnSettings.ffmpegPreset">
                            <option value="ultrafast">Ultrafast</option>
                            <option value="superfast">Superfast</option>
                            <option value="veryfast">Veryfast</option>
                            <option value="faster">Faster</option>
                            <option value="fast">Fast</option>
                            <option value="medium">Medium</option>
                            <option value="slow">Slow</option>
                            <option value="slower">Slower</option>
                            <option value="veryslow">Veryslow</option>
                        </select>
                    </label>
                </div>
                <div class="field">
                    <label>
                        <p>ffmpeg crf</p>
                        <input class="input" type="range" min="0" max="51" v-model="burnSettings.ffmpegCrf" />
                        <br />{{ burnSettings.ffmpegCrf }}
                    </label>
                </div>
            </template>
        </div>
        <div class="field">
            <button class="button is-confirm" @click="doRenderWizard">
                <span class="icon"><fa icon="burn" /></span>
                <span>Execute</span>
            </button>
            <span v-if="burnLoading">Running...</span>
        </div>
        <div class="job-status">
            <table>
                <tr v-for="job in burnJobs" :key="job.pid">
                    <td>
                        <span v-if="job.status">
                            <span class="fa fa-spinner fa-spin"></span>
                        </span>
                        <span v-else>
                            <span class="fa fa-times"></span>
                        </span>
                    </td>
                    <td>
                        {{ job.name }}
                    </td>
                </tr>
            </table>
        </div>
    </modal-box>
    <modal-box ref="chatDownloadMenu" title="Chat download">
        <div class="buttons is-centered">
            <button class="button is-confirm" @click="doDownloadChat('tcd')">
                <span class="icon"><fa icon="download" /></span>
                <span>{{ $t('vod.buttons.download-with', ['tcd']) }}</span>
            </button>
            <button class="button is-confirm" @click="doDownloadChat('td')">
                <span class="icon"><fa icon="download" /></span>
                <span>{{ $t('vod.buttons.download-with', ['TwitchDownloader']) }}</span>
            </button>
        </div>
    </modal-box>
    <modal-box ref="vodDownloadMenu" title="VOD download">
        <div class="is-centered">
            <div class="field">
                <label class="label">Quality</label>
                <select class="input" v-model="vodDownloadSettings.quality">
                    <option v-for="quality in VideoQualityArray" :key="quality" :value="quality">{{ quality }}</option>
                </select>
            </div>
            <div class="field">
                <button class="button is-confirm" @click="doDownloadVod">
                    <span class="icon"><fa icon="download" /></span>
                    <span>Download</span>
                </button>
            </div>
        </div>
    </modal-box>
    <modal-box ref="playerMenu" title="Player">
        <div class="columns">
            <div class="column">
                <h3>VOD source</h3>
                <label>
                    <input type="radio" v-model="playerSettings.vodSource" value="captured" /> Captured
                </label>
                <br />
                <label>
                    <input type="radio" v-model="playerSettings.vodSource" value="downloaded" :disabled="!vod?.is_vod_downloaded" /> Downloaded
                </label>
            </div>
            <div class="column">
                <h3>Chat source</h3>
                <label>
                    <input type="radio" v-model="playerSettings.chatSource" value="captured" /> Captured
                </label>
                <br />
                <label>
                    <input type="radio" v-model="playerSettings.chatSource" value="downloaded" :disabled="!vod?.is_chat_downloaded" /> Downloaded
                </label>
            </div>
        </div>
        <br />
        <div class="field">
            <button class="button" @click="openPlayer">
                <fa icon="play" />
                <span>Play</span>
            </button>
        </div>
    </modal-box>
    <modal-box ref="editVodMenu" :title="$t('vod.edit.edit-vod')">
        <div class="field">
            <label class="label">{{ $t('vod.edit.stream-number') }}</label>
            <div class="control">
                <input class="input" type="number" v-model.number="editVodSettings.stream_number" />
            </div>
        </div>
        <div class="field">
            <label class="label">{{ $t('vod.edit.comment') }}</label>
            <div class="control">
                <textarea class="input textarea" v-model="editVodSettings.comment" />
            </div>
        </div>
        <div class="field">
            <label class="label">{{ $t('vod.edit.segments') }}</label>
            <div class="control">
                <textarea class="input textarea" v-model="editVodSettings.segments" />
            </div>
        </div>
        <div class="field">
            <div class="control">
                <label class="checkbox">
                    <input type="checkbox" v-model="editVodSettings.prevent_deletion" />
                    {{ $t('vod.edit.prevent-deletion') }}
                </label>
            </div>
        </div>
        <div class="field">
            <button class="button is-confirm" @click="doEditVod">
                <span class="icon"><fa icon="save" /></span>
                <span>{{ $t("buttons.save") }}</span>
            </button>
        </div>
    </modal-box> 
    <modal-box ref="exportVodMenu" title="Export VOD">

        <div class="notification is-error" v-if="!vod?.segments || vod.segments.length == 0">{{ $t('vod.export.no-segments') }}</div>

        <!-- Exporter -->
        <div class="field">
            <label class="label">{{ $t('vod.export.export-type') }}</label>
            <div class="control">
                <select class="input" v-model="exportVodSettings.exporter">
                    <option value="file">File</option>
                    <option value="youtube">YouTube</option>
                    <option value="sftp">SFTP</option>
                    <option value="ftp">FTP</option>
                </select>
            </div>
        </div>

        <!-- File -->
        <div class="field">
            <label class="label">{{ $t('vod.export.file-source') }}</label>
            <div class="control">
                <div class="select">
                    <select v-model="exportVodSettings.file_source">
                        <option value="segment">First captured segment</option>
                        <option value="downloaded" :disabled="!vod?.is_vod_downloaded">Downloaded</option>
                        <option value="burned" :disabled="!vod?.is_chat_burned">Burned</option>
                    </select>
                </div>
            </div>
        </div>

        <!-- Title / Filename -->
        <div class="field">
            <label class="label">{{ $t('vod.export.title-template') }}</label>
            <div class="control">
                <input class="input" type="text" v-model="exportVodSettings.title_template" />
            </div>
            <div class="control">
                <ul>
                    <li v-for="v in exporterTemplateVariables">{{ v }}</li>
                </ul>
            </div>
            <div class="control" v-if="exportVodSettings.exporter == 'file' || exportVodSettings.exporter == 'sftp' || exportVodSettings.exporter == 'ftp'">
                {{ templatePreview(exportVodSettings.title_template) }}.mp4
            </div>
            <div class="control" v-else-if="exportVodSettings.exporter == 'youtube'">
                {{ templatePreview(exportVodSettings.title_template) }}
            </div>
        </div>

        <!-- Directory -->
        <div class="field" v-if="exportVodSettings.exporter == 'file' || exportVodSettings.exporter == 'sftp' || exportVodSettings.exporter == 'ftp'">
            <label class="label">{{ $t('vod.export.directory') }}</label>
            <div class="control">
                <input class="input" type="text" v-model="exportVodSettings.directory" />
            </div>
        </div>

        <!-- Host -->
        <div class="field" v-if="exportVodSettings.exporter == 'sftp' || exportVodSettings.exporter == 'ftp'">
            <label class="label">{{ $t('vod.export.host') }}</label>
            <div class="control">
                <input class="input" type="text" v-model="exportVodSettings.host" />
            </div>
        </div>

        <!-- Username -->
        <div class="field" v-if="exportVodSettings.exporter == 'sftp' || exportVodSettings.exporter == 'ftp'">
            <label class="label">{{ $t('vod.export.username') }}</label>
            <div class="control">
                <input class="input" type="text" v-model="exportVodSettings.username" />
            </div>
        </div>

        <!-- Password -->
        <div class="field" v-if="exportVodSettings.exporter == 'ftp'">
            <label class="label">{{ $t('vod.export.password') }}</label>
            <div class="control">
                <input class="input" type="password" v-model="exportVodSettings.password" />
            </div>
            <p class="help">{{ $t('vod.export.password-help') }}</p>
        </div>

        <!-- YouTube Authentication -->
        <div class="field" v-if="exportVodSettings.exporter == 'youtube'">
            <div class="buttons">
                <button class="button is-confirm" @click="doCheckYouTubeStatus">
                    <span class="icon"><fa icon="sync" /></span>
                    <span>{{ $t("buttons.checkstatus") }}</span>
                </button>
                <button class="button is-confirm" @click="doAuthenticateYouTube">
                    <span class="icon"><fa icon="key" /></span>
                    <span>{{ $t("buttons.authenticate") }}</span>
                </button>
            </div>
        </div>

        <!-- Description -->
        <div class="field" v-if="exportVodSettings.exporter == 'youtube'">
            <label class="label">{{ $t('vod.export.description') }}</label>
            <div class="control">
                <textarea class="input textarea" v-model="exportVodSettings.description" />
            </div>
        </div>

        <!-- Category -->
        <div class="field" v-if="exportVodSettings.exporter == 'youtube'">
            <label class="label">{{ $t('vod.export.category') }}</label>
            <div class="control">
                <div class="select">
                    <select v-model="exportVodSettings.category">
                        <option v-for="(c, i) in YouTubeCategories" :value="i">{{ c }}</option>
                    </select>
                </div>
            </div>
        </div>

        <!-- Tags -->
        <div class="field" v-if="exportVodSettings.exporter == 'youtube'">
            <label class="label">{{ $t('vod.export.tags') }}</label>
            <div class="control">
                <input class="input" type="text" v-model="exportVodSettings.tags" />
            </div>
            <p class="input-help">{{ $t('vod.export.tags-help') }}</p>
        </div>

        <!-- Privacy -->
        <div class="field" v-if="exportVodSettings.exporter == 'youtube'">
            <label class="label">{{ $t('vod.export.privacy') }}</label>
            <div class="control">
                <div class="select">
                    <select v-model="exportVodSettings.privacy">
                        <option value="public">{{ $t('vod.export.privacy-public') }}</option>
                        <option value="unlisted">{{ $t('vod.export.privacy-unlisted') }}</option>
                        <option value="private">{{ $t('vod.export.privacy-private') }}</option>
                    </select>
                </div>
            </div>
        </div>

        <div class="field">
            <div class="control">
                <button class="button is-confirm" @click="doExportVod">
                    <span class="icon"><fa icon="upload" /></span>
                    <span>{{ $t("buttons.export") }}</span>
                </button>
            </div>
        </div>
    </modal-box>
</template>

<script lang="ts">
import type { ApiJob } from "../../../common/Api/Client";
import { defineComponent, ref } from "vue";
import DurationDisplay from "@/components/DurationDisplay.vue";
// import { format, toDate, parse } from 'date-fns';

import { library } from "@fortawesome/fontawesome-svg-core";
import {
    faFileVideo,
    faCut,
    faPlay,
    faDatabase,
    faComments,
    faVolumeMute,
    faBurn,
    faTrash,
    faExternalLinkAlt,
    faArchive,
    faDownload,
    faExclamationTriangle,
    faFileSignature,
    faWrench,
    faSync,
    faMinus,
    faPlus,
    faCommentDots,
    faSave,
    faUpload,
    faKey,
} from "@fortawesome/free-solid-svg-icons";
import { useStore } from "@/store";
import ModalBox from "./ModalBox.vue";
import { MuteStatus, VideoQualityArray } from "../../../common/Defs";
import { ApiResponse, ApiSettingsResponse } from "@common/Api/Api";
import TwitchVOD from "@/core/vod";
import { AudioMetadata } from "@common/MediaInfo";
import { formatString } from "@common/Format";
import { YouTubeCategories } from "@/defs";
library.add(
    faFileVideo,
    faCut,
    faPlay,
    faDatabase,
    faComments,
    faVolumeMute,
    faBurn,
    faTrash,
    faExternalLinkAlt,
    faArchive,
    faDownload,
    faExclamationTriangle,
    faFileSignature,
    faWrench,
    faSync,
    faMinus,
    faPlus,
    faCommentDots,
    faSave,
    faUpload,
    faKey
);

export default defineComponent({
    name: "VodItem",
    emits: ["forceFetchData", "refresh"],
    setup() {
        const store = useStore();
        const burnMenu = ref<InstanceType<typeof ModalBox>>();
        const chatDownloadMenu = ref<InstanceType<typeof ModalBox>>();
        const vodDownloadMenu = ref<InstanceType<typeof ModalBox>>();
        const playerMenu = ref<InstanceType<typeof ModalBox>>();
        const editVodMenu = ref<InstanceType<typeof ModalBox>>();
        const exportVodMenu = ref<InstanceType<typeof ModalBox>>();
        return {
            store,
            burnMenu,
            chatDownloadMenu,
            vodDownloadMenu,
            playerMenu,
            MuteStatus,
            VideoQualityArray,
            editVodMenu,
            exportVodMenu,
            YouTubeCategories,
        };
    },
    data() {
        return {
            config: [],
            taskStatus: {
                vodMuteCheck: false,
                archive: false,
                downloadChat: false,
                renderChat: false,
                downloadVod: false,
                fullBurn: false,
                delete: false,
                fixIssues: false,
            },
            burnLoading: false,
            burnSettings: {
                renderChat: false,
                burnChat: false,
                renderTest: false,
                burnTest: false,
                chatWidth: 300,
                chatHeight: 300,
                vodSource: "captured",
                chatSource: "captured",
                chatFont: "Inter",
                chatFontSize: 12,
                burnHorizontal: "left",
                burnVertical: "top",
                ffmpegPreset: "slow",
                ffmpegCrf: 26,
            },
            chatDownloadMethod: "tcd",
            showAdvanced: false,
            minimized: this.getDefaultMinimized(),
            vodDownloadSettings: {
                quality: "best",
            },
            playerSettings: {
                vodSource: "captured",
                chatSource: "captured",
            },
            editVodSettings: {
                stream_number: 0,
                comment: "",
                prevent_deletion: false,
                segments: "",
            },
            exportVodSettings: {
                exporter: "file",
                title_template: "[{login}] {title} ({date})",
                directory: "",
                host: "",
                username: "",
                password: "",
                description: "",
                tags: "",
                category: "",
                file_source: "segment",
                privacy: "private",
                vod: "",
            },
            exporterTemplateVariables: [
                "login",
                "title",
                "stream_number",
                "comment",
                "date",
                "resolution",
            ],
            newBookmark: {
                name: "",
                offset: 0,
            }
        };
    },
    mounted() {
        if (this.vod && this.vod.video_metadata && this.vod.video_metadata.type !== 'audio')
            this.burnSettings.chatHeight = this.vod.video_metadata.height;

        if (this.vod) {
            if (!this.vod.chapters) {
                console.error("No chapters found for vod", this.vod.basename, this.vod);
            } else if (this.vod.chapters && this.vod.chapters.length == 0) {
                console.error("Chapters array found but empty for vod", this.vod.basename, this.vod);
            }
            this.editVodSettings = {
                stream_number: this.vod.stream_number ?? 0,
                comment: this.vod.comment ?? "",
                prevent_deletion: this.vod.prevent_deletion ?? false,
                segments: this.vod.segments.map((s) => s.basename).join("\n"),
            };
            this.exportVodSettings.vod = this.vod.basename;
            this.applyDefaultExportSettings();
        }
    },
    props: {
        vod: Object as () => TwitchVOD,
    },
    methods: {
        doArchive() {
            if (!confirm(`Do you want to archive "${this.vod?.basename}"?`)) return;
            this.taskStatus.archive = true;
            this.$http
                .post(`/api/v0/vod/${this.vod?.basename}/save`)
                .then((response) => {
                    const json: ApiResponse = response.data;
                    if (json.message) alert(json.message);
                    console.log(json);
                    this.taskStatus.archive = false;
                    this.$emit("refresh");
                })
                .catch((err) => {
                    console.error("form error", err.response);
                    if (err.response.data && err.response.data.message) alert(err.response.data.message);
                    this.taskStatus.archive = false;
                });
        },
        doDownloadChat(method = "tcd") {
            if (!confirm(`Do you want to download the chat for "${this.vod?.basename}" with ${method}?`)) return;
            this.taskStatus.downloadChat = true;
            this.$http
                .post(`/api/v0/vod/${this.vod?.basename}/download_chat?method=${method}`)
                .then((response) => {
                    const json: ApiResponse = response.data;
                    if (json.message) alert(json.message);
                    console.log(json);
                    this.taskStatus.downloadChat = false;
                    this.$emit("refresh");
                    if (this.vod) this.store.fetchAndUpdateVod(this.vod.basename);
                })
                .catch((err) => {
                    console.error("form error", err.response);
                    if (err.response.data && err.response.data.message) alert(err.response.data.message);
                    this.taskStatus.downloadChat = false;
                });
        },
        // doRenderChat(useVod = false) {
        //     /** TODO: implement */
        //     alert(`RenderChat not implemented: ${useVod}`);
        // },
        doDownloadVod() {
            if (!VideoQualityArray.includes(this.vodDownloadSettings.quality)) {
                alert(`Invalid quality: ${this.vodDownloadSettings.quality}`);
                return;
            }

            this.taskStatus.downloadVod = true;
            this.$http
                .post(`/api/v0/vod/${this.vod?.basename}/download?quality=${this.vodDownloadSettings.quality}`)
                .then((response) => {
                    const json: ApiResponse = response.data;
                    if (json.message) alert(json.message);
                    console.log(json);
                    this.taskStatus.downloadVod = false;
                    this.$emit("refresh");
                })
                .catch((err) => {
                    console.error("form error", err.response);
                    if (err.response.data && err.response.data.message) alert(err.response.data.message);
                    this.taskStatus.downloadVod = false;
                });
        },
        doCheckMute() {
            this.taskStatus.vodMuteCheck = true;
            this.$http
                .post(`/api/v0/vod/${this.vod?.basename}/check_mute`)
                .then((response) => {
                    const json: ApiResponse = response.data;
                    if (json.message) alert(json.message);
                    console.log(json);

                    if (json.data) {
                        if (json.data.muted === null || json.data.muted === MuteStatus.UNKNOWN) {
                            alert(`The vod "${this.vod?.basename}" could not be checked.`);
                        } else {
                            alert(`The vod "${this.vod?.basename}" is${json.data.muted === MuteStatus.MUTED ? "" : " not"} muted.`);
                        }
                    }
                    this.taskStatus.vodMuteCheck = false;
                    this.$emit("refresh");
                })
                .catch((err) => {
                    console.error("doCheckMute error", err.response);
                    if (err.response.data) {
                        const json = err.response.data;
                        if (json.message) alert(json.message);
                    }
                    this.taskStatus.vodMuteCheck = false;
                });
        },
        // doFullBurn() {
        //     /** TODO: implement */
        //     alert("FullBurn");
        // },
        doDelete() {
            if (!confirm(`Do you want to delete "${this.vod?.basename}"?`)) return;
            if (this.vod?.twitch_vod_exists === false && !confirm(`The VOD "${this.vod?.basename}" has been deleted from twitch, are you still sure?`)) return;
            this.taskStatus.delete = true;
            this.$http
                .delete(`/api/v0/vod/${this.vod?.basename}`)
                .then((response) => {
                    const json: ApiResponse = response.data;
                    if (json.message) alert(json.message);
                    console.log(json);
                    this.taskStatus.delete = false;
                    this.$emit("refresh");
                    if (this.vod) this.store.fetchAndUpdateStreamer(this.vod.streamer_login);
                })
                .catch((err) => {
                    console.error("form error", err.response);
                    if (err.response.data && err.response.data.message) alert(err.response.data.message);
                    this.taskStatus.delete = false;
                });
        },
        doRenderWizard() {
            this.burnLoading = true;
            console.debug("doRenderWizard", this.burnSettings);
            this.$http
                .post(`/api/v0/vod/${this.vod?.basename}/renderwizard`, this.burnSettings)
                .then((response) => {
                    const json: ApiResponse = response.data;
                    if (json.message) alert(json.message);
                    console.log(json);
                    this.$emit("refresh");
                })
                .catch((err) => {
                    console.error("form error", err.response);
                    if (err.response.data && err.response.data.message) alert(err.response.data.message);
                })
                .finally(() => {
                    this.burnLoading = false;
                });
        },
        doFixIssues() {
            this.taskStatus.fixIssues = true;
            this.$http
                .post(`/api/v0/vod/${this.vod?.basename}/fix_issues`)
                .then((response) => {
                    const json: ApiResponse = response.data;
                    if (json.message) alert(json.message);
                    console.log(json);
                    this.taskStatus.fixIssues = false;
                    this.$emit("refresh");
                })
                .catch((err) => {
                    console.error("form error", err.response);
                    if (err.response.data && err.response.data.message) alert(err.response.data.message);
                    this.taskStatus.fixIssues = false;
                });
        },
        unbreak() {
            // this.burnLoading = true;
            console.debug("doUnbreak", this.vod);
            this.$http
                .post(`/api/v0/vod/${this.vod?.basename}/unbreak`)
                .then((response) => {
                    const json: ApiResponse = response.data;
                    if (json.message) alert(json.message);
                    console.log(json);
                    this.$emit("refresh");
                })
                .catch((err) => {
                    console.error("unbreak response error", err.response);
                    if (err.response.data && err.response.data.message) alert(err.response.data.message);
                })
                .finally(() => {
                    // this.burnLoading = false;
                });
        },
        addFavouriteGame(game_id: string) {
            if (!this.store.config) return;

            this.$http
                .patch(`/api/v0/favourites`, { game: game_id })
                .then((response) => {
                    const json: ApiResponse = response.data;
                    if (json.message) alert(json.message);
                    console.log(json);

                    // fetch the new config
                    this.$http.get(`/api/v0/settings`).then((response) => {
                        const settings_json: ApiSettingsResponse = response.data;
                        this.store.updateConfig(settings_json.data.config);
                        this.store.updateFavouriteGames(settings_json.data.favourite_games);
                    });
                })
                .catch((err) => {
                    console.error("form error", err.response);
                    if (err.response.data && err.response.data.message) alert(err.response.data.message);
                });
        },
        playerLink(offset = 0, chatdownload = false): string {
            if (!this.store.config) return "#";
            let video_path = `${this.vod?.webpath}/${this.vod?.basename}.mp4`;
            let chat_path = `${this.vod?.webpath}/${this.vod?.basename}.${chatdownload ? "chat" : "chatdump"}`;
            return `${this.store.cfg<string>("basepath", "")}/vodplayer/index.html#source=file_http&video_path=${video_path}&chatfile=${chat_path}&offset=${offset}`;
        },
        twitchVideoLink(video_id: string): string {
            return `https://www.twitch.tv/videos/${video_id}`;
        },
        matchVod() {
            if (!this.vod) return;
            this.$http
                .post(`/api/v0/vod/${this.vod.basename}/match`)
                .then((response) => {
                    const json: ApiResponse = response.data;
                    if (json.message) alert(json.message);
                    console.log(json);
                    this.$emit("refresh");
                })
                .catch((err) => {
                    console.error("form error", err.response);
                    if (err.response.data && err.response.data.message) alert(err.response.data.message);
                });
        },
        getDefaultMinimized() {
            if (this.store.clientCfg("minimizeVodsByDefault")) {
                return !this.vod?.is_capturing;
            }
            return false;
        },
        openPlayer() {
            let url = `${this.store.cfg<string>("basepath", "")}/vodplayer/index.html#&`;
            url += "source=file_http";
            if (this.playerSettings.vodSource == "captured"){
                url += `&video_path=${this.vod?.webpath}/${this.vod?.basename}.mp4`;
            } else {
                url += `&video_path=${this.vod?.webpath}/${this.vod?.basename}_vod.mp4`;
            }

            if (this.playerSettings.chatSource == "captured"){
                url += `&chatfile=${this.vod?.webpath}/${this.vod?.basename}.chatdump`;
            } else {
                url += `&chatfile=${this.vod?.webpath}/${this.vod?.basename}_chat.json`;
            }

            // url.searchParams.set("offset", this.playerSettings.offset.toString());
            window.open(url.toString(), "_blank");

        },
        doEditVod() {
            
            this.$http.post(`/api/v0/vod/${this.vod?.basename}`, this.editVodSettings).then((response) => {
                const json: ApiResponse = response.data;
                if (json.message) alert(json.message);
                console.log(json);
                if (this.vod) this.store.fetchAndUpdateVod(this.vod.basename);
                if (this.editVodMenu) this.editVodMenu.show = false;
            }).catch((err) => {
                console.error("form error", err.response);
                if (err.response.data && err.response.data.message) alert(err.response.data.message);
            });

        },
        templatePreview(template: string): string {
            const replacements = {
                login: "TestLogin",
                title: "TestTitle",
                date: "2020-01-01",
                resolution: "1080p",
                stream_number: "102",
                comment: "TestComment", 
            };
            const replaced_string = formatString(template, replacements);
            return replaced_string;
        },
        doExportVod() {
            if (!this.vod) return;
            this.$http.post(`/api/v0/exporter?mode=vod`, this.exportVodSettings).then((response) => {
                const json: ApiResponse = response.data;
                if (json.message) alert(json.message);
                console.log(json);
                if (this.vod) this.store.fetchAndUpdateVod(this.vod.basename);
                if (this.editVodMenu) this.editVodMenu.show = false;
            }).catch((err) => {
                console.error("form error", err.response);
                if (err.response.data && err.response.data.message) alert(err.response.data.message);
            });
        },
        doCheckYouTubeStatus() {
            this.$http.get(`/api/v0/youtube/status`).then((response) => {
                const json: ApiResponse = response.data;
                if (json.message) alert(json.message);
                console.log(json);
            }).catch((err) => {
                console.error("youtube check error", err.response);
                if (err.response.data && err.response.data.message) alert(err.response.data.message);
            });
        },
        doAuthenticateYouTube() {
            const url = `${this.store.cfg<string>("basepath", "")}/api/v0/youtube/authenticate`;
            window.open(url, "_blank");
        },
        doMakeBookmark() {
            if (!this.vod) return;
            this.$http.post(`/api/v0/vod/${this.vod.basename}/bookmark`, this.newBookmark).then((response) => {
                const json: ApiResponse = response.data;
                if (json.message) alert(json.message);
                console.log(json);
                if (this.vod) this.store.fetchAndUpdateVod(this.vod.basename);
                // if (this.editVodMenu) this.editVodMenu.show = false;
            }).catch((err) => {
                console.error("form error", err.response);
                if (err.response.data && err.response.data.message) alert(err.response.data.message);
            });
        },
        doDeleteBookmark(i: number) {
            if (!this.vod) return;
            this.$http.delete(`/api/v0/vod/${this.vod.basename}/bookmark?index=${i}`).then((response) => {
                const json: ApiResponse = response.data;
                if (json.message) alert(json.message);
                console.log(json);
                if (this.vod) this.store.fetchAndUpdateVod(this.vod.basename);
                // if (this.editVodMenu) this.editVodMenu.show = false;
            }).catch((err) => {
                console.error("form error", err.response);
                if (err.response.data && err.response.data.message) alert(err.response.data.message);
            });
        },
        applyDefaultExportSettings() {
            if (this.store.cfg("exporter.default.exporter")) this.exportVodSettings.exporter = this.store.cfg("exporter.default.exporter");
            if (this.store.cfg("exporter.default.directory")) this.exportVodSettings.directory = this.store.cfg("exporter.default.directory");
            if (this.store.cfg("exporter.default.host")) this.exportVodSettings.host = this.store.cfg("exporter.default.host");
            if (this.store.cfg("exporter.default.username")) this.exportVodSettings.username = this.store.cfg("exporter.default.username");
            if (this.store.cfg("exporter.default.password")) this.exportVodSettings.password = this.store.cfg("exporter.default.password");
            if (this.store.cfg("exporter.default.description")) this.exportVodSettings.description = this.store.cfg("exporter.default.description");
            if (this.store.cfg("exporter.default.tags")) this.exportVodSettings.tags = this.store.cfg("exporter.default.tags");
        }
    },
    computed: {
        compDownloadChat(): boolean {
            if (!this.store.jobList) return false;
            for (let job of this.store.jobList) {
                if (job.name == `tcd_${this.vod?.basename}`) {
                    return true;
                }
            }
            return false;
        },
        hasViewerCount(): boolean {
            if (!this.vod) return false;
            if (!this.vod.chapters) return false;
            return this.vod.chapters.some((chapter) => {
                return chapter.viewer_count && chapter.viewer_count > 0;
            });
        },
        burnJobs(): ApiJob[] {
            if (!this.store.jobList) return [];
            let jobs: ApiJob[] = [];
            for (let job of this.store.jobList) {
                if (job.name == `tdrender_${this.vod?.basename}` || job.name == `burnchat_${this.vod?.basename}`) {
                    jobs.push(job);
                }
            }
            return jobs;
        },
        burnPreviewChat(): Record<string, string> {
            if (!this.vod || !this.vod.video_metadata || this.vod.video_metadata.type == 'audio') return {};
            return {
                width: `${(this.burnSettings.chatWidth / this.vod.video_metadata.width) * 100}%`,
                height: `${(this.burnSettings.chatHeight / this.vod.video_metadata.height) * 100}%`,
                left: this.burnSettings.burnHorizontal == "left" ? "0" : "",
                right: this.burnSettings.burnHorizontal == "right" ? "0" : "",
                top: this.burnSettings.burnVertical == "top" ? "0" : "",
                bottom: this.burnSettings.burnVertical == "bottom" ? "0" : "",
                fontSize: `${this.burnSettings.chatFontSize * 0.35}px`,
                fontFamily: this.burnSettings.chatFont,
            };
        },
        audioOnly(): boolean {
            if (!this.vod) return false;
            if (!this.vod.video_metadata) return false;
            return this.vod.video_metadata.type == 'audio';
        }
    },
    components: {
        DurationDisplay,
        ModalBox,
    },
    watch: {
        // watch hash
        $route(to, from) {
            if (to.hash !== from.hash) {
                const basename = to.hash.substr(5);
                if (basename == this.vod?.basename) this.minimized = false;
            }
        },
    }
});
</script>

<style lang="scss" scoped>
.burn-preview {
    position: relative;
    width: 320px;
    aspect-ratio: 16/9;
    background-color: #eee;
    margin-bottom: 1rem;
    border: 1px solid #333;
    .burn-preview-chat {
        position: absolute;
        // top: 0;
        // left: 0;
        height: 100%;
        width: 50px;
        background-color: #000;
        opacity: 0.5;
        color: #fff;
        // font-size: 2px;
        overflow: hidden;
        padding: 1px;
    }
}
</style>
