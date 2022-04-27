<template>
    <table class="table file-manager is-fullwidth is-striped" v-if="!error">
        <tr class="file-manager-item" v-for="(item, index) in files">
            <td class="file-manager-item-name">{{ item.name }}</td>
            <td class="file-manager-item-size">{{ formatBytes(item.size) }}</td>
            <td class="file-manager-item-date">{{ item.date }}</td>
            <td class="file-manager-item-actions">
                <a class="button is-small is-confirm" :href="downloadLink(item)" target="_blank" download><fa icon="download"></fa></a>
                <button class="button is-small is-danger" @click="deleteFile(item)"><fa icon="trash"></fa></button>
            </td>
        </tr> 
    </table>
    <div class="notification is-danger error" v-if="error">
        {{ error }}
    </div>
</template>

<script lang="ts">
import { useStore } from "@/store";
import { AxiosError } from "axios";
import { defineComponent } from "vue";

// import { library } from "@fortawesome/fontawesome-svg-core";
// import { faSkull, faTrash } from "@fortawesome/free-solid-svg-icons";
// import { useStore } from "@/store";
// import { JobStatus } from "@common/Defs";
// library.add(faSkull, faTrash);

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
            required: true,
        },
    },
    setup() {
        const store = useStore();
        return { store };
    },
    data(): {
        files: ApiFile[];
        error: string;
    } {
        return {
            files: [],
            error: "",
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
    },
    components: {
    },
});
</script>

<style lang="scss">

    

</style>