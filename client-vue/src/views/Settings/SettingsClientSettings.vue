<template>
    <section class="section">
        <div class="section-title">
            <h1>{{ t('pages.client-settings') }}</h1>
        </div>
        <client-settings-form />
    </section>
</template>

<script lang="ts" setup>
import ClientSettingsForm from "@/components/forms/ClientSettingsForm.vue";
import { useI18n } from "vue-i18n";
const { t } = useI18n();
</script>
            