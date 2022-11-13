<template>
    <router-link
        v-if="streamer"
        :to="
            store.clientCfg('singlePage')
                ? { name: 'Dashboard', query: { channel: streamer.uuid }, hash: '#vod_' + vod.uuid }
                : { name: 'Dashboard', hash: '#vod_' + vod.uuid }
        "
        :class="{
            'is-active': store.visibleVod == vod.basename,
            'is-favourite': isTwitchVOD(vod) ? vod.hasFavouriteGame() : false,
            'is-live': vod.is_capturing,
            'is-animated': store.clientCfg('animationsEnabled'),
            'is-converting': vod.is_converting,
            'is-waiting': !vod.is_capturing && !vod.is_converting && !vod.is_finalized,
            'is-error': vod.failed || vod.hasError(),
            'streamer-jumpto-vod': true,
        }"
        :title="vod.started_at ? formatDate(vod.started_at) : 'Unknown'"
    >
        <!-- capturing -->
        <span
            v-if="vod.is_capturing && store.sidemenuShow.vod_icon"
            class="icon"
        ><fa
            icon="sync"
            spin
        /></span>

        <!-- converting -->
        <span
            v-else-if="vod.is_converting && store.sidemenuShow.vod_icon"
            class="icon"
        ><fa
            icon="cog"
            spin
        /></span>

        <!-- favourite -->
        <span
            v-else-if="isTwitchVOD(vod) && vod.hasFavouriteGame() && store.sidemenuShow.vod_icon"
            class="icon"
        ><font-awesome-icon icon="star" /></span>

        <span
            v-else-if="(vod.failed || vod.hasError()) && store.sidemenuShow.vod_icon"
            class="icon is-error"
        ><font-awesome-icon icon="exclamation-triangle" /></span>

        <!-- waiting after capture -->
        <span
            v-else-if="!vod.is_capturing && !vod.is_converting && !vod.is_finalized && store.sidemenuShow.vod_icon"
            class="icon"
        ><font-awesome-icon :icon="['far', 'hourglass']" /></span>

        <!-- video -->
        <span
            v-else-if="vod.is_finalized && store.sidemenuShow.vod_icon"
            class="icon"
        ><font-awesome-icon :icon="fileIcon(vod)" /></span>

        <!-- basename -->
        <span v-if="store.sidemenuShow.vod_basename">{{ vod.basename }}</span>

        <!-- title -->
        <span
            v-if="store.sidemenuShow.vod_title"
            class="vod-title"
        >{{ vod.getTitle() }}</span>

        <!-- SxE -->
        <span
            v-if="store.sidemenuShow.vod_sxe"
            class="sxe"
        >
            S{{ vod.stream_season }}E{{ vod.stream_number }}
        </span>

        <!-- SxE absolute -->
        <span
            v-if="store.sidemenuShow.vod_sxe_absolute"
            class="sxe"
        >
            S{{ vod.stream_absolute_season?.toString().padStart(2, "0") }}E{{ vod.stream_number?.toString().padStart(2, "0") }}
        </span>

        <!-- started at -->
        <!-- absolute time -->
        <span v-if="!store.clientCfg('useRelativeTime') && vod.started_at && store.sidemenuShow.vod_date">{{ formatDate(vod.started_at) }}</span>

        <!-- relative time -->
        <span v-if="store.clientCfg('useRelativeTime') && vod.started_at && store.sidemenuShow.vod_date">{{ humanDate(vod.started_at, true) }}</span>

        <!-- when capturing -->
        <template v-if="vod.is_capturing">
            <span
                v-if="store.sidemenuShow.vod_duration"
                class="duration"
            >
                (<duration-display
                    v-if="streamer.current_vod?.started_at"
                    :start-date="streamer.current_vod?.started_at"
                    :output-style="store.clientCfg('useRelativeTime') ? 'human' : 'numbers'"
                />
                <span v-else>Unknown</span>)
            </span><!-- duration -->
            <span
                v-if="vod.getRecordingSize() && store.sidemenuShow.vod_size"
                class="size"
            > {{ formatBytes(vod.getRecordingSize() || 0, 2) }}+</span><!-- filesize -->
        </template>

        <!-- when not capturing -->
        <template v-else>
            <!-- duration -->
            <span
                v-if="store.sidemenuShow.vod_duration"
                class="duration"
            >
                <template v-if="vod.duration">
                    ({{ store.clientCfg('useRelativeTime') ? niceDuration(vod.duration) : humanDuration(vod.duration) }})
                </template>
                <template v-else>
                    (Unknown)
                </template>
            </span>

            <!-- filesize -->
            <span
                v-if="vod.total_size && store.sidemenuShow.vod_size"
                class="size"
            >{{ formatBytes(vod.total_size, 2) }}</span>
        </template>

        <!-- flags -->
        <template v-if="vod.is_finalized">
            <span class="flags">
                <!-- vod deleted -->
                <span
                    v-if="isTwitchVOD(vod) && vod.twitch_vod_exists === false"
                    class="icon is-error"
                    title="Deleted from provider"
                ><font-awesome-icon icon="trash" /></span>

                <!-- vod deleted -->
                <span
                    v-if="isTwitchVOD(vod) && vod.twitch_vod_exists === true && isRiskOfBeingDeleted(vod)"
                    class="icon is-warning"
                    title="Is risking deletion from provider"
                >
                    <font-awesome-icon icon="trash-arrow-up" />
                </span>

                <!-- vod not checked -->
                <span
                    v-if="isTwitchVOD(vod) && vod.twitch_vod_exists === null"
                    class="icon is-error"
                    title="Not checked"
                ><font-awesome-icon icon="question" /></span>

                <!-- vod muted -->
                <span
                    v-if="isTwitchVOD(vod) && vod.twitch_vod_muted === MuteStatus.MUTED"
                    class="icon is-error"
                    title="Muted"
                ><font-awesome-icon icon="volume-mute" /></span>

                <!-- capturing paused -->
                <span
                    v-if="vod.is_capture_paused"
                    class="icon is-error"
                    title="Paused"
                ><font-awesome-icon icon="pause" /></span>

                <!-- prevent deletion -->
                <span
                    v-if="vod.prevent_deletion"
                    class="icon is-success"
                    title="Preventing deletion"
                ><font-awesome-icon icon="lock" /></span>

                <!-- deleted segment -->
                <span
                    v-if="vod.hasDeletedSegment"
                    class="icon is-error"
                    title="Deleted segment"
                ><font-awesome-icon icon="film" /></span>

                <!-- has comment -->
                <span
                    v-if="vod.comment"
                    class="icon is-success"
                    title="Has comment"
                ><font-awesome-icon icon="comment" /></span>
            </span>
        </template>

        <!-- tooltip -->
        <div :class="{ tooltip: true, 'is-static': store.clientCfg('tooltipStatic') }">
            <div class="stream-channel">
                {{ streamer.display_name }}
                <template v-if="streamer.login.toLowerCase() != streamer.display_name.toLowerCase()">
                    ({{ streamer.login }})
                </template>
            </div>
            <div class="stream-name">
                {{ vod.basename }}
            </div>
            <div
                v-if="isTwitchVOD(vod)"
                class="boxart-carousel is-small"
            >
                <div
                    v-for="game in vod.getUniqueGames()"
                    :key="game.name"
                    :class="{ 'boxart-item': true, 'is-favourite': store.config && store.favourite_games.includes(game.id) }"
                >
                    <img
                        v-if="game.box_art_url"
                        :title="game.name"
                        :alt="game.name"
                        :src="game.getBoxArtUrl(140, 190)"
                        loading="lazy"
                        :class="{ 'is-spoiler': store.clientCfg('hideChapterTitlesAndGames') }"
                    >
                    <span
                        class="boxart-name"
                        :class="{ 'is-spoiler': store.clientCfg('hideChapterTitlesAndGames') }"
                    >{{ game.name }}</span>
                </div>
            </div>
            <div class="stream-title">
                {{ isTwitchVOD(vod) ? vod.stream_title : "" }}
            </div>
        </div>
    </router-link>
