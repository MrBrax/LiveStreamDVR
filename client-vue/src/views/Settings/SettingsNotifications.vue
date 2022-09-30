<template>
    <section class="section">
        <div class="section-title">
            <h1>{{ $t('pages.notifications') }}</h1>
        </div>
        <div class="section-content">
            <notifications-form />
        </div>
    </section>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import NotificationsForm from "@/components/forms/NotificationsForm.vue";
export default defineComponent({
    // name: "SettingsChannelsView",
    components: {
        NotificationsForm,
    },
});
</script>
        