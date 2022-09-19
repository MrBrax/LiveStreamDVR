<template>
    <section class="section">
        <div class="section-title">
            <h1>{{ $t('pages.client-settings') }}</h1>
        </div>
        <client-settings-form />
    </section>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import ClientSettingsForm from "@/components/forms/ClientSettingsForm.vue";
export default defineComponent({
    // name: "SettingsChannelsView",
    components: {
        ClientSettingsForm,
    },
});
</script>
            