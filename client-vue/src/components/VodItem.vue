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
            'is-favourite': vod.provider == 'twitch' && vod.hasFavouriteGame(),
        }"
    >
        <div
            :id="'vod_' + vod.uuid"
            class="anchor"
        />

        <!-- title -->
        <div
            class="video-title"
            @click="minimized = !minimized"
        >
            <div class="video-title-text">
                <h3>
                    <span class="icon"><fa icon="file-video" /></span>
                    <span
                        v-if="vod.started_at"
                        class="video-date"
                        :title="formatDate(vod.started_at)"
                    >{{
                        store.clientCfg('useRelativeTime') ? humanDate(vod.started_at, true) : formatDate(vod.started_at)
                    }}</span>
                    <span class="video-sxe">
                        {{ vod.stream_season }}x{{ vod.stream_number?.toString().padStart(2, "0") }}
                    </span>
                    <span class="video-filename">{{ vod.basename }}</span>
                </h3>
            </div>
            <div class="video-title-actions">
                <fa :icon="!minimized ? 'chevron-up' : 'chevron-down'" />
            </div>
        </div>

        <div
            v-if="!minimized"
            class="video-content"
        >
            <!-- description -->
            <div class="video-description">
                <!-- box art -->
                <div
                    v-if="vod && vod.provider == 'twitch' && vod.getUniqueGames()"
                    class="boxart-carousel is-small"
                >
                    <div
                        v-for="game in vod.getUniqueGames()"
                        :key="game.id"
                        class="boxart-item"
                    >
                        <img
                            v-if="game.image_url"
                            :title="game.name"
                            :alt="game.name"
                            :src="game.image_url"
                            loading="lazy"
                        >
                        <span v-else>{{ game.name }}</span>
                    </div>
                </div>

                <!-- comment -->
                <div
                    v-if="vod.comment"
                    class="video-comment"
                >
                    <p>{{ vod.comment }}</p>
                </div>
                <div v-else>
                    <p>
                        <a
                            href="#"
                            @click.prevent="editVodMenu ? (editVodMenu.show = true) : ''"
                        >
                            <fa icon="comment-dots" />
                            {{ $t("vod.add_comment") }}
                        </a>
                    </p>
                </div>

                <!-- video info -->
                <div
                    v-if="vod.is_finalized"
                    class="info-columns"
                >
                    <div class="info-column">
                        <h4>{{ $t('vod.video-info.general') }}</h4>
                        <ul class="video-info">
                            <li>
                                <strong>{{ $t('vod.video-info.webhook-duration') }}:</strong>
                                {{ vod.getWebhookDuration() }}
                            </li>
                            <li>
                                <strong>{{ $t('vod.video-info.created') }}:</strong>
                                <span v-if="vod.created_at">{{ formatDate(vod.created_at, "yyyy-MM-dd HH:mm:ss") }}</span>
                                <span
                                    v-else
                                    class="text-is-error"
                                >No created_at</span>
                            </li>
                            <li v-if="showAdvanced">
                                <strong>{{ $t('vod.video-info.went-live') }}:</strong>
                                <span v-if="vod.started_at">{{ formatDate(vod.started_at, "yyyy-MM-dd HH:mm:ss") }}</span>
                                <span
                                    v-else
                                    class="text-is-error"
                                >No started_at</span>
                            </li>
                            <li v-if="showAdvanced">
                                <strong>{{ $t('vod.video-info.capture-launched') }}:</strong>
                                <span v-if="vod.capture_started">{{ formatDate(vod.capture_started, "yyyy-MM-dd HH:mm:ss") }}</span>
                                <span
                                    v-else
                                    class="text-is-error"
                                >No capture_started</span>
                            </li>
                            <li v-if="showAdvanced">
                                <strong>{{ $t('vod.video-info.wrote-file') }}:</strong>
                                <span v-if="vod.capture_started2">{{ formatDate(vod.capture_started2, "yyyy-MM-dd HH:mm:ss") }}</span>
                                <span
                                    v-else
                                    class="text-is-error"
                                >No capture_started2</span>
                            </li>
                            <li>
                                <strong>{{ $t('vod.video-info.stream-end') }}:</strong>
                                <span v-if="vod.ended_at">{{ formatDate(vod.ended_at, "yyyy-MM-dd HH:mm:ss") }}</span>
                                <span
                                    v-else
                                    class="text-is-error"
                                >No ended_at</span>
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
                                <span
                                    v-if="vod.provider == 'twitch' && vod.twitch_vod_duration"
                                    class="px-1"
                                >
                                    {{ humanDuration(vod.twitch_vod_duration - vod.getDuration()) }}
                                    <strong
                                        v-if="vod.twitch_vod_duration - vod.getDuration() > 600"
                                        class="text-is-error"
                                    ><br>A lot missing!</strong>
                                </span>
                                <span
                                    v-else
                                    class="px-1"
                                >
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
                    <div
                        v-if="vod.provider == 'twitch'"
                        class="info-column"
                    >
                        <h4>Twitch VOD</h4>
                        <ul class="video-info">
                            <template v-if="vod.twitch_vod_exists === true">
                                <li>
                                    <strong>{{ $t('vod.video-info.duration') }}:</strong>
                                    <span
                                        v-if="vod.twitch_vod_duration"
                                        class="px-1"
                                    >{{ humanDuration(vod.twitch_vod_duration) }}</span>
                                    <span
                                        v-else
                                        class="px-1"
                                    >
                                        <strong><em>No data</em></strong>
                                    </span>
                                </li>
                                <li>
                                    <strong>{{ $t('vod.video-info.id') }}:</strong>
                                    <span
                                        v-if="vod.twitch_vod_id"
                                        class="px-1"
                                    >
                                        <a
                                            :href="twitchVideoLink(vod.twitch_vod_id)"
                                            rel="noreferrer"
                                            target="_blank"
                                            title="Open external video"
                                        >{{ vod.twitch_vod_id }}</a>
                                        &nbsp;<a
                                            href="javascript:void(0)"
                                            title="Match VOD"
                                            @click="matchVod()"
                                        ><fa icon="sync" /></a>
                                    </span>
                                    <span
                                        v-else
                                        class="px-1"
                                    >
                                        <strong><em>Not matched or VOD deleted</em></strong>
                                    </span>
                                </li>
                                <li>
                                    <strong>{{ $t('vod.video-info.date') }}:</strong>&#32;
                                    <span
                                        v-if="vod.twitch_vod_date"
                                        class="px-1"
                                    >{{ formatDate(vod.twitch_vod_date) }}</span>
                                    <span
                                        v-else
                                        class="px-1"
                                    >
                                        <strong><em>No data</em></strong>
                                    </span>
                                </li>
                                <li>
                                    <strong>{{ $t('vod.video-info.title') }}:</strong>
                                    <span
                                        v-if="vod.twitch_vod_title"
                                        class="px-1 text-overflow"
                                    >
                                        {{ vod.twitch_vod_title }}
                                    </span>
                                    <span
                                        v-else
                                        class="px-1"
                                    >
                                        <strong><em>No data</em></strong>
                                    </span>
                                </li>
                                <li>
                                    <strong>{{ $t('vod.video-info.is-muted') }}:</strong>
                                    <span
                                        v-if="vod.twitch_vod_muted === MuteStatus.MUTED"
                                        class="px-1"
                                    ><strong class="text-is-error">{{ $t('boolean.yes') }}</strong></span>
                                    <span
                                        v-else-if="vod.twitch_vod_muted === MuteStatus.UNMUTED"
                                        class="px-1"
                                    >{{ $t('boolean.no') }}</span>
                                    <span
                                        v-else
                                        class="px-1"
                                    ><em>{{ $t('boolean.no-data') }}</em></span>
                                </li>
                            </template>
                            <template v-else-if="vod.twitch_vod_exists === false">
                                <li>
                                    <strong class="text-is-error">{{ $t('vod.video-info.vod-is-deleted') }}</strong>
                                    &nbsp;<a
