<template>
    <span v-if="value" class="boolean has-text-success">
        <span class="icon"><fa :icon="['fas', 'check']" /></span>
            <span>{{ t("boolean.yes") }}</span>
    </span>
    <span v-else class="boolean has-text-danger">
        <span class="icon"><fa :icon="['fas', 'times']" /></span>
            <span>{{ t("boolean.no") }}</span>
    </span>
</template>

<style lang="scss" scoped>
.boolean {
    display: inline-flex;
    align-items: center;
    .icon {
        vertical-align: middle;
    }
}
</style>

<script lang="ts" setup>
import { defineProps } from "vue";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faCheck, faTimes } from "@fortawesome/free-solid-svg-icons";
import { useI18n } from "vue-i18n";
library.add(faCheck, faTimes);

const { t } = useI18n();

const props = defineProps<{
    value: boolean;
}>();

</script>