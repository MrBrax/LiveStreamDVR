<template>
    <section class="section">
        <div class="section-title">
            <h1>{{ $t('pages.config') }}</h1>
        </div>
        <div class="section-content">
            <settings-form />
        </div>
    </section>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import SettingsForm from "@/components/forms/SettingsForm.vue";
export default defineComponent({
    // name: "SettingsChannelsView",
    components: {
        SettingsForm,
    },
});
</script>
    