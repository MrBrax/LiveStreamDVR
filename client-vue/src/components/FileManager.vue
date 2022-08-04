<template>
    <div class="file-manager">
        <p v-if="isPrivate" class="error">
            {{ $t('components.filemanager.these-files-are-not-downloadable-due-to-a-config-setting') }}
        </p>
        <table class="table is-fullwidth is-striped" v-if="!error && files.length > 0">
            <thead>
                <tr>
                    <th></th>
                    <th style="cursor: pointer;" @click="setSort('name')">
                        <span>{{ $t('components.filemanager.name') }}</span>
                        <span v-if="sortBy == 'name'" class="icon is-small">
                            <fa icon="sort-down" v-if="sortOrder === 'asc'" />
                            <fa icon="sort-up" v-if="sortOrder === 'desc'" />
                        </span>
                    </th>
                    <th style="cursor: pointer;" @click="setSort('size')">
                        <span>{{ $t('components.filemanager.size') }}</span>
                        <span v-if="sortBy == 'size'" class="icon is-small">
                            <fa icon="sort-down" v-if="sortOrder === 'asc'" />
                            <fa icon="sort-up" v-if="sortOrder === 'desc'" />
                        </span>
                    </th>
                    <th style="cursor: pointer;" @click="setSort('date')">
                        <span>{{ $t('components.filemanager.last-modified') }}</span>
                        <span v-if="sortBy == 'date'" class="icon is-small">
                            <fa icon="sort-down" v-if="sortOrder === 'asc'" />
                            <fa icon="sort-up" v-if="sortOrder === 'desc'" />
                        </span>
                    </th>
                    <th>{{ $t('components.filemanager.actions') }}</th>
                </tr>
            </thead>
            <tr class="file-manager-item" v-for="(item, index) in sortedFiles">
                <td width="16" class="file-manager-item-icon">
                    <fa :icon="getIconName(item.extension)" />
                </td>
                <td class="file-manager-item-name">
                    <a v-if="web && item.is_public" :href="downloadLink(item)" target="_blank">
                        {{ item.name }}
                    </a>
                    <span v-else>
                        {{ item.name }}
                    </span>
                </td>
                <td class="file-manager-item-size">{{ formatBytes(item.size) }}</td>
                <td class="file-manager-item-date">{{ item.date }}</td>
                <td class="file-manager-item-actions">
                    <div class="buttons">
                        <a v-if="web && item.is_public" class="button is-small is-confirm" :href="downloadLink(item)" target="_blank" download>
                            <span><fa icon="download"></fa></span>
                        </a>
                        <button class="button is-small is-danger" @click="deleteFile(item)">
                            <span><fa icon="trash"></fa></span>
                        </button>
                        <button v-if="['mp4'].includes(item.extension)" class="button is-small is-info" @click="showExportFileDialog(item)">
                            <span><fa icon="upload"></fa></span>
                        </button>
                    </div>
                </td>
            </tr> 
        </table>
        <div v-else-if="!error">
            No files found.
        </div>
        <div class="notification is-danger error" v-if="error">
            {{ error }}
        </div>
    </div>
    <modal-box ref="exportFileMenu" title="Export File">

        <pre>{{ exportVodSettings.file_folder }}/{{ exportVodSettings.file_name }}</pre>

        <form @submit.prevent="doExportFile">

            <!-- Exporter -->
            <div class="field">
                <label class="label">{{ $t('vod.export.export-type') }}</label>
                <div class="control">
                    <select class="input" v-model="exportVodSettings.exporter">
                        <option value="file">File</option>
                        <option value="youtube">YouTube</option>
                        <option value="sftp">SFTP</option>
                    </select>
                </div>
            </div>

            <!-- Title / Filename -->
            <div class="field">
                <label class="label">{{ $t('vod.export.title') }}</label>
                <div class="control">
                    <input class="input" type="text" v-model="exportVodSettings.title" required />
                </div>
            </div>

            <!-- Directory -->
            <div class="field" v-if="exportVodSettings.exporter == 'file' || exportVodSettings.exporter == 'sftp'">
                <label class="label">{{ $t('vod.export.directory') }}</label>
                <div class="control">
                    <input class="input" type="text" v-model="exportVodSettings.directory" />
                </div>
            </div>

            <!-- Host -->
            <div class="field" v-if="exportVodSettings.exporter == 'sftp'">
                <label class="label">{{ $t('vod.export.host') }}</label>
                <div class="control">
                    <input class="input" type="text" v-model="exportVodSettings.host" />
                </div>
            </div>

            <!-- Username -->
            <div class="field" v-if="exportVodSettings.exporter == 'sftp'">
                <label class="label">{{ $t('vod.export.username') }}</label>
                <div class="control">
                    <input class="input" type="text" v-model="exportVodSettings.username" />
                </div>
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
                    <button class="button is-confirm">
                        <span class="icon"><fa icon="upload" /></span>
                        <span>{{ $t("buttons.export") }}</span>
                    </button>
                </div>
            </div>
        </form>
    </modal-box>
