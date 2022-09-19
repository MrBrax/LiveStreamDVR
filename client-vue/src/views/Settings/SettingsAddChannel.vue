<template>
    <section class="section">
        <div class="section-title">
            <h1>{{ $t('pages.new-channel') }}</h1>
        </div>
        <div class="section-content">
            <channel-add-form @form-success="updateUsers" />
        </div>
    </section>
</template>

<script lang="ts">
import { useStore } from "@/store";
import { defineComponent } from "vue";
import ChannelAddForm from "@/components/forms/ChannelAddForm.vue";

export default defineComponent({
    // name: "SettingsChannelsView",
    components: {
        ChannelAddForm,
    },
    setup() {
        const store = useStore();
        return { store };
    },
    methods: {
        updateUsers() {
            this.store.fetchAndUpdateStreamerList();
        },
    },
});
</script>