href="javascript:void(0)"
title="Retry VOD match"
@click="matchVod()"
><fa icon="sync" /></a>
                                </li>
                                <li>
                                    <span v-if="vod.twitch_vod_id">
                                        The ID was <a
                                            :href="twitchVideoLink(vod.twitch_vod_id)"
                                            rel="noreferrer"
                                            target="_blank"
                                        >{{ vod.twitch_vod_id }}</a>.
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

                    <!-- Export Data -->
                    <div
                        v-if="vod.exportData && Object.keys(vod.exportData).length > 0"
                        class="info-column"
                    >
                        <h4>{{ $t('vod.video-info.export-data.title') }}</h4>
                        <ul class="video-info">
                            <li v-if="vod.exportData.exported_at">
                                <strong>{{ $t('vod.video-info.export-data.exported-at') }}:</strong>
                                {{ formatDate(vod.exportData.exported_at) }}
                            </li>
                            <li>
                                <strong>{{ $t('vod.video-info.export-data.youtube-id') }}:</strong>
                                {{ vod.exportData.youtube_id }}
                            </li>
                            <li>
                                <strong>{{ $t('vod.video-info.export-data.youtube-playlist-id') }}:</strong>
                                {{ vod.exportData.youtube_playlist_id }}
                            </li>
                        </ul>
                    </div>
                </div>

                <div
                    v-if="vod.is_capturing"
                    class="info-columns"
                >
                    <div class="info-column">
                        <h4>Recording</h4>
                        <ul class="video-info">
                            <li v-if="vod.started_at">
                                <strong>Went live:</strong> {{ formatDate(vod.started_at) }}
                            </li>
                            <li v-if="vod.created_at">
                                <strong>Created:</strong> {{ formatDate(vod.created_at) }}
                            </li>
                            <li v-if="vod.capture_started && vod.started_at">
                                <strong>Capture launched:</strong> {{ formatDate(vod.capture_started) }} ({{
                                    humanDuration((vod.capture_started.getTime() - vod.started_at.getTime()) / 1000)
                                }}
                                missing)
                            </li>
                            <li v-if="vod.capture_started2">
                                <strong>Wrote file:</strong> {{ formatDate(vod.capture_started2) }}
                            </li>
                            <li>
                                <strong>Current duration:</strong> <duration-display
                                    v-if="vod.started_at"
                                    :start-date="vod.started_at.toISOString()"
                                    output-style="human"
                                />
                            </li>
                            <li v-if="vod.provider == 'twitch'">
                                <strong>Resolution:</strong> {{ vod.stream_resolution || "Unknown" }}
                            </li>
                            <li v-if="vod.provider == 'twitch'">
                                <strong>Watch live:</strong> <a
                                    :href="'https://twitch.tv/' + vod.streamer_login"
                                    rel="noreferrer"
                                    target="_blank"
                                >Twitch</a>
                            </li>
                        </ul>
                        <!--<button class="button is-small is-danger" @click="unbreak">Unbreak</button>-->
                    </div>
                </div>
            </div>

            <!-- segment list -->
            <div
                v-if="vod.is_finalized"
                class="video-segments"
            >
                <strong>{{ $t('vod.segments') }}</strong>
                <ul class="list-segments">
                    <li
                        v-for="segment in vod.segments"
                        :key="segment.basename"
                    >
                        <a
                            :href="vod?.webpath + '/' + segment.basename"
                            target="_blank"
                            @click.prevent="store.playMedia(vod?.webpath + '/' + segment.basename)"
                        >
                            <span class="text-overflow">{{ segment.basename }}</span>
                            <span v-if="!segment.deleted && segment.filesize"> ({{ formatBytes(segment.filesize) }}) </span>
                        </a>
                        <span v-if="segment.deleted && !vod.cloud_storage">
                            <strong class="text-is-error">&nbsp;(deleted)</strong>
                        </span>
                        <span v-else-if="segment.deleted && vod.cloud_storage">
                            <strong class="text-is-error">&nbsp;<fa icon="cloud" /></strong> 
                        </span>
                        <span v-else-if="!segment.filesize">
                            <strong class="text-is-error">&nbsp;(filesize missing)</strong>
                        </span>
                    </li>

                    <li v-if="vod.is_vod_downloaded">
                        <a
                            :href="vod.webpath + '/' + vod.basename + '_vod.mp4'"
                            target="_blank"
                            @click.prevent="store.playMedia(vod?.webpath + '/' + vod?.basename + '_vod.mp4')"
                        >Downloaded VOD</a>
                    </li>

                    <template v-if="vod.is_chat_rendered">
                        <li>
                            <a
                                :href="vod.webpath + '/' + vod?.basename + '_chat.mp4'"
                                target="_blank"
                            >Rendered chat</a>
                        </li>
                        <li>
                            <a
                                :href="vod.webpath + '/' + vod?.basename + '_chat_mask.mp4'"
                                target="_blank"
                            >Rendered chat mask</a>
                        </li>
                    </template>

                    <li v-if="vod.is_chat_burned">
                        <a
                            :href="vod?.webpath + '/' + vod?.basename + '_burned.mp4'"
                            target="_blank"
                        >Burned chat</a>
                    </li>
                </ul>
                <span v-if="vod.segments.length === 0">
                    <strong class="text-is-error">No segments found</strong>
                </span>
            </div>

            <!-- bookmark list -->
            <div
                v-if="vod.provider == 'twitch'"
                class="video-bookmarks"
            >
                <strong>{{ $t('vod.bookmarks') }}</strong>
                <ul class="list-segments">
                    <li
                        v-for="(bookmark, i) in vod.bookmarks"
                        :key="i"
                    >
                        {{ formatDuration(bookmark.offset || 0) }} - {{ bookmark.name }}
                        <button
                            class="icon-button"
                            @click="doDeleteBookmark(i)"
                        >
                            <span class="icon"><fa icon="xmark" /></span>
                        </button>
                    </li>
                </ul>
                
                <details class="details">
                    <summary>Create</summary>
                    <div class="field">
                        <label class="label">Name</label>
                        <input
                            v-model="newBookmark.name"
                            class="input"
                            type="text"
                        >
                    </div>
                    <div
                        v-if="vod.is_finalized"
                        class="field"
                    >
                        <label class="label">Offset</label>
                        <input
                            v-model="newBookmark.offset"
                            class="input"
                            type="number"
                        >
                    </div>
                    <button
                        class="button is-small is-confirm"
                        @click="doMakeBookmark"
                    >
                        <span class="icon"><fa icon="plus" /></span>
                        <span>Create</span>
                    </button>
                </details>
            </div>

            <!-- controls -->
            <div
                v-if="vod.is_finalized"
                class="video-controls buttons"
            >
                <button
                    :class="{ 'button': true, 'details-toggle': true, 'is-active': showAdvanced }"
                    title="Show advanced"
                    @click="showAdvanced = !showAdvanced"
                >
                    <span class="icon">
                        <fa
                            v-if="showAdvanced"
                            icon="minus"
                        />
                        <fa
                            v-else
                            icon="plus"
                        />
                    </span>
                </button>
                <!-- Editor -->
                <router-link
                    v-if="vod.video_metadata && vod.video_metadata.type !== 'audio'"
                    class="button is-blue"
                    :to="{ name: 'Editor', params: { uuid: vod?.uuid } }"
                >
                    <span class="icon"><fa
                        icon="cut"
                        type="fa"
                    /></span>
                    <span>{{ $t('vod.controls.editor') }}</span>
                </router-link>

                <!-- Player -->
                <a
                    v-if="vod.is_chat_downloaded || vod.is_chatdump_captured"
                    class="button is-blue"
                    target="_blank"
                    @click="playerMenu ? (playerMenu.show = true) : ''"
                >
                    <span class="icon"><fa
                        icon="play"
                        type="fa"
                    /></span>
                    <span>{{ $t('vod.controls.player') }}</span>
                </a>

                <!-- JSON -->
                <a
                    v-if="showAdvanced"
                    class="button"
                    :href="vod?.webpath + '/' + vod?.basename + '.json'"
                    target="_blank"
                >
                    <span class="icon"><fa
                        icon="database"
                        type="fa"
                    /></span>
                    <span>JSON</span>
                </a>

                <!-- Archive -->
                <a
                    class="button"
                    @click="doArchive"
                >
                    <span class="icon">
                        <fa
                            v-if="!taskStatus.archive"
                            icon="archive"
                            type="fa"
                        />
                        <fa
                            v-else
                            icon="sync"
                            type="fa"
                            spin
                        />
                    </span>
                    <span>{{ $t('vod.controls.archive') }}</span>
                </a>

                <!-- Download chat-->
                <a
                    v-if="vod.provider == 'twitch' && vod.twitch_vod_id && !vod?.is_chat_downloaded"
                    class="button"
                    @click="chatDownloadMenu ? (chatDownloadMenu.show = true) : ''"
                >
                    <span class="icon">
                        <fa
                            v-if="!taskStatus.downloadChat && !compDownloadChat"
                            icon="comments"
                            type="fa"
                        />
                        <fa
                            v-else
                            icon="sync"
                            type="fa"
                            spin
                        />
                    </span>
                    <span>{{ $t('vod.controls.download-chat') }}</span>
                </a>

                <template v-if="vod.provider == 'twitch' && vod.twitch_vod_id">
                    <!-- Download VOD -->
                    <a
                        v-if="!vod.is_vod_downloaded"
                        class="button"
                        @click="vodDownloadMenu ? (vodDownloadMenu.show = true) : ''"
                    >
                        <span class="icon">
                            <fa
                                v-if="!taskStatus.downloadVod"
                                icon="download"
                                type="fa"
                            />
                            <fa
                                v-else
                                icon="sync"
                                type="fa"
                                spin
                            />
                        </span>
                        <span v-if="vod.twitch_vod_muted == MuteStatus.MUTED">{{ $t('vod.controls.download-vod-muted') }}</span>
                        <span v-else>{{ $t('vod.controls.download-vod') }}</span>
                    </a>
                    <!-- Check mute -->
                    <a
                        v-if="showAdvanced"
                        class="button"
                        @click="doCheckMute"
                    >
                        <span class="icon">
                            <fa
                                v-if="!taskStatus.vodMuteCheck"
                                icon="volume-mute"
                                type="fa"
                            />
                            <fa
                                v-else
                                icon="sync"
                                type="fa"
                                spin
                            />
                        </span>
                        <span>{{ $t('vod.controls.check-mute') }}</span>
                    </a>
                </template>

                <a
                    v-if="vod.video_metadata && vod.video_metadata.type !== 'audio'"
                    class="button"
                    @click="burnMenu ? (burnMenu.show = true) : ''"
                >
                    <span class="icon">
                        <fa
                            icon="burn"
                            type="fa"
                        />
                    </span>
                    <span>{{ $t('vod.controls.render-menu') }}</span>
                </a>

                <!-- Fix issues -->
                <a
                    v-if="showAdvanced"
                    class="button"
                    @click="doFixIssues"
                >
                    <span class="icon">
                        <fa
                            icon="wrench"
                            type="fa"
                        />
                    </span>
                    <span>{{ $t('vod.controls.fix-issues') }}</span>
                </a>

                <!-- Vod export menu -->
                <button
                    v-if="showAdvanced"
                    class="button is-confirm"
                    @click="exportVodMenu ? (exportVodMenu.show = true) : ''"
                >
                    <span class="icon">
                        <fa
                            icon="upload"
                            type="fa"
                        />
                    </span>
                    <span>{{ $t('buttons.export') }}</span>
                </button>

                <!-- Vod edit menu -->
                <button
                    v-if="showAdvanced"
                    class="button is-confirm"
                    @click="editVodMenu ? (editVodMenu.show = true) : ''"
                >
                    <span class="icon">
                        <fa
                            icon="pencil"
                            type="fa"
                        />
                    </span>
                    <span>{{ $t('buttons.edit') }}</span>
                </button>

                <!-- Rename vod menu -->
                <button
                    v-if="showAdvanced"
                    class="button is-confirm"
                    @click="renameVodMenu ? (renameVodMenu.show = true) : ''"
                >
                    <span class="icon">
                        <fa
                            icon="pencil"
                            type="fa"
                        />
                    </span>
                    <span>{{ $t('buttons.rename') }}</span>
                </button>

                <!-- Delete segment -->
                <button
                    v-if="showAdvanced"
                    class="button is-danger"
                    :disabled="vod.prevent_deletion"
                    @click="doDeleteSegment(0)"
                >
                    <span class="icon">
                        <fa
                            icon="trash"
                            type="fa"
                        />
                    </span>
                    <span>{{ $t('buttons.delete-segment') }}</span>
                </button>

                <!-- Delete -->
                <button
                    class="button is-danger"
                    :disabled="vod.prevent_deletion"
                    @click="doDelete"
                >
                    <span class="icon">
                        <fa
                            v-if="!taskStatus.delete"
                            icon="trash"
                            type="fa"
                        />
                        <fa
                            v-else
                            icon="sync"
                            type="fa"
                            spin
                        />
                    </span>
                    <span>{{ $t('buttons.delete') }}</span>
                </button>
            </div>

            <div
                v-if="(vod.failed && !vod.is_finalized && !vod.is_capturing) || vod.hasError()"
                class="video-error"
            >
                <strong>
                    <span class="icon"><fa icon="exclamation-triangle" /></span> {{ $t('vod.failed') }}
                </strong>&nbsp;
                <div class="buttons">
                    <!-- Delete -->
                    <button
                        class="button is-danger is-small"
                        :disabled="vod.prevent_deletion"
                        @click="doDelete"
                    >
                        <span class="icon">
                            <fa
                                v-if="!taskStatus.delete"
                                icon="trash"
                                type="fa"
                            />
                            <fa
                                v-else
                                icon="sync"
                                type="fa"
                                spin
                            />
                        </span>
                        <span>{{ $t('buttons.delete') }}</span>
                    </button>

                    <!-- Fix issues -->
                    <button
                        class="button is-confirm is-small"
                        @click="doFixIssues"
                    >
                        <span class="icon">
                            <fa
                                icon="wrench"
                                type="fa"
                            />
                        </span>
                        <span>{{ $t('vod.controls.fix-issues') }}</span>
                    </button>
                </div>
            </div>
            <div
                v-else-if="!vod.is_finalized"
                class="video-status"
            >
                <template v-if="vod.is_converting">
                    <em>
                        <span class="icon"><fa icon="file-signature" /></span>
                        Converting <strong>{{ vod.basename }}.ts</strong> to <strong>{{ vod.basename }}.mp4</strong>
                    </em>
                    <br>
                    <em>
                        <span v-if="vod.getConvertingStatus()">
                            <span class="icon"><fa
                                icon="sync"
                                spin
                            /></span>
                            Running (pid {{ vod.getConvertingStatus() }})
                        </span>
                        <span v-else>
                            <strong class="text-is-error flashing">
                                <span class="icon"><fa icon="exclamation-triangle" /></span> Not running, did it crash?
                            </strong>
                        </span>
                    </em>
                </template>
                <template v-else-if="vod && vod.is_capturing">
                    <em class="text-overflow">
                        <span class="icon"><fa icon="video" /></span>
                        Capturing to <strong>{{ vod.basename }}.ts</strong> (<strong>{{
                            vod.getRecordingSize() ? formatBytes(vod.getRecordingSize() as number) : "unknown"
                        }}</strong>)
                        <span
                            class="icon clickable"
                            title="Refresh"
                            @click="vod && store.fetchAndUpdateVod(vod.uuid)"
                        ><fa icon="sync" /></span>
                    </em>

                    <br>

                    <template v-if="store.cfg('playlist_dump')">
                        <em>
                            <span v-if="vod.getCapturingStatus()">
                                <span class="icon"><fa
                                    icon="sync"
                                    spin
                                /></span>
                                Video capture running (pid
                                {{ vod.getCapturingStatus() }})
                            </span>
                            <span v-else>
                                <strong class="text-is-error flashing">
                                    <span class="icon"><fa icon="exclamation-triangle" /></span>
                                    Video capture not running, did it crash?
                                </strong>
                            </span>
                        </em>
                        <template v-if="store.cfg('chat_dump')">
                            <br><em>
                                <span v-if="vod.getChatDumpStatus()">
                                    <span class="icon"><fa
                                        icon="sync"
                                        spin
                                    /></span>
                                    Chat dump running (pid
                                    {{ vod.getChatDumpStatus() }})
                                </span>
                                <span v-else>
                                    <strong class="text-is-error flashing">
                                        <span class="icon"><fa icon="exclamation-triangle" /></span>
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
            <div
                v-if="vod.is_capturing && vod.getDurationLive() > 86400"
                class="video-error"
            >
                {{ $t('vod.capture-has-been-running-for-over-24-hours-streamlink-does-not-support-this-is-the-capture-stuck') }}
            </div>

            <!-- no chapters error -->
            <div
                v-if="!vod.chapters"
                class="video-error"
            >
                No chapter data!?
            </div>

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
                <table
                    v-if="vod && vod.chapters && vod.chapters.length > 0"
                    class="table game-list is-slim"
                >
                    <thead>
                        <tr>
                            <th>{{ $t('vod.chapters.offset') }}</th>
                            <th v-if="showAdvanced">
                                {{ $t('vod.chapters.started') }}
                            </th>
                            <th v-if="showAdvanced">
                                {{ $t('vod.chapters.ended') }}
                            </th>
                            <th>{{ $t('vod.chapters.duration') }}</th>
                            <th>{{ $t('vod.chapters.category') }}</th>
                            <th>{{ $t('vod.chapters.title') }}</th>
                            <th v-if="hasViewerCount">
                                {{ $t('vod.chapters.viewers') }}
                            </th>
                            <th />
                        </tr>
                    </thead>

                    <tbody>
                        <tr
                            v-for="(chapter, chapterIndex) in vod.chapters"
                            :key="chapterIndex"
                            :class="{
                                favourite: isTwitchChapter(chapter) && store.config && chapter.game_id && store.favourite_games.includes(chapter.game_id.toString()),
                                current: vod && chapterIndex === vod.chapters.length - 1 && vod.is_capturing,
                            }"
                        >
                            <!-- start timestamp -->
                            <td
                                data-contents="offset"
                                :title="formatDate(chapter.started_at)"
                            >
                                {{ chapter.offset !== undefined ? humanDuration(chapter.offset) : "Unknown" }}
                            </td>

                            <!-- start time -->
                            <td
                                v-if="showAdvanced"
                                data-contents="started_at"
                                :title="chapter.started_at.toISOString()"
                            >
                                <span v-if="store.clientCfg('useRelativeTime')">
                                    <duration-display
                                        :start-date="chapter.started_at.toISOString()"
                                        output-style="human"
                                    /> ago
                                </span>
                                <span v-else>{{ formatDate(chapter.started_at, "HH:mm:ss") }}</span>
                            </td>

                            <!-- end time -->
                            <td
                                v-if="showAdvanced"
                                data-contents="ended_at"
                            >
                                <span v-if="chapter.offset !== undefined && chapter.duration !== undefined">
                                    {{ humanDuration(chapter.offset + chapter.duration) }}
                                </span>
                            </td>

                            <!-- duration -->
                            <td data-contents="duration">
                                <span
                                    v-if="chapter.duration"
                                    class="grey"
                                >
                                    {{ niceDuration(chapter.duration) }}
                                </span>
                                <span v-else>
                                    <duration-display
                                        :start-date="chapter.started_at.toISOString()"
                                        output-style="human"
                                    />
                                </span>
                            </td>

                            <!-- chapter name -->
                            <td data-contents="name">
                                <img
                                    v-if="chapter.image_url"
                                    class="boxart"
                                    :src="chapter.image_url"
                                    :alt="chapter.game_name"
                                    loading="lazy"
                                >
                                <template v-if="vod?.is_finalized">
                                    <span class="game-name">
                                        <!-- title with video player link -->
                                        <a
                                            class="px-1"
                                            target="_blank"
                                            :href="playerLink(chapter.offset)"
                                            title="Open in player"
                                        >
                                            {{ chapter.game_name ? chapter.game_name : "None" }}
                                        </a>

                                        <!-- video editor -->
                                        <router-link
                                            rel="noreferrer"
                                            aria-label="Open in editor"
                                            title="Open in editor"
                                            :to="{
                                                name: 'Editor',
                                                params: { uuid: vod.uuid },
                                                query: { start: chapter.offset, end: (chapter.offset || 0) + (chapter.duration || 0), chapter: chapterIndex },
                                            }"
                                        >
                                            <span class="icon"><fa icon="cut" /></span>
                                        </router-link>

                                        <!-- open on twitch link -->
                                        <a
                                            v-if="vod.provider == 'twitch' && vod.twitch_vod_exists && vod.twitch_vod_id && chapter.offset"
                                            :href="twitchVideoLink(vod.twitch_vod_id) + '?t=' + twitchDuration(chapter.offset)"
                                            target="_blank"
                                            rel="noreferrer"
                                            aria-label="Open on Twitch"
                                            title="Open on Twitch"
                                        >
                                            <span class="icon"><fa icon="external-link-alt" /></span>
                                        </a>
                                    </span>
                                </template>
                                <template v-else>
                                    <span class="game-name px-1">{{ chapter.game_name ? chapter.game_name : "None" }}</span>
                                </template>
                                <!-- favourite button -->
                                <button
                                    v-if="store.config && isTwitchChapter(chapter) && chapter.game_id && !store.favourite_games.includes(chapter.game_id.toString())"
                                    class="icon-button favourite-button"
                                    title="Add to favourites"
                                    @click="chapter.game_id && addFavouriteGame(chapter.game_id.toString())"
                                >
                                    <span class="icon"><fa icon="star" /></span>
                                </button>
                            </td>

                            <!-- title -->
                            <td>
                                <span class="text-overflow text-long is-text-darker">{{ chapter.title }}</span>
                            </td>

                            <!-- viewer count -->
                            <td v-if="hasViewerCount">
                                <span
                                    v-if="chapter.viewer_count"
                                    class="grey"
                                >{{ formatNumber(chapter.viewer_count) }}</span>
                            </td>

                            <!-- mature -->
                            <td>
                                <span v-if="isTwitchChapter(chapter) && chapter.is_mature">🔞</span>
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
                                <duration-display :start-date="vod.started_at.toISOString()" />
                            </td>
                            <td colspan="10">
                                <em><strong>{{ $t('vod.chapters.ongoing') }}</strong></em>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <div v-else>
                    <div class="text-is-error padding-1">
                        No chapters found
                    </div>
                </div>
            </div>
        </div>
        <modal-box
            v-if="vod && vod.is_finalized && vod.video_metadata && vod.video_metadata.type !== 'audio'"
            ref="burnMenu"
            title="Render Menu"
        >
            <render-modal :vod="vod" />
        </modal-box>
        <modal-box
            ref="chatDownloadMenu"
            title="Chat download"
        >
            <div class="buttons is-centered">
                <button
                    class="button is-confirm"
                    @click="doDownloadChat('tcd')"
                >
                    <span class="icon"><fa icon="download" /></span>
                    <span>{{ $t('vod.buttons.download-with', ['tcd']) }}</span>
                </button>
                <button
                    class="button is-confirm"
                    @click="doDownloadChat('td')"
                >
                    <span class="icon"><fa icon="download" /></span>
                    <span>{{ $t('vod.buttons.download-with', ['TwitchDownloader']) }}</span>
                </button>
            </div>
        </modal-box>
        <modal-box
            ref="vodDownloadMenu"
            title="VOD download"
        >
            <div class="is-centered">
                <div class="field">
                    <label class="label">Quality</label>
                    <select
                        v-model="vodDownloadSettings.quality"
                        class="input"
                    >
                        <option
                            v-for="quality in VideoQualityArray"
                            :key="quality"
                            :value="quality"
                        >
                            {{ quality }}
                        </option>
                    </select>
                </div>
                <div class="field">
                    <button
                        class="button is-confirm"
                        @click="doDownloadVod"
                    >
                        <span class="icon"><fa icon="download" /></span>
                        <span>Download</span>
                    </button>
                </div>
            </div>
        </modal-box>
        <modal-box
            ref="playerMenu"
            title="Player"
        >
            <div class="columns">
                <div class="column">
                    <h3>VOD source</h3>
                    <ul class="radio-list">
                        <li>
                            <label>
                                <input
                                    v-model="playerSettings.vodSource"
                                    type="radio"
                                    value="captured"
                                > Captured
                            </label>
                        </li>
                        <li>
                            <label>
                                <input
                                    v-model="playerSettings.vodSource"
                                    type="radio"
                                    value="downloaded"
                                    :disabled="!vod?.is_vod_downloaded"
                                > Downloaded
                            </label>
                        </li>
                    </ul>
                </div>
                <div class="column">
                    <h3>Chat source</h3>
                    <ul class="radio-list">
                        <li>
                            <label>
                                <input
                                    v-model="playerSettings.chatSource"
                                    type="radio"
                                    value="captured"
                                > Captured
                            </label>
                        </li>
                        <li>
                            <label>
                                <input
                                    v-model="playerSettings.chatSource"
                                    type="radio"
                                    value="downloaded"
                                    :disabled="!vod?.is_chat_downloaded"
                                > Downloaded
                            </label>
                        </li>
                    </ul>
                </div>
            </div>
            <br>
            <div class="field">
                <button
                    class="button is-confirm"
                    @click="openPlayer"
                >
                    <span class="icon"><fa icon="play" /></span>
                    <span>Play</span>
                </button>
            </div>
        </modal-box>
        <modal-box
            ref="editVodMenu"
            :title="$t('vod.edit.edit-vod')"
            max-width="1200px"
        >
            <edit-modal
                :vod="vod"
                @close="editVodMenu ? editVodMenu.show = false : ''"
            />
        </modal-box>
        <modal-box
            ref="exportVodMenu"
            title="Export VOD"
        >
            <export-modal :vod="vod" />
        </modal-box>
        <modal-box
            ref="renameVodMenu"
            :title="$t('vod.edit.rename-vod')"
        >
            <div class="field">
                {{ $t('vod.rename.current-name-vod-basename', [vod?.basename]) }}
            </div>
            <div class="field">
                <label class="label">{{ $t('vod.edit.template') }}</label>
                <div class="control">
                    <input
                        v-model="renameVodSettings.template"
                        class="input"
                        type="text"
                    >
                    <ul class="template-replacements">
                        <li
                            v-for="(v, k) in VodBasenameFields"
                            :key="k"
                        >
                            {{ k }}
                        </li>
                    </ul>
                    <p class="template-preview">
                        {{ renameVodTemplatePreview }}
                    </p>
                </div>
            </div>
            <div class="field">
                <button
                    class="button is-confirm"
                    @click="doRenameVod"
                >
                    <span class="icon"><fa icon="save" /></span>
                    <span>{{ $t("buttons.rename") }}</span>
                </button>
            </div>
        </modal-box>
    </div>
