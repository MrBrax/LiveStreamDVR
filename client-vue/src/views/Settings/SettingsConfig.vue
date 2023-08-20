<template>
    <section class="section">
        <div class="section-title">
            <h1>{{ t("pages.config") }}</h1>
        </div>
        <div class="section-content">
            <settings-form />
        </div>
    </section>
</template>

<script lang="ts" setup>
import SettingsForm from "@/components/forms/SettingsForm.vue";
import { useI18n } from "vue-i18n";
const { t } = useI18n();
</script>
