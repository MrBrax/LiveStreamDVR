<template>
    <div class="container">
        <section class="section">
            <div class="section-title"><h1>Clips</h1></div>
            <div class="section-content">
                <FileManager path="storage/saved_clips" web="saved_clips" />
            </div>
        </section>
        <section class="section">
            <div class="section-title"><h1>VODs</h1></div>
            <div class="section-content">
                <FileManager path="storage/saved_vods" web="saved_vods" />
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