</template>

<script lang="ts" setup>
import type { VodBasenameTemplate } from "@common/Replacements";
import { VodBasenameFields, ExporterFilenameFields } from "@common/ReplacementsConsts";
import { computed, onMounted, ref, watch } from "vue";
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
import { ChapterTypes, useStore, VODTypes } from "@/store";
import ModalBox from "./ModalBox.vue";
import RenderModal from "./vod/RenderModal.vue";
import ExportModal from "./vod/ExportModal.vue";
import EditModal from "./vod/EditModal.vue";
import { MuteStatus, VideoQualityArray } from "../../../common/Defs";
import { ApiResponse, ApiSettingsResponse } from "@common/Api/Api";
import { formatString } from "@common/Format";
import { format } from "date-fns";
import { TwitchVODChapter } from "@/core/Providers/Twitch/TwitchVODChapter";
import axios from "axios";
import { useRoute } from "vue-router";
import { isTwitchVOD } from "@/mixins/newhelpers";
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

const props = defineProps({
    vod: {
        type: Object as () => VODTypes,
        required: true,
    },
});
const emit = defineEmits(["forceFetchData", "refresh"]);
    
const store = useStore();
const route = useRoute();
const burnMenu = ref<InstanceType<typeof ModalBox>>();
const chatDownloadMenu = ref<InstanceType<typeof ModalBox>>();
const vodDownloadMenu = ref<InstanceType<typeof ModalBox>>();
const playerMenu = ref<InstanceType<typeof ModalBox>>();
const editVodMenu = ref<InstanceType<typeof ModalBox>>();
const exportVodMenu = ref<InstanceType<typeof ModalBox>>();
const renameVodMenu = ref<InstanceType<typeof ModalBox>>();


