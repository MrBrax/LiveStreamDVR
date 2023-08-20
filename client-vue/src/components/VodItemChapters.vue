<template>
    <!-- game list / chapters -->
    <div class="video-block video-chapters">
        <div class="video-block-header collapsible" aria-role="button" @click="isCollapsed = !isCollapsed">
            <h4>
                <span class="icon">
                    <font-awesome-icon :icon="isCollapsed ? 'chevron-down' : 'chevron-up'" />
                </span>
                {{ t("vod.block.chapters") }} <span class="amount" :data-amount="vod.chapters.length">({{ vod.chapters.length }})</span>
            </h4>
        </div>
        <transition name="blinds">
            <div v-if="!isCollapsed" class="video-block-content no-padding">
                <table v-if="vod && vod.chapters && vod.chapters.length > 0" class="table game-list is-slim">
                    <thead>
                        <tr>
                            <th>{{ t("vod.chapters.offset") }}</th>
                            <th v-if="showAdvanced">
                                {{ t("vod.chapters.started") }}
                            </th>
                            <th v-if="showAdvanced">
                                {{ t("vod.chapters.ended") }}
                            </th>
                            <th>{{ t("vod.chapters.duration") }}</th>
                            <th>{{ t("vod.chapters.category") }}</th>
                            <th>{{ t("vod.chapters.title") }}</th>
                            <th v-if="hasViewerCount">
                                {{ t("vod.chapters.viewers") }}
                            </th>
                            <th />
                        </tr>
                    </thead>

                    <tbody>
                        <tr
                            v-for="(chapter, chapterIndex) in vod.chapters"
                            :key="chapterIndex"
                            :class="{
                                favourite:
                                    isTwitchChapter(chapter) && store.config && chapter.game_id && store.favourite_games.includes(chapter.game_id.toString()),
                                current: vod && chapterIndex === vod.chapters.length - 1 && vod.is_capturing,
                            }"
                        >
                            <!-- start timestamp -->
                            <td data-contents="offset" :title="formatDate(chapter.started_at)">
                                {{ chapter.offset !== undefined ? humanDuration(chapter.offset) : "Unknown" }}
                            </td>

                            <!-- start time -->
                            <td v-if="showAdvanced" data-contents="started_at" :title="chapter.started_at.toISOString()">
                                <template v-if="store.clientCfg('useRelativeTime')">
                                    <duration-display :start-date="chapter.started_at.toISOString()" output-style="human" /> ago
                                </template>
                                <template v-else>
                                    {{ formatDate(chapter.started_at, "HH:mm:ss") }}
                                </template>
                            </td>

                            <!-- end time -->
                            <td v-if="showAdvanced" data-contents="ended_at">
                                <template v-if="chapter.offset !== undefined && chapter.duration !== undefined">
                                    {{ humanDuration(chapter.offset + chapter.duration) }}
                                </template>
                            </td>

                            <!-- duration -->
                            <td data-contents="duration">
                                <template v-if="chapter.duration">
                                    {{ niceDuration(chapter.duration) }}
                                </template>
                                <template v-else>
                                    <duration-display :start-date="chapter.started_at.toISOString()" output-style="human" />
                                </template>
                            </td>

                            <!-- chapter name -->
                            <td data-contents="name">
                                <img
                                    v-if="chapter.image_url"
                                    class="boxart"
                                    :src="chapter.image_url"
                                    :alt="chapter.game_name"
                                    :class="{ 'is-spoiler': store.clientCfg('hideChapterTitlesAndGames') }"
                                    loading="lazy"
                                />
                                <template v-if="vod?.is_finalized">
                                    <span class="game-name">
                                        <!-- title with video player link -->
                                        <a
                                            class="px-1"
                                            target="_blank"
                                            :href="playerLink(chapter.offset)"
                                            title="Open in player"
                                            :class="{ 'is-spoiler': store.clientCfg('hideChapterTitlesAndGames') }"
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
                                            <span class="icon"><font-awesome-icon icon="cut" /></span>
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
                                            <span class="icon"><font-awesome-icon icon="external-link-alt" /></span>
                                        </a>
                                    </span>
                                </template>
                                <span v-else class="game-name px-1">{{ chapter.game_name ? chapter.game_name : "None" }}</span>
                                <!-- favourite button -->
                                <button
                                    v-if="
                                        store.config &&
                                        isTwitchChapter(chapter) &&
                                        chapter.game_id &&
                                        !store.favourite_games.includes(chapter.game_id.toString())
                                    "
                                    class="icon-button favourite-button"
                                    title="Add to favourites"
                                    @click="chapter.game_id && addFavouriteGame(chapter.game_id.toString())"
                                >
                                    <span class="icon"><font-awesome-icon icon="star" /></span>
                                </button>
                            </td>

                            <!-- title -->
                            <td class="text-overflow text-long" :class="{ 'is-spoiler': store.clientCfg('hideChapterTitlesAndGames') }" data-contents="title">
                                {{ chapter.title }}
                            </td>

                            <!-- viewer count -->
                            <td v-if="hasViewerCount" data-contents="viewers">
                                <template v-if="chapter.viewer_count">
                                    {{ formatNumber(chapter.viewer_count) }}
                                </template>
                            </td>

                            <!-- mature -->
                            <td v-if="isTwitchChapter(chapter) && chapter.is_mature" data-contents="mature">🔞</td>
                        </tr>

                        <tr v-if="vod.ended_at">
                            <td :title="formatDate(vod.ended_at)">
                                {{ vod.getWebhookDuration() }}
                            </td>
                            <td colspan="10" class="has-text-italic">
                                {{ t("vod.chapters.end") }}
                            </td>
                        </tr>

                        <tr v-else>
                            <td v-if="vod.started_at">
                                <!--{{ humanDuration(vod?.api_getDurationLive) }}-->
                                <duration-display :start-date="vod.started_at.toISOString()" />
                            </td>
                            <td colspan="10" class="has-text-italic has-text-bold">
                                {{ t("vod.chapters.ongoing") }}
                            </td>
                        </tr>
                    </tbody>
                </table>
                <div v-else class="text-is-error padding-1">No chapters found</div>
            </div>
        </transition>
    </div>