</template>

<script lang="ts" setup>
// import { ref } from "vue";
import { useStore } from "@/store";
import type TwitchVOD from "@/core/Providers/Twitch/TwitchVOD";
import { MuteStatus, TwitchVodAge } from "../../../common/Defs";
import DurationDisplay from "./DurationDisplay.vue";
import { isTwitchVOD } from "@/mixins/newhelpers";
import { formatDate, formatBytes, humanDuration, niceDuration, humanDate } from "@/mixins/newhelpers";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faTrash, faVolumeMute } from "@fortawesome/free-solid-svg-icons";
import type { ChannelTypes, VODTypes } from "@/twitchautomator";
library.add(faTrash, faVolumeMute);

const store = useStore();

const props = defineProps<{
    vod: VODTypes;
    streamer: ChannelTypes;
}>();

function fileIcon(vod: VODTypes): string {
    if (!props.streamer) return "";
    if (vod.video_metadata?.type === "audio") return "headphones";
    return "film";
}

function isRiskOfBeingDeleted(vod: TwitchVOD) {
    if (!vod.started_at) return false;

    const channel = vod.getChannel();
    if (channel) {
        if (channel.broadcaster_type === "partner") return false; // partner vods are never deleted, i think?
    }

    // 14 days minus 2 days for some slack
    const maxVodAge = TwitchVodAge - 2 * 24 * 60 * 60 * 1000;

    // if the vod is older than 12 days, it is considered risky
    return Date.now() - vod.started_at.getTime() >= maxVodAge;
}