const config = ref<ApiSettingsResponse>();
const taskStatus = ref({
    /** @deprecated */
    vodMuteCheck: false,
    archive: false,
    downloadChat: false,
    renderChat: false,
    downloadVod: false,
    fullBurn: false,
    delete: false,
    fixIssues: false,
});
const chatDownloadMethod = ref("tcd");
const showAdvanced = ref(false);
const minimized = ref(getDefaultMinimized());
const vodDownloadSettings = ref({
    quality: "best",
});
const playerSettings = ref({
    vodSource: "captured",
    chatSource: "captured",
});
const renameVodSettings = ref({
    template: "",
});
const newBookmark = ref({
    name: "",
    offset: 0,
});

    
    
const compDownloadChat = computed(() => {
    if (!store.jobList) return false;
    for (const job of store.jobList) {
        if (job.name == `tcd_${props.vod.basename}`) {
            return true;
        }
    }
    return false;
});

const hasViewerCount = computed(() => {
    if (!props.vod) return false;
    if (!props.vod.chapters) return false;
    return props.vod.chapters.some((chapter) => {
        return chapter.viewer_count && chapter.viewer_count > 0;
    });
});

const audioOnly = computed(() => {
    if (!props.vod) return false;
    if (!props.vod.video_metadata) return false;
    return props.vod.video_metadata.type == 'audio';
});

