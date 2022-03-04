<template>
    <div
        v-if="vod"
        :class="{
            video: true,
            'is-animated': store.clientConfig.animationsEnabled,
            'is-recording': vod.is_capturing,
            'is-converting': vod.is_converting,
            'is-finalized': vod.is_finalized,
            'is-favourite': vod.api_hasFavouriteGame,
        }"
    >
        <div :id="'vod_' + vod?.basename" class="anchor"></div>

        <!-- title -->
        <div class="video-title">
            <h3>
                <span class="icon"><fa icon="file-video"></fa></span>
                <span class="video-date" :title="formatDate(vod?.dt_started_at.date)" v-if="vod?.dt_started_at">{{
                    store.clientConfig.useRelativeTime ? humanDate(vod?.dt_started_at.date, true) : formatDate(vod?.dt_started_at.date)
                }}</span>
                <span class="video-filename">{{ vod?.basename }}</span>
            </h3>
        </div>

        <!-- description -->
        <div class="video-description">
            <!-- box art -->
            <div class="boxart-carousel is-small" v-if="vod && vod.api_getUniqueGames">
                <div v-for="game in vod.api_getUniqueGames" :key="game.id" class="boxart-item">
                    <img v-if="game.image_url" :title="game.name" :alt="game.name" :src="game.image_url" loading="lazy" />
                    <span v-else>{{ game.name }}</span>
                </div>
            </div>

            <!-- video info -->
            <div v-if="vod?.is_finalized" class="info-columns">
                <div class="info-column">
                    <h4>General</h4>
                    <ul class="video-info">
                        <li>
                            <strong>Webhook duration:</strong>
                            {{ vod?.api_getWebhookDuration }}
                        </li>
                        <li>
                            <strong>Stream start:</strong>
                            {{ formatDate(vod?.dt_started_at.date, "yyyy-MM-dd HH:mm:ss") }}
                        </li>
                        <template v-if="vod?.dt_capture_started">
                            <li>
                                <strong>Capture start:</strong>
                                {{ formatDate(vod?.dt_capture_started.date, "yyyy-MM-dd HH:mm:ss") }}
                            </li>
                            <li>
                                <strong>Conversion start:</strong>
                                {{ formatDate(vod?.dt_conversion_started.date, "yyyy-MM-dd HH:mm:ss") }}
                            </li>
                        </template>
                        <li>
                            <strong>Missing from captured file:</strong>
                            <span class="px-1" v-if="vod?.twitch_vod_duration">{{ humanDuration(vod?.twitch_vod_duration - vod?.api_getDuration) }}</span>
                            <span class="px-1" v-else>
                                <strong><em>No data</em></strong>
                            </span>
                        </li>
                        <li>
                            <strong>Chat downloaded:</strong>
                            {{ vod?.is_chat_downloaded ? "Yes" : "No" }}
                        </li>
                        <li>
                            <strong>Chat dumped:</strong>
                            {{ vod?.is_chatdump_captured ? "Yes" : "No" }}
                        </li>
                        <li>
                            <strong>Chat rendered:</strong>
                            {{ vod?.is_chat_rendered ? "Yes" : "No" }}
                        </li>
                        <li>
                            <strong>Chat burned:</strong>
                            {{ vod?.is_chat_burned ? "Yes" : "No" }}
                        </li>
                    </ul>
                </div>

                <div class="info-column">
                    <h4>Capture</h4>
                    <ul class="video-info">
                        <li>
                            <strong>File duration:</strong>
                            {{ humanDuration(vod?.api_getDuration) }}
                        </li>
                        <li>
                            <strong>Size:</strong>
                            {{ formatBytes(vod?.segments[0].filesize) }}
                        </li>
                        <template v-if="vod?.video_metadata_public && vod?.video_metadata_public.video && vod?.video_metadata_public.audio">
                            <li>
                                <strong>Dimensions:</strong>
                                {{ vod?.video_metadata_public.video.Width }}x{{ vod?.video_metadata_public.video.Height }}
                            </li>
                            <li>
                                <strong>Framerate:</strong>
                                {{ vod?.video_metadata_public.video.FrameRate_Mode }}
                                {{
                                    vod?.video_metadata_public.video.FrameRate_Original
                                        ? vod?.video_metadata_public.video.FrameRate_Original
                                        : vod?.video_metadata_public.video.FrameRate
                                }}
                            </li>
                            <li>
                                <strong>Total:</strong>
                                {{ Math.round(parseInt(vod?.video_metadata_public.general.OverallBitRate) / 1000) }}kbps
                            </li>
                            <li>
                                <strong>Video:</strong>
                                {{ vod?.video_metadata_public.video.Format }}
                                {{ vod?.video_metadata_public.video.BitRate_Mode }}
                                {{ Math.round(parseInt(vod?.video_metadata_public.video.BitRate) / 1000) }}kbps
                            </li>
                            <li>
                                <strong>Audio:</strong>
                                {{ vod?.video_metadata_public.audio.Format }}
                                {{ vod?.video_metadata_public.audio.BitRate_Mode }}
                                {{ Math.round(parseInt(vod?.video_metadata_public.audio.BitRate) / 1000) }}kbps
                            </li>
                        </template>
                    </ul>
                </div>

                <!-- Twitch VOD -->
                <div class="info-column">
                    <h4>Twitch VOD</h4>
                    <ul class="video-info">
                        <template v-if="vod?.twitch_vod_exists === true">
                            <li>
                                <strong>Duration:</strong>
                                <span class="px-1" v-if="vod?.twitch_vod_duration">{{ humanDuration(vod?.twitch_vod_duration) }}</span>
                                <span class="px-1" v-else>
                                    <strong><em>No data</em></strong>
                                </span>
                            </li>
                            <li>
                                <strong>ID:</strong>
                                <span class="px-1" v-if="vod?.twitch_vod_url">
                                    <a :href="vod?.twitch_vod_url" rel="noreferrer" target="_blank">{{ vod?.twitch_vod_id }}</a>
                                </span>
                                <span class="px-1" v-else>
                                    <strong><em>Not matched or VOD deleted</em></strong>
                                </span>
                            </li>
                            <li>
                                <strong>Date:</strong>&#32;
                                <span class="px-1" v-if="vod?.twitch_vod_date">{{ formatDate(vod?.twitch_vod_date) }}</span>
                                <span class="px-1" v-else>
                                    <strong><em>No data</em></strong>
                                </span>
                            </li>
                            <li>
                                <strong>Title:</strong>
                                <span class="px-1 text-overflow" v-if="vod?.twitch_vod_title">
                                    {{ vod?.twitch_vod_title }}
                                </span>
                                <span class="px-1" v-else>
                                    <strong><em>No data</em></strong>
                                </span>
                            </li>
                            <li>
                                <strong>Is muted:</strong>
                                <span class="px-1" v-if="vod?.twitch_vod_muted === true"><strong class="is-error">Yes</strong></span>
                                <span class="px-1" v-else-if="vod?.twitch_vod_muted === false">No</span>
                                <span class="px-1" v-else><em>No data</em></span>
                            </li>
                        </template>
                        <template v-else-if="vod?.twitch_vod_exists === false">
                            <li>
                                <strong class="is-error">VOD is deleted</strong>
                            </li>
                            <li>
                                <span v-if="vod?.twitch_vod_id">
                                    The ID was <a :href="vod?.twitch_vod_url" rel="noreferrer" target="_blank">{{ vod?.twitch_vod_id }}</a
                                    >.
                                </span>
                                <span v-else>The VOD probably never got saved.</span>
                            </li>
                        </template>
                        <template v-else>
                            <li>
                                <em>VOD has not been checked</em>
                            </li>
                        </template>
                        <li>
                            <strong>Downloaded:</strong>
                            {{ vod?.is_vod_downloaded ? "Yes" : "No" }}
                        </li>
                    </ul>
                </div>
            </div>

            <div v-if="vod?.is_capturing" class="info-columns">
                <div class="info-column">
                    <h4>Recording</h4>
                    <ul class="video-info">
                        <li>
                            <strong>Current duration:</strong> <duration-display :startDate="vod.dt_started_at.date" outputStyle="human"></duration-display>
                        </li>
                        <li>
                            <strong>Watch live:</strong>
                            <a :href="'https://twitch.tv/' + vod.streamer_login" rel="noreferrer" target="_blank">Twitch</a>
                            / <a :href="vod?.webpath + '/' + vod?.basename + '.m3u8'" rel="noreferrer" target="_blank">Recap</a>
                        </li>
                    </ul>
                    <button class="button is-small is-danger" @click="unbreak">Unbreak</button>
                </div>
            </div>
        </div>

        <!-- segment list -->
        <div v-if="vod?.is_finalized" class="video-segments">
            <strong>Segments</strong>
            <ul class="list-segments" v-if="vod && vod.segments">
                <li v-for="segment in vod.segments" :key="segment.basename">
                    <a :href="vod?.webpath + '/' + segment.basename">
                        <span class="text-overflow">{{ segment.basename }}</span>
                        <span v-if="!segment.deleted"> ({{ formatBytes(segment.filesize) }}) </span>
                    </a>
                    <span v-if="segment.deleted">
                        <strong class="is-error">&nbsp;(deleted)</strong>
                    </span>
                </li>

                <li v-if="vod?.is_vod_downloaded">
                    <a :href="vod?.webpath + '/' + vod?.basename + '_vod.mp4'">Downloaded VOD</a>
                </li>

                <template v-if="vod?.is_chat_rendered">
                    <li>
                        <a :href="vod?.webpath + '/' + vod?.basename + '_chat.mp4'">Rendered chat</a>
                    </li>
                    <li>
                        <a :href="vod?.webpath + '/' + vod?.basename + '_chat_mask.mp4'">Rendered chat mask</a>
                    </li>
                </template>

                <li v-if="vod?.is_chat_burned">
                    <a :href="vod?.webpath + '/' + vod?.basename + '_burned.mp4'">Burned chat</a>
                </li>
            </ul>
        </div>

        <!-- controls -->
        <div class="video-controls" v-if="vod?.is_finalized">
            <!-- Editor -->
            <router-link class="button is-blue" :to="{ name: 'Editor', params: { vod: vod?.basename } }">
                <span class="icon"><fa icon="cut" type="fa"></fa></span>
                Editor
            </router-link>

            <!-- Player -->
            <a v-if="vod?.is_chat_downloaded" class="button is-blue" :href="playerLink(0, true)" target="_blank">
                <span class="icon"><fa icon="play" type="fa"></fa></span>
                Player (chat dl)
            </a>

            <a v-if="vod?.is_chatdump_captured" class="button is-blue" :href="playerLink()" target="_blank">
                <span class="icon"><fa icon="play" type="fa"></fa></span>
                Player (chat dump)
            </a>

            <!-- JSON -->
            <a class="button" :href="vod?.webpath + '/' + vod?.basename + '.json'" target="_blank">
                <span class="icon"><fa icon="database" type="fa"></fa></span>
                JSON
            </a>

            <!-- Archive -->
            <a class="button" @click="doArchive">
                <span class="icon">
                    <fa icon="archive" type="fa" v-if="!taskStatus.archive"></fa>
                    <fa icon="sync" type="fa" spin="true" v-else></fa>
                </span>
                Archive
            </a>

            <!-- Download chat-->
            <a v-if="vod?.twitch_vod_id && !vod?.is_chat_downloaded" class="button" @click="chatDownloadMenu ? (chatDownloadMenu.show = true) : ''">
                <span class="icon">
                    <fa icon="comments" type="fa" v-if="!taskStatus.downloadChat && !compDownloadChat"></fa>
                    <fa icon="sync" type="fa" spin="true" v-else></fa>
                </span>
                Download chat
            </a>

            <template v-if="vod?.twitch_vod_id">
                <a v-if="!vod?.is_vod_downloaded" class="button" @click="doDownloadVod">
                    <span class="icon">
                        <fa icon="download" type="fa" v-if="!taskStatus.downloadVod"></fa>
                        <fa icon="sync" type="fa" spin="true" v-else></fa>
                    </span>
                    Download{{ vod?.twitch_vod_muted ? " muted" : "" }} VOD
                </a>
                <a class="button" @click="doCheckMute">
                    <span class="icon">
                        <fa icon="volume-mute" type="fa" v-if="!taskStatus.vodMuteCheck"></fa>
                        <fa icon="sync" type="fa" spin="true" v-else></fa>
                    </span>
                    Check mute
                </a>
            </template>

            <a class="button" @click="burnMenu ? (burnMenu.show = true) : ''">
                <span class="icon">
                    <fa icon="burn" type="fa"></fa>
                </span>
                Render menu
            </a>

            <a class="button is-danger" @click="doDelete">
                <span class="icon">
                    <fa icon="trash" type="fa" v-if="!taskStatus.delete"></fa>
                    <fa icon="sync" type="fa" spin="true" v-else></fa>
                </span>
                Delete
            </a>
        </div>

        <div class="video-status" v-if="!vod.is_finalized">
            <template v-if="vod?.is_converting">
                <em>
                    <span class="icon"><fa icon="file-signature"></fa></span>
                    Converting <strong>{{ vod?.basename }}.ts</strong> to <strong>{{ vod?.basename }}.mp4</strong>
                </em>
                <br />
                <em>
                    <span v-if="vod?.api_getConvertingStatus">
                        <span class="icon"><fa icon="sync" spin></fa></span>
                        Running (pid {{ vod?.api_getConvertingStatus }})
                    </span>
                    <span v-else>
                        <strong class="is-error flashing">
                            <span class="icon"><fa icon="exclamation-triangle"></fa></span>
                            Not running, did it crash?
                        </strong>
                    </span>
                </em>
            </template>
            <template v-else-if="vod && vod.is_capturing">
                <em class="text-overflow">
                    <span class="icon"><fa icon="video"></fa></span>
                    Capturing to <strong>{{ vod?.basename }}.ts</strong> (<strong>{{ formatBytes(vod?.api_getRecordingSize) }}</strong
                    >)
                    <span class="icon clickable" title="Refresh" @click="vod && store.updateVod(vod.basename)"><fa icon="sync"></fa></span>
                </em>

                <br />

                <template v-if="store.cfg('playlist_dump')">
                    <em>
                        <span v-if="vod?.api_getCapturingStatus">
                            <span class="icon"><fa icon="sync" spin></fa></span>
                            Video capture running (pid
                            {{ vod?.api_getCapturingStatus }})
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
                            <span v-if="vod?.api_getChatDumpStatus">
                                <span class="icon"><fa icon="sync" spin></fa></span>
                                Chat dump running (pid
                                {{ vod?.api_getChatDumpStatus }})
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
            <template v-else-if="!vod?.is_capturing && !vod?.is_converting && !vod?.is_finalized">
                <em>Waiting to finalize video (since {{ vod?.dt_ended_at ? formatDate(vod?.dt_ended_at.date, "yyyy-MM-dd HH:mm:ss") : "(unknown)" }})</em>
            </template>
            <template v-else>
                <em>No video file or error</em>
            </template>
        </div>

        <!-- capture length warning -->
        <div v-if="vod?.is_capturing && vod?.api_getDurationLive > 86400" class="video-error">
            Capture has been running for over 24 hours, streamlink does not support this. Is the capture stuck?
        </div>

        <!-- no chapters error -->
        <div v-if="!vod?.chapters" class="video-error">No chapter data!?</div>

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
            <table class="table game-list" v-if="vod && vod.chapters && vod.chapters.length > 0">
                <thead>
                    <tr>
                        <th>Offset</th>
                        <th>Duration</th>
                        <th>Category</th>
                        <th>Title</th>
                        <th v-if="hasViewerCount">Viewers</th>
                    </tr>
                </thead>

                <tbody>
                    <tr
                        v-for="(chapter, chapterIndex) in vod.chapters"
                        :key="chapterIndex"
                        :class="{
                            favourite: store.config && store.config.favourites[chapter.game_id],
                            current: chapterIndex === vod.chapters.length - 1 && vod.is_capturing,
                        }"
                    >
                        <!-- start timestamp -->
                        <td data-contents="started_at" :title="formatDate(chapter.datetime.date)">
                            {{ humanDuration(chapter.offset) }}
                        </td>

                        <!-- duration -->
                        <td data-contents="duration">
                            <span class="grey" v-if="chapter.duration">
                                {{ niceDuration(chapter.duration) }}
                            </span>
                            <span v-else>
                                <duration-display :startDate="chapter.datetime.date" outputStyle="human"></duration-display>
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
                                        aria-label="Open on Twitch"
                                        :to="{ name: 'Editor', params: { vod: vod?.basename }, query: { start: chapter.offset } }"
                                    >
                                        <span class="icon"><fa icon="cut"></fa></span>
                                    </router-link>

                                    <!-- open on twitch link -->
                                    <a
                                        v-if="vod?.twitch_vod_exists"
                                        :href="vod?.twitch_vod_url + '?t=' + twitchDuration(chapter.offset)"
                                        target="_blank"
                                        rel="noreferrer"
                                        aria-label="Open on Twitch"
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
                                v-if="store.config && !store.config.favourites[chapter.game_id]"
                                title="Add to favourites"
                                @click="addFavouriteGame(chapter.game_id)"
                            >
                                <span class="icon"><fa icon="star"></fa></span>
                            </button>
                        </td>

                        <!-- title -->
                        <td>
                            <span class="text-overflow">{{ chapter.title }}</span>
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

                    <tr v-if="vod?.dt_ended_at">
                        <td :title="formatDate(vod.dt_ended_at.date)">
                            {{ vod?.api_getWebhookDuration }}
                        </td>
                        <td colspan="10">
                            <em>END</em>
                        </td>
                    </tr>

                    <tr v-else>
                        <td v-if="vod?.dt_started_at">
                            <!--{{ humanDuration(vod?.api_getDurationLive) }}-->
                            <duration-display :startDate="vod.dt_started_at.date"></duration-display>
                        </td>
                        <td colspan="10">
                            <em><strong>ONGOING</strong></em>
                        </td>
                    </tr>
                </tbody>
            </table>
            <div v-else>
                <span class="is-error">No chapters found</span>
            </div>
        </div>
    </div>
    <modal-box ref="burnMenu" title="Render Menu" v-if="vod?.is_finalized">
        <div>
            <pre>{{ vod.basename }}</pre>
            <ul class="list" v-if="vod.video_metadata_public && vod.video_metadata_public.video && vod.video_metadata_public.audio">
                <li>
                    <strong>Format</strong>
                    {{ vod.video_metadata_public.video.Width }}x{{ vod.video_metadata_public.video.Height }}@
                    {{ vod.video_metadata_public.video.FrameRate_Original }}
                </li>

                <li>
                    <strong>Video</strong>
                    {{ vod?.video_metadata_public.video.Format }}
                    {{ vod?.video_metadata_public.video.BitRate_Mode }}
                    {{ Math.round(parseInt(vod?.video_metadata_public.video.BitRate) / 1000) }}kbps
                </li>

                <li>
                    <strong>Audio</strong>
                    {{ vod?.video_metadata_public.audio.Format }}
                    {{ vod?.video_metadata_public.audio.BitRate_Mode }}
                    {{ Math.round(parseInt(vod?.video_metadata_public.audio.BitRate) / 1000) }}kbps
                </li>

                <li>
                    <strong>General</strong>
                    {{ formatBytes(parseInt(vod.video_metadata_public.general.FileSize)) }} / {{ vod.video_metadata_public.general.Duration_String }}
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
                        <input class="input" type="range" min="1" :max="vod.video_metadata_public.video.Width" v-model="burnSettings.chatWidth" />
                        <br /><input class="input" type="number" v-model="burnSettings.chatWidth" />
                        <span :class="{ 'input-help': true, error: burnSettings.chatWidth % 2 }">Chat width must be an even number.</span>
                    </label>
                </div>
                <div class="field">
                    <label>
                        <p>Chat height</p>
                        <input class="input" type="range" min="1" :max="vod.video_metadata_public.video.Height" v-model="burnSettings.chatHeight" />
                        <br /><input class="input" type="number" v-model="burnSettings.chatHeight" />
                        <span :class="{ 'input-help': true, error: burnSettings.chatHeight % 2 }">Chat height must be an even number.</span>
                    </label>
                </div>
                <div class="field">
                    <label>
                        <p>Video source</p>
                        <select class="input" v-model="burnSettings.vodSource">
                            <option value="captured">Captured</option>
                            <option value="downloaded" :disabled="!vod?.is_vod_downloaded">Downloaded</option>
                        </select>
                    </label>
                </div>
                <div class="field">
                    <label>
                        <p>Chat source</p>
                        <select class="input" v-model="burnSettings.chatSource">
                            <option value="captured">Captured</option>
                            <option value="downloaded" :disabled="!vod?.is_chat_downloaded">Downloaded</option>
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
                    <input type="checkbox" v-model="burnSettings.burnChat" :disabled="!burnSettings.renderChat && !vod?.is_chat_rendered" />
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
            <button class="button" @click="doRenderWizard">Execute</button>
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
        <button class="button" @click="doDownloadChat('tcd')">Download with TCD</button>
        <button class="button" @click="doDownloadChat('td')">Download with TwitchDownloader</button>
    </modal-box>
