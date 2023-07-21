<template>
    <div class="field">
        <label
            class="label"
            for="absolute-season"
        >{{ t('vod.edit.absolute-season') }}</label>
        <div class="control">
            <input
                id="absolute-season"
                v-model.number="editVodSettings.absolute_season"
                class="input"
                type="number"
            >
        </div>
    </div>

    <div class="field">
        <label
            class="label"
            for="stream-number"
        >{{ t('vod.edit.stream-number') }}</label>
        <div class="control">
            <input
                id="stream-number"
                v-model.number="editVodSettings.stream_number"
                class="input"
                type="number"
            >
        </div>
    </div>

    <div class="field">
        <label
            class="label"
            for="stream-number"
        >{{ t('vod.edit.absolute-stream-number') }}</label>
        <div class="control">
            <input
                id="stream-number"
                v-model.number="editVodSettings.absolute_stream_number"
                class="input"
                type="number"
            >
        </div>
    </div>

    <div class="field">
        <label
            class="label"
            for="comment"
        >{{ t('vod.edit.comment') }}</label>
        <div class="control">
            <textarea
                id="comment"
                v-model="editVodSettings.comment"
                class="input textarea"
            />
        </div>
    </div>

    <div class="field">
        <label
            class="label"
            for="segments"
        >{{ t('vod.edit.segments') }}</label>
        <div class="control">
            <textarea
                id="segments"
                v-model="editVodSettings.segments"
                class="input textarea"
            />
        </div>
    </div>

    <div class="field">
        <label
            class="label"
        >{{ t('vod.edit.chapters') }}</label>
        <div class="control">
            <label class="checkbox">
                <input
                    v-model="editVodSettings.editChapters"
                    type="checkbox"
                >
                {{ t('vod.edit.edit-chapters') }}
            </label>
        </div>
        <div v-if="editVodSettings.editChapters">
            <div class="notice is-error">
                {{ t('vod.edit.edit-chapters-warning') }}
            </div>
            <table class="table is-fullwidth">
                <tr
                    v-for="(chapter, i) in sortedChapters"
                    :key="chapter.originalIndex"
                >
                    <td>
                        {{ chapter.originalIndex }}
                    </td>
                    <td>
                        <input
                            v-model.lazy="chapter.offset"
                            type="number"
                            class="input is-small"
                        >
                    </td>
                    <!-- offset -->
                    <td>
                        <input
                            :value="humanReadableChapterOffset(i)"
                            readonly
                            disabled
                            class="input is-small"
                        >
                    </td>
                    <!-- date -->
                    <td>
                        <input
                            :value="chapterDate(i)?.toISOString()"
                            readonly
                            disabled
                            class="input is-small"
                        >
                    </td>
                    <!-- title -->
                    <td>
                        <input
                            v-model="chapter.title"
                            type="text"
                            class="input is-small"
                        >
                    </td>
                    <!-- game id -->
                    <td>
                        <div class="select is-small">
                            <select
                                v-if="vod.provider == 'twitch'"
                                v-model="chapter.game_id"
                            >
                                <option value="">
                                    None
                                </option>
                                <option
                                    v-for="game in sortedGamesData"
                                    :key="game.id"
                                    :value="game.id"
                                >
                                    {{ game.name }}
                                </option>
                            </select>
                        </div>
                    </td>
                    <!-- viewer count -->
                    <td>
                        <input
                            :value="chapter.viewer_count"
                            readonly
                            disabled
                            class="input is-small"
                        >
                    </td>
                    <!-- delete -->
                    <td>
                        <button
                            class="button is-small is-danger"
                            @click="deleteChapter(i)"
                        >
                            <span class="icon">
                                <font-awesome-icon icon="trash" />
                            </span>
                        </button>
                    </td>
                </tr>

                <!-- new chapter -->
                <tr>
                    <td />
                    <td>
                        <input
                            v-model="newChapter.offset"
                            type="number"
                            class="input is-small"
                        >
                    </td>
                    <td>
                        <input
                            :value="humanDuration(newChapter.offset)"
                            readonly
                            disabled
                            class="input is-small"
                        >
                    </td>
                    <td>
                        <input
                            :value="new Date((vod.started_at?.getTime() || 0) + newChapter.offset * 1000)?.toISOString()"
                            readonly
                            disabled
                            class="input is-small"
                        >
                    </td>
                    <!-- title -->
                    <td>
                        <input
                            v-model="newChapter.title"
                            type="text"
                            class="input is-small"
                        >
                    </td>
                    <!-- game id -->
                    <td>
                        <div class="select is-small">
                            <select
                                v-if="vod.provider == 'twitch'"
                                v-model="newChapter.game_id"
                            >
                                <option value="">
                                    None
                                </option>
                                <option
                                    v-for="game in sortedGamesData"
                                    :key="game.id"
                                    :value="game.id"
                                >
                                    {{ game.name }}
                                </option>
                            </select>
                        </div>
                    </td>
                    <td>
                        <input
                            :value="newChapter.viewer_count"
                            readonly
                            disabled
                            class="input is-small"
                        >
                    </td>
                    <td>
                        <button
                            class="button is-small is-confirm"
                            @click="addChapter"
                        >
                            <span class="icon">
                                <font-awesome-icon icon="plus" />
                            </span>
                        </button>
                    </td>
                </tr>
            </table>
            <table class="chaptervis">
                <tr>
                    <td
                        v-if="sortedChapters.length > 0 && sortedChapters[0].offset > 0"
                        :style="{ left: `${firstChapterLeft}%` }"
                    />
                    <td
                        v-for="(chapter, i) in sortedChapters"
                        :key="i"
                        :style="{ width: `${chapterWidth(i)}%` }"
                    >
                        {{ chapter.originalIndex || i }}
                    </td>
                </tr>
            </table>
            <!--
            <div class="notice is-error">
                Currently not editable
            </div>
            -->
            <d-button
                size="small"
                color="danger"
                icon="undo"
                @click="resetChapters"
            >
                {{ t('vod.edit.reset-chapters') }}
            </d-button>
            <p>
                Total duration: {{ vod.duration }}
            </p>
        </div>
    </div>

    <div class="field">
        <div class="control">
            <label class="checkbox">
                <input
                    v-model="editVodSettings.prevent_deletion"
                    type="checkbox"
                >
                {{ t('vod.edit.prevent-deletion') }}
            </label>
        </div>
    </div>

    <div class="field">
        <div class="control">
            <label class="checkbox">
                <input
                    v-model="editVodSettings.cloud_storage"
                    type="checkbox"
                >
                {{ t('vod.edit.cloud-storage') }}
            </label>
        </div>
    </div>

    <div class="field">
        <d-button
            color="success"
            icon="save"
            @click="doEditVod"
        >
            {{ t("buttons.save") }}
        </d-button>
    </div>