const renameVodTemplatePreview = computed(() => {
    if (!props.vod) return "";
    const date = props.vod.started_at;
    const replacements: VodBasenameTemplate = {
        login:              props.vod.provider == 'twitch' ? props.vod.streamer_login : "",
        internalName:       props.vod.getChannel().internalName,
        displayName:        props.vod.getChannel().displayName,
        date:               date ? format(date, "yyyy-MM-dd'T'HH:mm:ss'Z'").replaceAll(":", "_") : "",
        year:               date ? format(date, "yyyy") : "",
        year_short:         date ? format(date, "yy") : "",
        month:              date ? format(date, "MM") : "",
        day:                date ? format(date, "dd") : "",
        hour:               date ? format(date, "HH") : "",
        minute:             date ? format(date, "mm") : "",
        second:             date ? format(date, "ss") : "",
        id:                 "1234",
        season:             props.vod.stream_season || "",
        absolute_season:    props.vod.stream_absolute_season ? props.vod.stream_absolute_season.toString().padStart(2, "0") : "",
        episode:            props.vod.stream_number ? props.vod.stream_number.toString().padStart(2, "0") : "",
    };
    const replaced_string = formatString(renameVodSettings.value.template, replacements);
    return replaced_string;
});

/*  
watch: {
    // watch hash
    $route(to, from) {
        if (to.hash !== from.hash) {
            const basename = to.hash.substr(5);
            if (basename == props.vod.basename) this.minimized = false;
        }
    },
},
*/

