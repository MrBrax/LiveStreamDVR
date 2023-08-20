<template>
    <div class="file-manager">
        <p v-if="isPrivate" class="error">
            {{ t("components.filemanager.these-files-are-not-downloadable-due-to-a-config-setting") }}
        </p>
        <table v-if="!errorDisplay && files.length > 0" class="table is-fullwidth is-striped">
            <thead>
                <tr>
                    <th />
                    <th style="cursor: pointer" @click="setSort('name')">
                        <span>{{ t("components.filemanager.name") }}</span>
                        <span v-if="sortBy == 'name'" class="icon is-small">
                            <fa v-if="sortOrder === 'asc'" icon="sort-down" />
                            <fa v-if="sortOrder === 'desc'" icon="sort-up" />
                        </span>
                    </th>
                    <th style="cursor: pointer" @click="setSort('size')">
                        <span>{{ t("components.filemanager.size") }}</span>
                        <span v-if="sortBy == 'size'" class="icon is-small">
                            <fa v-if="sortOrder === 'asc'" icon="sort-down" />
                            <fa v-if="sortOrder === 'desc'" icon="sort-up" />
                        </span>
                    </th>
                    <th style="cursor: pointer" @click="setSort('date')">
                        <span>{{ t("components.filemanager.last-modified") }}</span>
                        <span v-if="sortBy == 'date'" class="icon is-small">
                            <fa v-if="sortOrder === 'asc'" icon="sort-down" />
                            <fa v-if="sortOrder === 'desc'" icon="sort-up" />
                        </span>
                    </th>
                    <th>{{ t("components.filemanager.actions") }}</th>
                </tr>
            </thead>
            <tr v-for="item in sortedFiles" :key="item.name" class="file-manager-item">
                <td width="16" class="file-manager-item-icon">
                    <font-awesome-icon :icon="getIconName(item.extension)" />
                </td>
                <td class="file-manager-item-name">
                    <a v-if="web && item.is_public" :href="downloadLink(item)" target="_blank">
                        {{ item.name }}
                    </a>
                    <span v-else>
                        {{ item.name }}
                    </span>
                </td>
                <td class="file-manager-item-size">
                    {{ formatBytes(item.size) }}
                </td>
                <td class="file-manager-item-date">
                    {{ item.date }}
                </td>
                <td class="file-manager-item-actions">
                    <div class="buttons">
                        <a v-if="web && item.is_public" class="button is-small is-confirm" :href="downloadLink(item)" target="_blank" download>
                            <span><font-awesome-icon icon="download" /></span>
                        </a>
                        <button class="button is-small is-danger" @click="deleteFile(item)">
                            <span><font-awesome-icon icon="trash" /></span>
                        </button>
                        <button v-if="['mp4'].includes(item.extension)" class="button is-small is-info" @click="showExportFileDialog(item)">
                            <span><font-awesome-icon icon="upload" /></span>
                        </button>
                    </div>
                </td>
            </tr>
        </table>
        <div v-else-if="!errorDisplay">No files found.</div>
        <div v-if="errorDisplay" class="notification is-danger error">
            {{ errorDisplay }}
        </div>
    </div>
    <modal-box :show="showExportFileDialogEl" title="Export File" @close="showExportFileDialogEl = false">
        <pre>{{ exportVodSettings.file_folder }}/{{ exportVodSettings.file_name }}</pre>

        <form @submit.prevent="doExportFile">
            <!-- Exporter -->
            <div class="field">
                <label class="label">{{ t("vod.export.export-type") }}</label>
                <div class="control">
                    <div class="select">
                        <select v-model="exporter">
                            <option value="file">File</option>
                            <option value="youtube">YouTube</option>
                            <option value="sftp">SFTP</option>
                            <option value="ftp">FTP</option>
                            <option value="rclone">RClone</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Title / Filename -->
            <div class="field">
                <label class="label">{{ t("vod.export.title") }}</label>
                <div class="control">
                    <input v-model="exportVodSettings.title" class="input" type="text" required />
                </div>
            </div>

            <!-- Directory -->
            <div v-if="exporter == 'file' || exporter == 'sftp' || exporter == 'ftp' || exporter == 'rclone'" class="field">
                <label class="label">{{ t("vod.export.directory") }}</label>
                <div class="control">
                    <input v-model="exportVodSettings.directory" class="input" type="text" />
                </div>
            </div>

            <!-- Host -->
            <div v-if="exporter == 'sftp' || exporter == 'ftp'" class="field">
                <label class="label">{{ t("vod.export.host") }}</label>
                <div class="control">
                    <input v-model="exportVodSettings.host" class="input" type="text" />
                </div>
            </div>

            <!-- Remote -->
            <div v-if="exporter == 'rclone'" class="field">
                <label class="label">{{ t("vod.export.remote") }}</label>
                <div class="control">
                    <input v-model="exportVodSettings.remote" class="input" type="text" />
                </div>
            </div>

            <!-- Username -->
            <div v-if="exporter == 'sftp' || exporter == 'ftp'" class="field">
                <label class="label">{{ t("vod.export.username") }}</label>
                <div class="control">
                    <input v-model="exportVodSettings.username" class="input" type="text" />
                </div>
            </div>

            <!-- Password -->
            <div v-if="exporter == 'ftp'" class="field">
                <label class="label">{{ t("vod.export.password") }}</label>
                <div class="control">
                    <input v-model="exportVodSettings.password" class="input" type="password" />
                </div>
                <p class="help">
                    {{ t("vod.export.password-help") }}
                </p>
            </div>

            <!-- YouTube Authentication -->
            <div v-if="exporter == 'youtube'" class="field">
                <youtube-auth />
            </div>

            <!-- Description -->
            <div v-if="exporter == 'youtube'" class="field">
                <label class="label">{{ t("vod.export.description") }}</label>
                <div class="control">
                    <textarea v-model="exportVodSettings.description" class="input textarea" />
                </div>
            </div>

            <!-- Category -->
            <div v-if="exporter == 'youtube'" class="field">
                <label class="label">{{ t("vod.export.category") }}</label>
                <div class="control">
                    <div class="select">
                        <select v-model="exportVodSettings.category">
                            <option v-for="(c, i) in YouTubeCategories" :key="i" :value="i">
                                {{ c }}
                            </option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Tags -->
            <div v-if="exporter == 'youtube'" class="field">
                <label class="label">{{ t("vod.export.tags") }}</label>
                <div class="control">
                    <input v-model="exportVodSettings.tags" class="input" type="text" />
                </div>
                <p class="input-help">
                    {{ t("vod.export.tags-help") }}
                </p>
            </div>

            <!-- Privacy -->
            <div v-if="exporter == 'youtube'" class="field">
                <label class="label">{{ t("vod.export.privacy") }}</label>
                <div class="control">
                    <div class="select">
                        <select v-model="exportVodSettings.privacy">
                            <option value="public">
                                {{ t("vod.export.privacy-public") }}
                            </option>
                            <option value="unlisted">
                                {{ t("vod.export.privacy-unlisted") }}
                            </option>
                            <option value="private">
                                {{ t("vod.export.privacy-private") }}
                            </option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="field">
                <div class="control">
                    <button class="button is-confirm">
                        <span class="icon"><font-awesome-icon icon="upload" /></span>
                        <span>{{ t("buttons.export") }}</span>
                    </button>
                </div>
            </div>
        </form>
    </modal-box>
