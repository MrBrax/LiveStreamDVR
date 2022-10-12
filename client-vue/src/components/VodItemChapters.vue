<template>
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
</template>

<script lang="ts" setup>
import { TwitchVODChapter } from '@/core/Providers/Twitch/TwitchVODChapter';
import { niceDuration } from '@/mixins/newhelpers';
import { ChapterTypes, useStore, VODTypes } from '@/store';
import { ApiResponse, ApiSettingsResponse } from '@common/Api/Api';
import axios from 'axios';
import { computed } from 'vue';

function isTwitchChapter(chapter: ChapterTypes): chapter is TwitchVODChapter {
    return chapter instanceof TwitchVODChapter;
}

const props = defineProps({
    vod: {
        type: Object as () => VODTypes,
        default: null,
        // required: true,
    },
    showAdvanced: {
        type: Boolean,
        default: false,
    },
});

const store = useStore();

const hasViewerCount = computed(() => {
    if (!props.vod) return false;
    if (!props.vod.chapters) return false;
    return props.vod.chapters.some((chapter) => {
        return chapter.viewer_count && chapter.viewer_count > 0;
    });
});

function playerLink(offset = 0, chatdownload = false): string {
    if (!props.vod || !store.config) return "#";
    const video_path = `${props.vod.webpath}/${props.vod.basename}.mp4`;
    const chat_path = `${props.vod.webpath}/${props.vod.basename}.${chatdownload ? "chat" : "chatdump"}`;
    return `${store.cfg<string>("basepath", "")}/vodplayer/index.html#source=file_http&video_path=${video_path}&chatfile=${chat_path}&offset=${offset}`;
}

function twitchVideoLink(video_id: string): string {
    return `https://www.twitch.tv/videos/${video_id}`;
}

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

</script>