watch(() => route.hash, (to, from) => {
    if (to !== from) {
        const uuid = to.substring(5);
        if (uuid == props.vod.uuid) minimized.value = false;
    }
});

onMounted(() => {
    if (props.vod) {
        if (!props.vod.chapters) {
            console.error("No chapters found for vod", props.vod.basename, props.vod);
        } else if (props.vod.chapters && props.vod.chapters.length == 0) {
            console.error("Chapters array found but empty for vod", props.vod.basename, props.vod);
        }
    }
    renameVodSettings.value.template = store.cfg("filename_vod", "");
});


function doArchive() {
    if (!props.vod) return;
    if (!confirm(`Do you want to archive "${props.vod?.basename}"?`)) return;
    // taskStatus.archive = true;
    axios
        .post(`/api/v0/vod/${props.vod.uuid}/save`)
        .then((response) => {
            const json: ApiResponse = response.data;
            if (json.message) alert(json.message);
            console.log(json);
            // this.taskStatus.archive = false;
            emit("refresh");
        })
        .catch((err) => {
            console.error("form error", err.response);
            if (err.response.data && err.response.data.message) alert(err.response.data.message);
            // this.taskStatus.archive = false;
        });
}

function doDownloadChat(method = "tcd") {
    if (!props.vod) return;
    if (!confirm(`Do you want to download the chat for "${props.vod.basename}" with ${method}?`)) return;
    axios
        .post(`/api/v0/vod/${props.vod.uuid}/download_chat?method=${method}`)
        .then((response) => {
            const json: ApiResponse = response.data;
            if (json.message) alert(json.message);
            console.log(json);
            emit("refresh");
            if (props.vod) store.fetchAndUpdateVod(props.vod.uuid);
        })
        .catch((err) => {
            console.error("form error", err.response);
            if (err.response.data && err.response.data.message) alert(err.response.data.message);
        });
}

// doRenderChat(useVod = false) {
//     /** TODO: implement */
//     alert(`RenderChat not implemented: ${useVod}`);
// },

function doDownloadVod() {
    if (!props.vod) return;
    if (!VideoQualityArray.includes(vodDownloadSettings.value.quality)) {
        alert(`Invalid quality: ${vodDownloadSettings.value.quality}`);
        return;
    }

    axios
        .post(`/api/v0/vod/${props.vod.uuid}/download?quality=${vodDownloadSettings.value.quality}`)
        .then((response) => {
            const json: ApiResponse = response.data;
            if (json.message) alert(json.message);
            console.log(json);
            emit("refresh");
        })
        .catch((err) => {
            console.error("form error", err.response);
            if (err.response.data && err.response.data.message) alert(err.response.data.message);
        });
}

