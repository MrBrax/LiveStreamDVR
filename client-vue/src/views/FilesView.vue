<template>
    <div class="container vertical">
        <section class="section is-fullwidth">
            <div class="section-title"><h1>Clips</h1></div>
            <div class="section-content">
                <FileManager path="storage/saved_clips" web="saved_clips" />
            </div>
        </section>
        <section class="section is-fullwidth">
            <div class="section-title"><h1>Archived VODs</h1></div>
            <div class="section-content">
                <FileManager path="storage/saved_vods" web="saved_vods" />
            </div>
        </section>
        <section class="section is-fullwidth">
            <div class="section-title"><h1>Application logs</h1></div>
            <div class="section-content">
                <FileManager path="logs" web="logs" />
            </div>
        </section>
        <section class="section is-fullwidth">
            <div class="section-title"><h1>Software logs</h1></div>
            <div class="section-content">
                <FileManager path="logs/software" web="logs/software" />
            </div>
        </section>
    </div>
</template>

<script lang="ts">
import { useStore } from "@/store";
import { defineComponent } from "vue";
import FileManager from "@/components/FileManager.vue";

// import { library } from "@fortawesome/fontawesome-svg-core";
// import { faSkull, faTrash } from "@fortawesome/free-solid-svg-icons";
// import { useStore } from "@/store";
// import { JobStatus } from "@common/Defs";
// library.add(faSkull, faTrash);

export default defineComponent({
    name: "FilesView",
    title: "Files",
    setup() {
        const store = useStore();
        return { store };
    },
    data() {
    },
    created() {
    },
    methods: {
    },
    components: {
    FileManager
},
});
</script>