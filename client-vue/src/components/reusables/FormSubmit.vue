<template>
    <div class="field form-submit">
        <slot />
        <div :class="formStatusClass">
            <span class="icon">
                <font-awesome-icon
                    :icon="formStatusIcon"
                    :spin="formStatus == 'LOADING'"
                />
            </span>
            {{ formStatusText }}
        </div>
    </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { library } from "@fortawesome/fontawesome-svg-core";
import { faCheck, faExclamationTriangle, faFile, faSpinner } from "@fortawesome/free-solid-svg-icons";
import type { FormStatus } from '@/twitchautomator';
library.add(faCheck, faExclamationTriangle, faFile, faSpinner);

const props = defineProps<{
    formStatusText: string;
    formStatus: FormStatus;
}>();

const formStatusClass = computed(() => {
    return {
        "form-status": true,
        "is-success": props.formStatus === "OK",
        "is-error": props.formStatus === "ERROR",
        "is-loading": props.formStatus === "LOADING",
    };
});

const formStatusIcon = computed(() => {
    if (props.formStatus === "OK") {
        return "check";
    } else if (props.formStatus === "ERROR") {
        return "exclamation-triangle";
    } else if (props.formStatus === "LOADING") {
        return "spinner";
    } else {
        return "file";
    }
});

</script>

<style lang="scss" scoped>
.form-submit {
    display: flex;
    align-items: center;
    // justify-content: space-between;
    justify-content: flex-start;
    align-items: stretch;
    align-content: stretch;
    .form-status {
        flex-grow: 1;
        display: flex;
        align-items: center;
        
        background-color: #eee;
        padding: 0.3rem 0.5rem;
        
        margin-left: 0.5em;
        border-radius: 0.3em;
        .icon {
            margin-right: 0.3em;
        }
        &.is-success {
            background-color: #e6ffed;
            border-color: #a3f7bf;
        }
        &.is-error {
            background-color: #fff1f0;
            border-color: #ffccc7;
        }
        &.is-loading {
            background-color: #fffbe6;
            border-color: #ffe58f;
        }
    }
    .control {
        button {
            &:not(:last-child) {
                margin-right: 0.5em;
            }
        }
    }
}


</style>