function doCheckMute() {
    if (!props.vod) return;
    axios
        .post(`/api/v0/vod/${props.vod.uuid}/check_mute`)
        .then((response) => {
            const json: ApiResponse = response.data;
            if (json.message) alert(json.message);
            console.log(json);

            if (json.data) {
                if (json.data.muted === null || json.data.muted === MuteStatus.UNKNOWN) {
                    alert(`The vod "${props.vod?.basename}" could not be checked.`);
                } else {
                    alert(`The vod "${props.vod?.basename}" is${json.data.muted === MuteStatus.MUTED ? "" : " not"} muted.`);
                }
            }
            emit("refresh");
        })
        .catch((err) => {
            console.error("doCheckMute error", err.response);
            if (err.response.data) {
                const json = err.response.data;
                if (json.message) alert(json.message);
            }
        });
}

// doFullBurn() {
//     /** TODO: implement */
//     alert("FullBurn");
// },

function doDelete() {
    if (!props.vod) return;
    if (!confirm(`Do you want to delete "${props.vod?.basename}"?`)) return;
    if (isTwitchVOD(props.vod) && props.vod.twitch_vod_exists === false && !confirm(`The VOD "${props.vod?.basename}" has been deleted from twitch, are you still sure?`)) return;
    axios
        .delete(`/api/v0/vod/${props.vod.uuid}`)
        .then((response) => {
            const json: ApiResponse = response.data;
            if (json.message) alert(json.message);
            console.log(json);
            emit("refresh");
            if (props.vod && isTwitchVOD(props.vod)) store.fetchAndUpdateStreamer(props.vod.channel_uuid);
        })
        .catch((err) => {
            console.error("form error", err.response);
            if (err.response.data && err.response.data.message) alert(err.response.data.message);
        });
}

function doDeleteSegment(index = 0) {
    if (!props.vod) return;
    if (!confirm(`Do you want to delete segment ${index} of "${props.vod?.basename}"?`)) return;
    const keepEntry = confirm(`Do you want to keep the entry and mark it as cloud storage?`);
    if (isTwitchVOD(props.vod) && props.vod.twitch_vod_exists === false && !confirm(`The VOD "${props.vod?.basename}" has been deleted from twitch, are you still sure?`)) return;
    axios
        .post(`/api/v0/vod/${props.vod.uuid}/delete_segment?segment=${index}&keep_entry=${keepEntry ? "true" : "false"}`)
        .then((response) => {
            const json: ApiResponse = response.data;
            if (json.message) alert(json.message);
            console.log(json);
            emit("refresh");
            if (props.vod && isTwitchVOD(props.vod)) store.fetchAndUpdateStreamer(props.vod.channel_uuid);
        })
        .catch((err) => {
            console.error("form error", err.response);
            if (err.response.data && err.response.data.message) alert(err.response.data.message);
        });
}

function doFixIssues() {
    if (!props.vod) return;
    axios
        .post(`/api/v0/vod/${props.vod.uuid}/fix_issues`)
        .then((response) => {
            const json: ApiResponse = response.data;
            if (json.message) alert(json.message);
            console.log(json);
            emit("refresh");
        })
        .catch((err) => {
            console.error("form error", err.response);
            if (err.response.data && err.response.data.message) alert(err.response.data.message);
        });
}

/*
unbreak() {
    if (!this.vod) return;
    // this.burnLoading = true;
    console.debug("doUnbreak", this.vod);
    axios
        .post(`/api/v0/vod/${this.vod.uuid}/unbreak`)
        .then((response) => {
            const json: ApiResponse = response.data;
            if (json.message) alert(json.message);
            console.log(json);
            emit("refresh");
        })
        .catch((err) => {
            console.error("unbreak response error", err.response);
            if (err.response.data && err.response.data.message) alert(err.response.data.message);
        })
        .finally(() => {
            // this.burnLoading = false;
        });
},
*/

function addFavouriteGame(game_id: string) {
    if (!store.config) return;
    axios
        .patch(`/api/v0/favourites`, { game: game_id })
        .then((response) => {
            const json: ApiResponse = response.data;
            if (json.message) alert(json.message);
            console.log(json);

            // fetch the new config
            axios.get(`/api/v0/settings`).then((response) => {
                const settings_json: ApiSettingsResponse = response.data;
                store.updateConfig(settings_json.data.config);
                store.updateFavouriteGames(settings_json.data.favourite_games);
            });
        })
        .catch((err) => {
            console.error("form error", err.response);
            if (err.response.data && err.response.data.message) alert(err.response.data.message);
        });
}

function playerLink(offset = 0, chatdownload = false): string {
    if (!store.config) return "#";
    const video_path = `${props.vod.webpath}/${props.vod.basename}.mp4`;
    const chat_path = `${props.vod.webpath}/${props.vod.basename}.${chatdownload ? "chat" : "chatdump"}`;
    return `${store.cfg<string>("basepath", "")}/vodplayer/index.html#source=file_http&video_path=${video_path}&chatfile=${chat_path}&offset=${offset}`;
}

function twitchVideoLink(video_id: string): string {
    return `https://www.twitch.tv/videos/${video_id}`;
}

function matchVod() {
    if (!props.vod) return;
    axios
        .post(`/api/v0/vod/${props.vod.uuid}/match`)
        .then((response) => {
            const json: ApiResponse = response.data;
            if (json.message) alert(json.message);
            console.log(json);
            emit("refresh");
        })
        .catch((err) => {
            console.error("form error", err.response);
            if (err.response.data && err.response.data.message) alert(err.response.data.message);
        });
}

function getDefaultMinimized() {
    if (store.clientCfg("minimizeVodsByDefault")) {
        return !props.vod.is_capturing;
    }
    return false;
}

function openPlayer() {
    let url = `${store.cfg<string>("basepath", "")}/vodplayer/index.html#&`;
    url += "source=file_http";
    if (playerSettings.value.vodSource == "captured"){
        url += `&video_path=${props.vod.webpath}/${props.vod.basename}.mp4`;
    } else {
        url += `&video_path=${props.vod.webpath}/${props.vod.basename}_vod.mp4`;
    }

    if (playerSettings.value.chatSource == "captured"){
        url += `&chatfile=${props.vod.webpath}/${props.vod.basename}.chatdump`;
    } else {
        url += `&chatfile=${props.vod.webpath}/${props.vod.basename}_chat.json`;
    }

    // url.searchParams.set("offset", this.playerSettings.offset.toString());
    window.open(url.toString(), "_blank");

}

function templatePreview(template: string): string {
    /*
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
    */
    const replaced_string = formatString(template, Object.fromEntries(Object.entries(ExporterFilenameFields).map(([key, value]) => [key, value.display])));
    return replaced_string;
}