</template>

<script lang="ts" setup>
import { useStore } from "@/store";
import type { ApiGamesResponse, ApiResponse } from "@common/Api/Api";
import axios from "axios";
import { computed, onMounted, ref } from "vue";

import { faUndo } from "@fortawesome/free-solid-svg-icons";
import { library } from "@fortawesome/fontawesome-svg-core";
import type { ApiGame, EditableChapter } from "@common/Api/Client";
import { TwitchVODChapter } from "@/core/Providers/Twitch/TwitchVODChapter";
import { humanDuration } from "@/mixins/newhelpers";
import { useI18n } from "vue-i18n";
import type { ChapterTypes, VODTypes } from "@/twitchautomator";
library.add(faUndo);

const store = useStore();
const { t } = useI18n();

const props = defineProps<{
    vod: VODTypes;
}>();

const emit = defineEmits<{
    (event: "close"): void;
}>();

const editVodSettings = ref<{
    absolute_season: number;
    stream_number: number;
    absolute_stream_number: number;
    comment: string;
    prevent_deletion: boolean;
    segments: string;
    cloud_storage: boolean;
    chapters: EditableChapter[];
    editChapters: boolean;
}>({
    absolute_season: 0,
    stream_number: 0,
    absolute_stream_number: 0,
    comment: "",
    prevent_deletion: false,
    segments: "",
    cloud_storage: false,
    chapters: [],
    editChapters: false,
});

const gamesData = ref<Record<string,ApiGame>>({});

const newChapter = ref<EditableChapter>({
    offset: 0,
    title: "",
    game_id: "",
    viewer_count: undefined,
    is_mature: undefined,
    // online: true,
});

