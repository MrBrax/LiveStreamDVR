<template>
    <section class="section">
        <div class="section-title">
            <h1>{{ $t('pages.keyvalue') }}</h1>
        </div>
        <div class="section-content">
            <key-value-form />
        </div>
    </section>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import KeyValueForm from "@/components/forms/KeyValueForm.vue";
export default defineComponent({
    // name: "SettingsChannelsView",
    components: {
        KeyValueForm,
    },
});
</script>
            