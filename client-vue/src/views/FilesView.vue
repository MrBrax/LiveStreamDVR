<template>
    <div class="container vertical">
        <section class="section is-fullwidth">
            <div class="section-title">
                <h1>{{ t('views.files.folders.clips') }}</h1>
            </div>
            <div class="section-content">
                <FileManager
                    path="storage/saved_clips"
                    web="saved_clips"
                />
            </div>
        </section>
        <section class="section is-fullwidth">
            <div class="section-title">
                <h1>{{ t('views.files.folders.archived-vods') }}</h1>
            </div>
            <div class="section-content">
                <FileManager
                    path="storage/saved_vods"
                    web="saved_vods"
                />
            </div>
        </section>
        <section class="section is-fullwidth">
            <div class="section-title">
                <h1>{{ t('views.files.folders.application-logs') }}</h1>
            </div>
            <div class="section-content">
                <FileManager
                    path="logs"
                    web="logs"
                    default-sort-by="date"
                    default-sort-order="desc"
                />
            </div>
        </section>
        <section class="section is-fullwidth">
            <div class="section-title">
                <h1>{{ t('views.files.folders.software-logs') }}</h1>
            </div>
            <div class="section-content">
                <FileManager
                    path="logs/software"
                    web="logs/software"
                    default-sort-by="date"
                    default-sort-order="desc"
                />
            </div>
        </section>
    </div>
</template>

<script lang="ts" setup>
// import { useStore } from "@/store";
import FileManager from "@/components/FileManager.vue";
import { useI18n } from "vue-i18n";

// import { library } from "@fortawesome/fontawesome-svg-core";
// import { faSkull, faTrash } from "@fortawesome/free-solid-svg-icons";
// import { useStore } from "@/store";
// import { JobStatus } from "@common/Defs";
// library.add(faSkull, faTrash);

// const store = useStore();
const { t } = useI18n();
 
</script>