const sortedChapters = computed(() => {
    return editVodSettings.value.chapters.slice().sort((a, b) => a.offset - b.offset);
});

const sortedGamesData = computed(() => {
    return Object.values(gamesData.value).sort((a, b) => a.name.localeCompare(b.name));
});

function sortChapters() {
    editVodSettings.value.chapters.sort((a, b) => a.offset - b.offset);
}

function doEditVod() {
    if (!props.vod) return;
    sortChapters();
    axios.post<ApiResponse>(`/api/v0/vod/${props.vod.uuid}`, editVodSettings.value).then((response) => {
        const json = response.data;
        if (json.message) alert(json.message);
        console.log(json);
        if (props.vod) store.fetchAndUpdateVod(props.vod.uuid);
        // if (this.editVodMenu) this.editVodMenu.show = false;
        emit("close");
    }).catch((err) => {
        console.error("form error", err.response);
        if (err.response.data && err.response.data.message) alert(err.response.data.message);
    });

}

function makeEditableChapters(chapters: ChapterTypes[]): EditableChapter[] {
    return chapters.map((chapter, i) => ({
        originalIndex: i,
        offset: chapter.offset || 0,
        title: chapter.title,
        game_id: chapter instanceof TwitchVODChapter ? chapter.game_id : undefined,
        viewer_count: chapter instanceof TwitchVODChapter ? chapter.viewer_count : undefined,
        is_mature: chapter instanceof TwitchVODChapter ? chapter.is_mature : undefined,
        online: chapter.online || false,
    }));
}

function deleteChapter(index: number) {
    editVodSettings.value.chapters.splice(index, 1);
}

function addChapter() {
    editVodSettings.value.chapters.push(newChapter.value);
    newChapter.value = {
        offset: 0,
        title: "",
        game_id: "",
        viewer_count: undefined,
        is_mature: undefined,
        // online: true,
    };
}

function chapterWidth(index: number) {
    const duration = props.vod.duration;
    const chapter = sortedChapters.value[index];
    const nextChapter = sortedChapters.value[index + 1];
    if (nextChapter) {
        return (nextChapter.offset - chapter.offset) / duration * 100;
    } else {
        return (duration - chapter.offset) / duration * 100;
    }
}

function firstChapterLeft() {
    const chapter = sortedChapters.value[0];
    return chapter.offset / props.vod.duration * 100;
}

function chapterDate(index: number): Date | undefined {
    if (!props.vod.started_at) return undefined;
    const chapter = sortedChapters.value[index];
    return new Date(props.vod.started_at?.getTime() + (chapter.offset * 1000));
}

function humanReadableChapterOffset(index: number): string {
    if (!props.vod.started_at) return "";
    const chapter = sortedChapters.value[index];
    return humanDuration(chapter.offset);
}

onMounted(() => {
    editVodSettings.value = {
        absolute_season: props.vod.stream_absolute_season ?? 0,
        stream_number: props.vod.stream_number ?? 0,
        absolute_stream_number: props.vod.stream_absolute_number ?? 0,
        comment: props.vod.comment ?? "",
        prevent_deletion: props.vod.prevent_deletion ?? false,
        segments: props.vod.segments.map((s) => s.basename).join("\n"),
        cloud_storage: props.vod.cloud_storage ?? false,
        chapters: props.vod.chapters ? makeEditableChapters(props.vod.chapters) : [],
        editChapters: false,
    };

    axios.get<ApiGamesResponse>("/api/v0/games")
        .then((response) => {
            const json = response.data;
            if (json.message) alert(json.message);
            const games = json.data;
            gamesData.value = games;
        });
});

function resetChapters() {
    editVodSettings.value.chapters = makeEditableChapters(props.vod.chapters);
}

</script>

<style lang="scss" scoped>
    .table {
        td {
            padding: 0.1rem;
        }
    }

    .chaptervis {
        width: 100%;
        border-collapse: collapse;
        border: 1px solid black;
        margin: 0.5rem 0;

        td {
            padding: 0.3em;
            font-size: 0.9em;
        }
        
        // every odd td is colored
        tr td:nth-child(odd) {
            background-color: rgba(128, 128, 128, 0.5)
        }
    }
</style>