</template>

<script lang="ts" setup>
import { useStore } from "@/store";
import axios, { AxiosError } from "axios";
import { computed, onMounted, ref } from "vue";
import ModalBox from "./ModalBox.vue";
import YoutubeAuth from "./YoutubeAuth.vue";
import { YouTubeCategories } from "@common/YouTube";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faSortUp, faSortDown, faFileVideo, faFile, faFileCsv, faFileCode, faFileLines, faDownload, faUpload } from "@fortawesome/free-solid-svg-icons";
import type { ApiResponse, ApiFilesResponse } from "@common/Api/Api";
import type { ApiFile } from "@common/Api/Client";
import type { ExporterOptions } from "@common/Exporter";
import { useI18n } from "vue-i18n";
import { formatBytes } from "@/mixins/newhelpers";
library.add(faSortUp, faSortDown, faFileVideo, faFile, faFileCsv, faFileCode, faFileLines, faDownload, faUpload);

// props
const props = defineProps<{
    path: string;
    web: string;
    defaultSortBy?: string;
    defaultSortOrder?: string;
}>();

// setup
const store = useStore();
const { t } = useI18n();

// data
const files = ref<ApiFile[]>([]);
const errorDisplay = ref<string>("");
const sortBy = ref<"name" | "size" | "date">(props.defaultSortBy as "name" | "size" | "date");
const sortOrder = ref<"asc" | "desc">(props.defaultSortOrder as "asc" | "desc");
const exportVodSettings = ref<ExporterOptions>({
    // exporter: "file",
    title: "",
    directory: "",
    host: "",
    username: "",
    description: "",
    tags: "",
    category: "",
    file_folder: "",
    file_name: "",
    privacy: "private",
    remote: "",
    password: "",
});
const exporter = ref<string>("file");
const showExportFileDialogEl = ref<boolean>(false);

