<template>
    <section class="section">
        <div class="section-title">
            <h1>{{ t("pages.keyvalue") }}</h1>
        </div>
        <div class="section-content">
            <key-value-form />
        </div>
    </section>
</template>

<script lang="ts" setup>
import KeyValueForm from "@/components/forms/KeyValueForm.vue";
import { useI18n } from "vue-i18n";
const { t } = useI18n();
</script>
