<template>
    <div
        v-if="!vod?.segments || vod.segments.length == 0"
        class="notification is-error"
    >
        {{ $t('vod.export.no-segments') }}
    </div>

    <!-- Exporter -->
    <div class="field">
        <label class="label">{{ $t('vod.export.export-type') }}</label>
        <div class="control">
            <select
                v-model="exportVodSettings.exporter"
                class="input"
            >
                <option value="file">
                    File
                </option>
                <option value="youtube">
                    YouTube
                </option>
                <option value="sftp">
                    SFTP
                </option>
                <option value="ftp">
                    FTP
                </option>
                <option value="rclone">
                    RClone
                </option>
            </select>
        </div>
        <p v-if="exportVodSettings.exporter == 'youtube'">
            Upload videos directly to YouTube.<br>
            The API set up is quite cumbersome, requiring your channel to be reviewed.
        </p>
        <p v-if="exportVodSettings.exporter == 'ftp'">
            Old and outdated file transfer protocol. I would not suggest using this. If you insist, use it only on LAN.<br>
            It is not encrypted and will send both your username/password and files for MITM to see.
        </p>
        <p v-if="exportVodSettings.exporter == 'sftp'">
            Only key-file based authentication is supported. It should be automatically handled by SSH, if you know what that means.
        </p>
        <p v-if="exportVodSettings.exporter == 'rclone'">
            RClone is a multi-protocol file management program.<br>
            Generate a config file with <code>rclone config</code> and place <code>rclone.conf</code> in the <code>config</code> directory.<br>
            Read more at <a
                href="https://rclone.org/"
                rel="noreferrer"
                target="_blank"
            >https://rclone.org/</a>
        </p>
    </div>

    <!-- File -->
    <div class="field">
        <label class="label">{{ $t('vod.export.file-source') }}</label>
        <div class="control">
            <div class="select">
                <select v-model="exportVodSettings.file_source">
                    <option value="segment">
                        First captured segment
                    </option>
                    <option
                        value="downloaded"
                        :disabled="!vod?.is_vod_downloaded"
                    >
                        Downloaded
                    </option>
                    <option
                        value="burned"
                        :disabled="!vod?.is_chat_burned"
                    >
                        Burned
                    </option>
                </select>
            </div>
        </div>
    </div>

    <!-- Title / Filename -->
    <div class="field">
        <label class="label">{{ $t('vod.export.title-template') }}</label>
        <div class="control">
            <input
                v-model="exportVodSettings.title_template"
                class="input"
                type="text"
            >
            <ul class="template-replacements">
                <li
                    v-for="(v, k) in ExporterFilenameFields"
                    :key="k"
                >
                    {{ k }}
                </li>
            </ul>
            <p
                v-if="exportVodSettings.exporter == 'file' || exportVodSettings.exporter == 'sftp' || exportVodSettings.exporter == 'ftp' || exportVodSettings.exporter == 'rclone'"
                class="template-preview"
            >
                {{ templatePreview(exportVodSettings.title_template) }}.mp4
            </p>
            <p
                v-else-if="exportVodSettings.exporter == 'youtube'"
                class="template-preview"
            >
                {{ templatePreview(exportVodSettings.title_template) }}
            </p>
        </div>
    </div>

    <!-- Directory -->
    <div
        v-if="exportVodSettings.exporter == 'file' || exportVodSettings.exporter == 'sftp' || exportVodSettings.exporter == 'ftp' || exportVodSettings.exporter == 'rclone'"
        class="field"
    >
        <label class="label">{{ $t('vod.export.directory') }}</label>
        <div class="control">
            <input
                v-model="exportVodSettings.directory"
                class="input"
                type="text"
            >
            <p class="input-help">
                The folder where you want the file to end up in. Both local and remote.
            </p>
        </div>
    </div>

    <!-- Host -->
    <div
        v-if="exportVodSettings.exporter == 'sftp' || exportVodSettings.exporter == 'ftp'"
        class="field"
    >
        <label class="label">{{ $t('vod.export.host') }}</label>
        <div class="control">
            <input
                v-model="exportVodSettings.host"
                class="input"
                type="text"
            >
        </div>
    </div>

    <!-- Remote -->
    <div
        v-if="exportVodSettings.exporter == 'rclone'"
        class="field"
    >
        <label class="label">{{ $t('vod.export.remote') }}</label>
        <div class="control">
            <input
                v-model="exportVodSettings.remote"
                class="input"
                type="text"
            >
        </div>
    </div>

    <!-- Username -->
    <div
        v-if="exportVodSettings.exporter == 'sftp' || exportVodSettings.exporter == 'ftp'"
        class="field"
    >
        <label class="label">{{ $t('vod.export.username') }}</label>
        <div class="control">
            <input
                v-model="exportVodSettings.username"
                class="input"
                type="text"
            >
        </div>
    </div>

    <!-- Password -->
    <div
        v-if="exportVodSettings.exporter == 'ftp'"
        class="field"
    >
        <label class="label">{{ $t('vod.export.password') }}</label>
        <div class="control">
            <input
                v-model="exportVodSettings.password"
                class="input"
                type="password"
            >
        </div>
        <p class="help">
            {{ $t('vod.export.password-help') }}
        </p>
    </div>

    <!-- YouTube Authentication -->
    <div
        v-if="exportVodSettings.exporter == 'youtube'"
        class="field"
    >
        <youtube-auth />
    </div>

    <!-- Description -->
    <div
        v-if="exportVodSettings.exporter == 'youtube'"
        class="field"
    >
        <label class="label">{{ $t('vod.export.description') }}</label>
        <div class="control">
            <textarea
                v-model="exportVodSettings.description"
                class="input textarea"
            />
        </div>
    </div>

    <!-- Category -->
    <div
        v-if="exportVodSettings.exporter == 'youtube'"
        class="field"
    >
        <label class="label">{{ $t('vod.export.category') }}</label>
        <div class="control">
            <div class="select">
                <select v-model="exportVodSettings.category">
                    <option
                        v-for="(c, i) in YouTubeCategories"
                        :key="i"
                        :value="i"
                    >
                        {{ c }}
                    </option>
                </select>
            </div>
        </div>
    </div>

    <!-- Tags -->
    <div
        v-if="exportVodSettings.exporter == 'youtube'"
        class="field"
    >
        <label class="label">{{ $t('vod.export.tags') }}</label>
        <div class="control">
            <input
                v-model="exportVodSettings.tags"
                class="input"
                type="text"
            >
        </div>
        <p class="input-help">
            {{ $t('vod.export.tags-help') }}
        </p>
    </div>

    <!-- Privacy -->
    <div
        v-if="exportVodSettings.exporter == 'youtube'"
        class="field"
    >
        <label class="label">{{ $t('vod.export.privacy') }}</label>
        <div class="control">
            <div class="select">
                <select v-model="exportVodSettings.privacy">
                    <option value="public">
                        {{ $t('vod.export.privacy-public') }}
                    </option>
                    <option value="unlisted">
                        {{ $t('vod.export.privacy-unlisted') }}
                    </option>
                    <option value="private">
                        {{ $t('vod.export.privacy-private') }}
                    </option>
                </select>
            </div>
        </div>
    </div>

    <div class="field">
        <div class="control">
            <button
                class="button is-confirm"
                @click="doExportVod"
            >
                <span class="icon"><fa icon="upload" /></span>
                <span>{{ $t("buttons.export") }}</span>
            </button>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { useStore, VODTypes } from '@/store';
