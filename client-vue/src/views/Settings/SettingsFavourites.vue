<template>
    <section class="section">
        <div class="section-title">
            <h1>{{ t('pages.favourite-games') }}</h1>
        </div>
        <div class="section-content">
            <favourites-form />
        </div>
    </section>
</template>

<script lang="ts" setup>
import FavouritesForm from "@/components/forms/FavouritesForm.vue";
import { useI18n } from "vue-i18n";
const { t } = useI18n();
</script>
            