</template>

<script lang="ts">
import { useStore } from "@/store";
import { AxiosError } from "axios";
import { defineComponent, ref } from "vue";
import ModalBox from "./ModalBox.vue";
import { formatString } from "@common/Format";
import { YouTubeCategories } from "@/defs";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faSortUp, faSortDown, faFileVideo, faFile, faFileCsv, faFileCode, faFileLines } from "@fortawesome/free-solid-svg-icons";
import { ApiResponse } from "@common/Api/Api";
library.add(faSortUp, faSortDown, faFileVideo, faFile, faFileCsv, faFileCode, faFileLines);

interface ApiFile {
    name: string;
    size: number;
    date: string;
    is_dir: boolean;
    extension: string;
    is_public: boolean;
}

export default defineComponent({
    name: "FileManager",
    props: {
        path: {
            type: String,
            required: true,
        },
        web: {
            type: String,
        },
        defaultSortBy: {
            type: String,
            default: "name",
        },
        defaultSortOrder: {
            type: String,
            default: "asc",
        },
    },
    setup() {
        const store = useStore();
        const exportFileMenu = ref<InstanceType<typeof ModalBox>>();
        return { store, exportFileMenu, YouTubeCategories };
    },
    data(): {
        files: ApiFile[];
        error: string;
        sortBy: "name" | "size" | "date";
        sortOrder: "asc" | "desc";
        exportVodSettings: {
            exporter: "file" | "sftp" | "youtube";
            title: string;
            directory: string;
            host: string;
            username: string;
            description: string;
            category: string;
            tags: string;
            file_folder: string;
            file_name: string;
            privacy: "public" | "unlisted" | "private";
        };
        exporterTemplateVariables: string[];
    } {
        return {
            files: [],
            error: "",
            sortBy: this.defaultSortBy as "name" | "size" | "date",
            sortOrder: this.defaultSortOrder as "asc" | "desc",
            exportVodSettings: {
                exporter: "file",
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
            },
            exporterTemplateVariables: [
                "login",
                "title",
                "stream_number",
                "comment",
                "date",
                "resolution",
            ],
        };
    },
    created() {
    },
    mounted() {
        this.fetchFileList();
    },
    methods: {
        fetchFileList() {
            console.debug("Fetching file list...");
            this.$http.get(`/api/v0/files?path=${this.path}`).then((response) => {
                this.files = response.data.data.files;
            }).catch((error: AxiosError | Error) => {
                if ("response" in error && error.response?.data.message) {
                    // alert(error.response.data.message);
                    this.error = error.response.data.message;
                }
            });
        },
        deleteFile(file: ApiFile) {
            this.$http.delete(`/api/v0/files?path=${this.path}&name=${file.name}`).then((response) => {
                this.fetchFileList();
            });
        },
        downloadLink(file: ApiFile) {
            const base = import.meta.env.BASE_URL || "/";
            const url = `${base}${this.web}/${file.name}`;
            return url;
        },
        setSort(sortBy: "name" | "size" | "date") {
            this.sortBy = sortBy;
            this.sortOrder = this.sortOrder === "asc" ? "desc" : "asc";
        },
        getIconName(extension: string) {
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
        },
        showExportFileDialog(file: ApiFile) {
            if (!this.exportFileMenu) return;
            // this.exportFileMenu.value = this.$refs.exportFileMenu as InstanceType<typeof ModalBox>;
            // this.exportFileMenu.value.show();
            this.exportVodSettings.file_folder = this.path;
            this.exportVodSettings.file_name = file.name;
            this.exportFileMenu.show = true;
        },
        doExportFile() {
            // if (!this.vod) return;
            this.$http.post(`/api/v0/exporter?mode=file`, this.exportVodSettings).then((response) => {
                const json: ApiResponse = response.data;
                if (json.message) alert(json.message);
                console.log(json);
                // if (this.vod) this.store.fetchAndUpdateVod(this.vod.basename);
                // if (this.editVodMenu) this.editVodMenu.show = false;
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
    },
    components: {
        ModalBox,
    },
    computed: {
        sortedFiles() {
            return this.files.filter(file => !file.is_dir).sort((a, b) => {
                if (typeof a[this.sortBy] === "string") {
                    if (this.sortOrder === "asc") {
                        return (a[this.sortBy] as string).localeCompare(b[this.sortBy] as string);
                    } else {
                        return (b[this.sortBy] as string).localeCompare(a[this.sortBy] as string);
                    }
                } else {
                    if (this.sortOrder === "asc") {
                        return (a[this.sortBy] as number) - (b[this.sortBy] as number);
                    } else {
                        return (b[this.sortBy] as number) - (a[this.sortBy] as number);
                    }
                }
            });
        },
        isPrivate() {
            return this.files.some(file => file.is_public === false);
        },
    },
});
</script>

<style lang="scss">
.file-manager {
    max-height: 30rem;
    overflow-y: auto;
}
</style>