</template>

<script lang="ts" setup>
import { TwitchVODChapter } from "@/core/Providers/Twitch/TwitchVODChapter";
import { niceDuration } from "@/mixins/newhelpers";
import { useStore } from "@/store";
import type { ApiResponse, ApiSettingsResponse } from "@common/Api/Api";
import axios from "axios";
import { computed, onMounted, ref } from "vue";
import DurationDisplay from "@/components/DurationDisplay.vue";
import { useI18n } from "vue-i18n";
import { formatDate, formatNumber, humanDuration, twitchDuration } from "@/mixins/newhelpers";
import type { ChapterTypes, VODTypes } from "@/twitchautomator";

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
const { t } = useI18n();

const isCollapsed = ref<boolean>(true);

onMounted(() => {
    isCollapsed.value = store.videoBlockShow.chapters;
});

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
    return `${store.cfg<string>("basepath", "")}/vodplayer#source=file_http&video_path=${video_path}&chatfile=${chat_path}&offset=${offset}`;
}

function twitchVideoLink(video_id: string): string {
    return `https://www.twitch.tv/videos/${video_id}`;
}

function addFavouriteGame(game_id: string) {
    if (!store.config) return;
    axios
        .patch("/api/v0/favourites", { game: game_id })
        .then((response) => {
            const json: ApiResponse = response.data;
            if (json.message) alert(json.message);
            console.log(json);

            // fetch the new config
            axios.get<ApiSettingsResponse>("/api/v0/settings").then((response) => {
                const settings_json = response.data;
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

<style lang="scss" scoped>
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
    // td:nth-child(4) {
    //     color: #444;
    // }

    td[data-contents="title"] {
        color: var(--gamelist-title-color);
    }

    td[data-contents="viewers"] {
        color: var(--gamelist-viewers-color);
    }

    tr.favourite {
        background-color: var(--gamelist-favourite);

        td {
            background-color: var(--gamelist-favourite);
        }

        td[data-contents="title"] {
            color: var(--gamelist-favourite-title-color);
        }

        td[data-contents="viewers"] {
            color: var(--gamelist-favourite-viewers-color);
        }
    }

    tr.current {
        background-color: var(--gamelist-current);

        td[data-contents="title"] {
            color: var(--gamelist-current-title-color);
        }

        td[data-contents="viewers"] {
            color: var(--gamelist-current-viewers-color);
        }
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

.video-chapters {
    background-color: var(--video-block-background-color);
}
</style>
