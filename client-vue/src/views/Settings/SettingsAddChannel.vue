<template>
    <section class="section">
        <div class="section-title">
            <h1>{{ t("pages.new-channel") }}</h1>
        </div>
        <div class="section-content">
            <channel-add-form @form-success="updateUsers" />
        </div>
    </section>
</template>

<script lang="ts" setup>
import { useStore } from "@/store";
import ChannelAddForm from "@/components/forms/ChannelAddForm.vue";
import { useI18n } from "vue-i18n";

const store = useStore();
const { t } = useI18n();

function updateUsers() {
    store.fetchAndUpdateStreamerList();
}
</script>