import { ExporterFilenameFields } from "@common/ReplacementsConsts";
import { formatString } from '@common/Format';
import { YouTubeCategories } from "@/defs";
import axios from 'axios';
import { ApiResponse } from '@common/Api/Api';
import YoutubeAuth from "@/components/YoutubeAuth.vue";

const props = defineProps<{
    vod: VODTypes;
}>();

const store = useStore();

const exportVodSettings = ref({
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
    remote: "",
});

function templatePreview(template: string): string {
    const replaced_string = formatString(template, Object.fromEntries(Object.entries(ExporterFilenameFields).map(([key, value]) => [key, value.display])));
    return replaced_string;
}

function doExportVod() {
    if (!props.vod) return;
    axios.post(`/api/v0/exporter?mode=vod`, exportVodSettings.value).then((response) => {
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

function applyDefaultExportSettings() {
    if (store.cfg("exporter.default.exporter")) exportVodSettings.value.exporter = store.cfg("exporter.default.exporter");
    if (store.cfg("exporter.default.directory")) exportVodSettings.value.directory = store.cfg("exporter.default.directory");
    if (store.cfg("exporter.default.host")) exportVodSettings.value.host = store.cfg("exporter.default.host");
    if (store.cfg("exporter.default.username")) exportVodSettings.value.username = store.cfg("exporter.default.username");
    if (store.cfg("exporter.default.password")) exportVodSettings.value.password = store.cfg("exporter.default.password");
    if (store.cfg("exporter.default.description")) exportVodSettings.value.description = store.cfg("exporter.default.description");
    if (store.cfg("exporter.default.tags")) exportVodSettings.value.tags = store.cfg("exporter.default.tags");
    if (store.cfg("exporter.default.remote")) exportVodSettings.value.remote = store.cfg("exporter.default.remote");
}

onMounted(() => {
    if (props.vod) {
        exportVodSettings.value.vod = props.vod.basename;
        applyDefaultExportSettings();
    }
});

</script>