// computed
const sortedFiles = computed(() => {
    return files.value
        .filter((file) => !file.is_dir)
        .sort((a, b) => {
            if (typeof a[sortBy.value] === "string") {
                if (sortOrder.value === "asc") {
                    return (a[sortBy.value] as string).localeCompare(b[sortBy.value] as string);
                } else {
                    return (b[sortBy.value] as string).localeCompare(a[sortBy.value] as string);
                }
            } else {
                if (sortOrder.value === "asc") {
                    return (a[sortBy.value] as number) - (b[sortBy.value] as number);
                } else {
                    return (b[sortBy.value] as number) - (a[sortBy.value] as number);
                }
            }
        });
});

const isPrivate = computed(() => {
    return files.value.some((file) => file.is_public === false);
});

// mounted
onMounted(() => {
    fetchFileList();
});

function fetchFileList() {
    console.debug("Fetching file list...");
    axios
        .get<ApiFilesResponse>(`/api/v0/files?path=${props.path}`)
        .then((response) => {
            files.value = response.data.data.files;
        })
        .catch((error: AxiosError<ApiFilesResponse> | Error) => {
            if ("response" in error && error.response?.data.message) {
                // alert(error.response.data.message);
                errorDisplay.value = error.response.data.message;
            }
        });
}

function deleteFile(file: ApiFile) {
    axios.delete(`/api/v0/files?path=${props.path}&name=${file.name}`).then((response) => {
        fetchFileList();
    });
}

function downloadLink(file: ApiFile) {
    const base = import.meta.env.BASE_URL || "/";
    const url = `${base}${props.web}/${file.name}`;
    return url;
}

function setSort(newSortBy: "name" | "size" | "date") {
    sortBy.value = newSortBy;
    sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
}

function getIconName(extension: string) {
    switch (extension) {
        case "mp4":
            return "file-video";
        case "mkv":
            return "file-video";
        case "ts":
            return "file-video";
        case "csv":
            return "file-csv";
        case "json":
            return "file-code";
        case "jsonline":
            return "file-code";
        case "log":
            return "file-lines";
        case "txt":
            return "file-lines";
        case "vtt":
            return "file-lines";
        case "chatdump":
            return "file-lines";
        case "line":
            return "file-lines";
        default:
            return "file";
    }
}

function showExportFileDialog(file: ApiFile) {
    // this.exportFileMenu.value = this.$refs.exportFileMenu as InstanceType<typeof ModalBox>;
    // this.exportFileMenu.value.show();
    exportVodSettings.value.file_folder = props.path;
    exportVodSettings.value.file_name = file.name;
    showExportFileDialogEl.value = true;
}

function doExportFile() {
    // if (!this.vod) return;
    axios
        .post<ApiResponse>(`/api/v0/exporter?mode=file&exporter=${exporter.value}`, exportVodSettings.value)
        .then((response) => {
            const json = response.data;
            if (json.message) alert(json.message);
            console.log(json);
            // if (this.vod) this.store.fetchAndUpdateVod(this.vod.basename);
            // if (this.editVodMenu) this.editVodMenu.show = false;
        })
        .catch((err) => {
            console.error("form error", err.response);
            if (err.response.data && err.response.data.message) alert(err.response.data.message);
        });
}

function doCheckYouTubeStatus() {
    axios
        .get<ApiResponse>("/api/v0/youtube/status")
        .then((response) => {
            const json = response.data;
            if (json.message) alert(json.message);
            console.log(json);
        })
        .catch((err) => {
            console.error("youtube check error", err.response);
            if (err.response.data && err.response.data.message) alert(err.response.data.message);
        });
}

function doAuthenticateYouTube() {
    const url = `${store.cfg<string>("basepath", "")}/api/v0/youtube/authenticate`;
    window.open(url, "_blank");
}
</script>

<style lang="scss">
.file-manager {
    max-height: 30rem;
    overflow-y: auto;
}
</style>
