<template>
    <div class="container">
        <section class="section">
            <div class="section-title"><h1>Clips</h1></div>
            <div class="section-content">
                WIP
            </div>
        </section>
        <section class="section">
            <div class="section-title"><h1>VODs</h1></div>
            <div class="section-content">
                WIP
            </div>
        </section>
    </div>
</template>

<script lang="ts">
import { useStore } from "@/store";
import { defineComponent } from "vue";

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
    },
});
</script>
