<template>
    <section class="section">
        <div class="section-title">
            <h1>{{ $t('pages.favourite-games') }}</h1>
        </div>
        <div class="section-content">
            <favourites-form />
        </div>
    </section>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import FavouritesForm from "@/components/forms/FavouritesForm.vue";
export default defineComponent({
    // name: "SettingsChannelsView",
    components: {
        FavouritesForm,
    },
});
</script>
            