</script>

<style lang="scss" scoped>

$favourite-base: #356e35;
$converting-base: #bb15ca;
$recording-base: #ca1515;
$waiting-base: #2b2b2b;

.streamer-jumpto-vod {
    display: flex;
    // center vertically
    align-items: center;
    gap: 0.25em;

    font-family: "Roboto Condensed";
    $base-bg: #09182c;
    background-color: $base-bg;
    // border-color: darken($base-bg, 5%);
    // color: #ddd;
    color: rgba(255, 255, 255, 0.5);
    // display: block;
    text-decoration: none;
    padding: 3px 5px;
    font-size: 0.8em;
    transition: 0.1s border-width ease-in-out;

    .size {
        color: #9fdaad80;
        // &::before {
        //     // &middot;
        //     content: " • ";
        //     font-size: 0.7em;
        // }
    }
    .duration {
        color: #d4da9fb3;
        // &::before {
        //     // &middot;
        //     content: " • ";
        //     font-size: 0.7em;
        // }
    }

    &.is-favourite {
        background-color: $favourite-base;

        &:hover {
            background-color: lighten($favourite-base, 5%);
        }

        .tooltip {
            background-color: rgba(darken($favourite-base, 15%), 0.98);
        }
    }

    &.is-live {
        background-color: $recording-base;
        color: #eee;

        // text-shadow: 1px 1px 2px darken($recording-base, 10%);
        &.is-animated {
            animation: 1s ease-in-out infinite recording; // TODO: keep?
        }

        &:hover {
            background-color: lighten($recording-base, 5%);
        }

        .tooltip {
            background-color: rgba($recording-base, 0.95);
        }

        .size {
            color: #faffb6;
        }

        .duration {
            color: #e3e991;
        }
    }

    &.is-converting {
        background-color: $converting-base;

        &:hover {
            background-color: lighten($converting-base, 5%);
        }

        .tooltip {
            background-color: rgba($converting-base, 0.95);
        }
    }

    &.is-waiting {
        background-color: $waiting-base;

        &:hover {
            background-color: lighten($waiting-base, 5%);
        }

        .tooltip {
            background-color: rgba($waiting-base, 0.95);
        }
    }

    &.is-active {
        &.is-favourite {
            border-color: lighten($favourite-base, 60%);
        }

        &.is-live {
            border-color: lighten($recording-base, 60%);
        }

        &.is-converting {
            border-color: lighten($converting-base, 60%);
        }

        border-left: 2px solid lighten($base-bg, 60%);
        color: #fff;
    }

    &.is-error {
        background-color: darken($recording-base, 30%);
        color: #eee;

        &:hover {
            background-color: darken($recording-base, 25%);
        }

        .tooltip {
            background-color: rgba($recording-base, 0.95);
        }
    }

    .flags {
        text-align: right;
        flex: 1;
        display: flex;
        justify-content: flex-end;

        .icon {
            margin: 0;
            padding: 0;
        }
    }

    .tooltip {
        position: absolute;
        // left: $sidemenu-width + 10px;
        left: calc(var(--sidemenu-width) + 10px);

        &.is-static {
            position: fixed;
            top: 10px;
        }

        background-color: rgba(0, 0, 0, 0.98);
        border-radius: 3px;
        padding: 8px;
        display: none;
        word-wrap: none;
        width: max-content;

        .boxart-carousel {
            margin: 5px 0;
        }

        .stream-channel {
            font-size: 1.1em;
            font-weight: 700;
        }

        .stream-name {
            font-size: 0.9em;
            color: rgba(255, 255, 255, 0.6);
        }

        /*
        .stream-title {
            
        }
        */
    }

    &:hover>.tooltip {
        display: block;
    }

    &:hover {
        color: #fff;
        background-color: lighten($base-bg, 5%);
        .size {
            color: rgba(220, 240, 225, 1);
        }
        .duration {
            color: rgba(240, 240, 225, 1);
        }
    }

}

.vod-title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 40%;
    display: inline-block;
}

@media screen and (orientation: portrait) {
    
}

</style>