function doMakeBookmark() {
    if (!props.vod) return;
    axios.post(`/api/v0/vod/${props.vod.uuid}/bookmark`, newBookmark.value).then((response) => {
        const json: ApiResponse = response.data;
        if (json.message) alert(json.message);
        console.log(json);
        if (props.vod) store.fetchAndUpdateVod(props.vod.uuid);
        // if (this.editVodMenu) this.editVodMenu.show = false;
    }).catch((err) => {
        console.error("form error", err.response);
        if (err.response.data && err.response.data.message) alert(err.response.data.message);
    });
}

function doDeleteBookmark(i: number) {
    if (!props.vod) return;
    axios.delete(`/api/v0/vod/${props.vod.uuid}/bookmark?index=${i}`).then((response) => {
        const json: ApiResponse = response.data;
        if (json.message) alert(json.message);
        console.log(json);
        if (props.vod) store.fetchAndUpdateVod(props.vod.uuid);
        // if (this.editVodMenu) this.editVodMenu.show = false;
    }).catch((err) => {
        console.error("form error", err.response);
        if (err.response.data && err.response.data.message) alert(err.response.data.message);
    });
}

function doRenameVod() {
    if (!props.vod) return;
    axios.post(`/api/v0/vod/${props.vod.uuid}/rename`, renameVodSettings.value).then((response) => {
        const json: ApiResponse = response.data;
        if (json.message) alert(json.message);
        console.log(json);
        store.fetchAndUpdateStreamerList();
        if (renameVodMenu.value) renameVodMenu.value.show = false;
    }).catch((err) => {
        console.error("form error", err.response);
        if (err.response.data && err.response.data.message) alert(err.response.data.message);
    });
}

function isTwitchChapter(chapter: ChapterTypes): chapter is TwitchVODChapter {
    return chapter instanceof TwitchVODChapter;
}
    
</script>

<style lang="scss" scoped>
@import "../assets/_variables";

.video {
    margin-bottom: 10px;
    // border-bottom: 1px solid #eee;

    &.is-recording {
        &.is-animated {
            .video-title {
                animation: recording ease-in-out 1s infinite;
            }
        }

        .video-title {
            background-color: $recording-base;

            &:hover {
                background-color: lighten($favourite-base, 5%);
            }

        }
    }

    &.is-converting {
        .video-title {
            background-color: $converting-base;

            &:hover {
                background-color: lighten($favourite-base, 5%);
            }

        }
    }

    &.is-favourite {
        .video-title {
            background-color: $favourite-base;

            &:hover {
                background-color: lighten($favourite-base, 5%);
            }

        }
    }
}

.video-title {
    padding: 10px;
    $bg-color: #2b61d6;
    background: $bg-color;
    color: #fff;

    // good idea?
    position: sticky;
    top: 50px;
    z-index: 1;

    display: flex;

    word-break: break-all;

    cursor: pointer;

    &:hover {
        background-color: lighten($bg-color, 5%);
    }

    .icon {
        margin-right: 0.3em;
    }

    h3 {
        margin: 0;
        padding: 0;
        // text-shadow: 0 2px 0 #1e4599;
        // text-shadow: 0 2px 0 rgba(0, 0, 0, 0.2);
    }

    .video-title-text {
        flex-grow: 1;
    }

    .video-title-actions {
        display: flex;
        // center horizontal and vertical
        justify-content: center;
        align-items: center;
    }
}

.video-content {
    overflow: hidden;
}

.video-sxe {
    font-family: "Roboto Condensed";
    color: rgba(255, 255, 255, 0.5);

    &:before {
        content: " · ";
    }
}

.video-filename {
    font-family: "Roboto Condensed";
    color: rgba(255, 255, 255, 0.5);

    &:before {
        content: " · ";
    }
}

.video-description {
    padding: 10px;
    background: var(--video-description-background-color);
    // border-left: 1px solid #e3e3e3;
    // border-right: 1px solid #e3e3e3;
}

.video-controls {
    padding: 10px;
    background-color: var(--video-controls-background-color);
    // border-top: 1px solid #d6dbf2;
    // border-bottom: 1px solid #d6dbf2;
    // border-left: 1px solid #e3e3e3;
    // border-right: 1px solid #e3e3e3;

    .icon {
        margin-right: 0.3em;
    }
}

.video-status {
    padding: 10px;
    background-color: #b3ddad;
    color: #222;
    // border-top: 1px solid #a1bd9b;
    // border-bottom: 1px solid #a1bd9b;
    // border-left: 1px solid #e3e3e3;
    // border-right: 1px solid #e3e3e3;
}

.video-segments {
    padding: 10px;
    background-color: var(--video-segments-background-color);
    // border-top: 1px solid #d6dbf2;
    // border-left: 1px solid #e3e3e3;
    // border-right: 1px solid #e3e3e3;
}

.video-bookmarks {
    padding: 10px;
    background-color: var(--video-bookmarks-background-color);
    // border-top: 1px solid #d6dbf2;
    // border-left: 1px solid #e3e3e3;
    // border-right: 1px solid #e3e3e3;
}

.video-chapters {
    // border-left: 1px solid #e3e3e3;
    // border-right: 1px solid #e3e3e3;
    // border-bottom: 1px solid #e3e3e3;
}

.video-error {
    background: #f00;
    padding: 10px;
    color: #fff;
    font-weight: 700;

    a {
        color: #ffff00;

        &:hover {
            color: #fff;
        }
    }
}

.video-comment {
    padding: 1em;
    background-color: var(--video-comment-background-color);
    border-radius: 1em;
    width: max-content;
    p {
        margin: 0;
        padding: 0;
        white-space: pre;
    }

    position: relative;

    box-shadow: 0 5px 10px rgba(0, 0, 0, 0.2);

    margin: 1em 0 1.5em 0;

    // comment bubble tip
    &:before {
        content: "";
        position: absolute;
        bottom: -10px;
        left: 15px;
        width: 0;
        height: 0;
        border-style: solid;
        border-width: 10px 10px 0 10px;
        border-color: var(--video-comment-background-color) transparent transparent transparent;

    }
}

.info-columns {
    margin-top: 5px;
    display: flex;

    h4 {
        font-size: 110%;
        margin: 0;
        padding: 0;
    }

    .info-column {
        flex-grow: 1;
        padding-right: 20px;

        &:last-child {
            padding-right: 0;
        }
    }

    .video-info {
        color: var(--text-darker);
        margin: 0;
        padding: 0;
        list-style: none;
        list-style-type: none;
        line-height: 1.4em;
        text-overflow: ellipsis;
        overflow: hidden;
        word-break: break-word;
    }
}

.game-list {

    width: 100%;
    border-collapse: collapse;

    tr:nth-child(2n) {
        background: rgba(0, 0, 0, 0.05);
    }

    /*
	thead {
		background-color: #1e4599;
		color: #eee;
	}
	*/
    td:nth-child(4) {
        color: #444;
    }

    tr.favourite {
        background-color: var(--gamelist-favourite);

        td {
            background-color: var(--gamelist-favourite);
        }
    }

    tr.current {
        background-color: var(--gamelist-current);
    }

    a {
        // color: blue;
        text-decoration: none;

        // &:hover {
        //     color: #4481d1;
        // }
        // 
        // &:visited {
        //     color: purple;
        // }
    }
}

</style>