</template>

<script lang="ts">
import type { ApiJob, ApiVod } from "@/twitchautomator.d";
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
} from "@fortawesome/free-solid-svg-icons";
import { useStore } from "@/store";
import ModalBox from "./ModalBox.vue";
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
    faFileSignature
);

export default defineComponent({
    name: "VodItem",
    emits: ["forceFetchData", "refresh"],
    setup() {
        const store = useStore();
        const burnMenu = ref<InstanceType<typeof ModalBox>>();
        const chatDownloadMenu = ref<InstanceType<typeof ModalBox>>();
        return { store, burnMenu, chatDownloadMenu };
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
        };
    },
    mounted() {
        if (this.vod && this.vod.video_metadata_public && this.vod.video_metadata_public.video)
            this.burnSettings.chatHeight = parseInt(this.vod.video_metadata_public.video.Height);

        if (this.vod) {
            if (!this.vod.chapters) {
                console.error("No chapters found for vod", this.vod.basename, this.vod);
            } else if (this.vod.chapters && this.vod.chapters.length == 0) {
                console.error("Chapters array found but empty for vod", this.vod.basename, this.vod);
            }
        }
    },
    props: {
        vod: Object as () => ApiVod,
    },
    methods: {
        doArchive() {
            if (!confirm(`Do you want to archive "${this.vod?.basename}"?`)) return;
            this.taskStatus.archive = true;
            this.$http
                .post(`/api/v0/vod/${this.vod?.basename}/save`)
                .then((response) => {
                    const json = response.data;
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
                    const json = response.data;
                    if (json.message) alert(json.message);
                    console.log(json);
                    this.taskStatus.downloadChat = false;
                    this.$emit("refresh");
                    if (this.vod) this.store.updateVod(this.vod.basename);
                })
                .catch((err) => {
                    console.error("form error", err.response);
                    if (err.response.data && err.response.data.message) alert(err.response.data.message);
                    this.taskStatus.downloadChat = false;
                });
        },
        // doRenderChat(useVod = false) {
        //     /** @todo: implement */
        //     alert(`RenderChat not implemented: ${useVod}`);
        // },
        doDownloadVod() {
            if (!confirm(`Do you want to download the vod for "${this.vod?.basename}"?`)) return;
            this.taskStatus.downloadVod = true;
            this.$http
                .post(`/api/v0/vod/${this.vod?.basename}/download`)
                .then((response) => {
                    const json = response.data;
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
                    const json = response.data;
                    if (json.message) alert(json.message);
                    console.log(json);

                    if (json.data) {
                        if (json.data.muted === null) {
                            alert(`The vod "${this.vod?.basename}" could not be checked.`);
                        } else {
                            alert(`The vod "${this.vod?.basename}" is${json.data.muted ? "" : " not"} muted.`);
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
        //     /** @todo: implement */
        //     alert("FullBurn");
        // },
        doDelete() {
            if (!confirm(`Do you want to delete "${this.vod?.basename}"?`)) return;
            if (this.vod?.twitch_vod_exists === false && !confirm(`The VOD "${this.vod?.basename}" has been deleted from twitch, are you still sure?`)) return;
            this.taskStatus.delete = true;
            this.$http
                .post(`/api/v0/vod/${this.vod?.basename}/delete`)
                .then((response) => {
                    const json = response.data;
                    if (json.message) alert(json.message);
                    console.log(json);
                    this.taskStatus.delete = false;
                    this.$emit("refresh");
                    if (this.vod) this.store.updateStreamer(this.vod.streamer_login);
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
                    const json = response.data;
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
        unbreak() {
            // this.burnLoading = true;
            console.debug("doUnbreak", this.vod);
            this.$http
                .post(`/api/v0/vod/${this.vod?.basename}/unbreak`)
                .then((response) => {
                    const json = response.data;
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
        addFavouriteGame(game_id: number) {
            if (!this.store.config) return;

            let data: { games: Record<number, boolean> } = {
                games: {},
            };

            data.games[game_id] = true;
            for (const fid in this.store.config.favourites) {
                data.games[parseInt(fid)] = true;
            }

            this.$http
                .put(`/api/v0/favourites`, data)
                .then((response) => {
                    const json = response.data;
                    if (json.message) alert(json.message);
                    console.log(json);

                    this.$http.get(`/api/v0/settings`).then((response) => {
                        this.store.updateConfig(response.data.data.config);
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
            return `${this.store.cfg("basepath")}/vodplayer/index.html#source=file_http&video_path=${video_path}&chatfile=${chat_path}&offset=${offset}`;
        },
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
                return chapter.viewer_count > 0;
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
            if (!this.vod) return {};
            return {
                width: `${(this.burnSettings.chatWidth / parseInt(this.vod.video_metadata_public.video.Width)) * 100}%`,
                height: `${(this.burnSettings.chatHeight / parseInt(this.vod.video_metadata_public.video.Height)) * 100}%`,
                left: this.burnSettings.burnHorizontal == "left" ? "0" : "",
                right: this.burnSettings.burnHorizontal == "right" ? "0" : "",
                top: this.burnSettings.burnVertical == "top" ? "0" : "",
                bottom: this.burnSettings.burnVertical == "bottom" ? "0" : "",
                fontSize: `${this.burnSettings.chatFontSize * 0.35}px`,
                fontFamily: this.burnSettings.chatFont,
            };
        },
    },
    components: {
        DurationDisplay,
        ModalBox,
    },
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
