<template>
    <div class="file-manager">
        <table class="table is-fullwidth is-striped" v-if="!error">
            <thead>
                <tr>
                    <th style="cursor: pointer;" @click="setSort('name')">
                        Name
                        <span v-if="sortBy == 'name'" class="icon is-small">
                            <fa icon="sort-down" v-if="sortOrder === 'asc'" />
                            <fa icon="sort-up" v-if="sortOrder === 'desc'" />
                        </span>
                    </th>
                    <th style="cursor: pointer;" @click="setSort('size')">
                        Size
                        <span v-if="sortBy == 'size'" class="icon is-small">
                            <fa icon="sort-down" v-if="sortOrder === 'asc'" />
                            <fa icon="sort-up" v-if="sortOrder === 'desc'" />
                        </span>
                    </th>
                    <th style="cursor: pointer;" @click="setSort('date')">
                        Last modified
                        <span v-if="sortBy == 'date'" class="icon is-small">
                            <fa icon="sort-down" v-if="sortOrder === 'asc'" />
                            <fa icon="sort-up" v-if="sortOrder === 'desc'" />
                        </span>
                    </th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tr class="file-manager-item" v-for="(item, index) in sortedFiles">
                <td class="file-manager-item-name">{{ item.name }}</td>
                <td class="file-manager-item-size">{{ formatBytes(item.size) }}</td>
                <td class="file-manager-item-date">{{ item.date }}</td>
                <td class="file-manager-item-actions">
                    <a v-if="web" class="button is-small is-confirm" :href="downloadLink(item)" target="_blank" download><fa icon="download"></fa></a>
                    <button class="button is-small is-danger" @click="deleteFile(item)"><fa icon="trash"></fa></button>
                </td>
            </tr> 
        </table>
        <div class="notification is-danger error" v-if="error">
            {{ error }}
        </div>
    </div>
</template>

<script lang="ts">
import { useStore } from "@/store";
import { AxiosError } from "axios";
import { defineComponent } from "vue";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faSortUp, faSortDown } from "@fortawesome/free-solid-svg-icons";
// import { useStore } from "@/store";
// import { JobStatus } from "@common/Defs";
library.add(faSortUp, faSortDown);

interface ApiFile {
    name: string;
    size: number;
    date: string;
    is_dir: boolean;
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
    },
    setup() {
        const store = useStore();
        return { store };
    },
    data(): {
        files: ApiFile[];
        error: string;
        sortBy: "name" | "size" | "date";
        sortOrder: "asc" | "desc";
    } {
        return {
            files: [],
            error: "",
            sortBy: "name",
            sortOrder: "asc",
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
    },
    components: {
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
    },
});
</script>

<style lang="scss">
.file-manager {
    max-height: 30rem;
    overflow-y: auto;
}
</style>