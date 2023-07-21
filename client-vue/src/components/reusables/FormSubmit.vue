<template>
    <div class="field form-submit">
        <div class="form-submit-buttons">
            <slot />
        </div>
        <div :class="formStatusClass">
            <span class="icon">
                <font-awesome-icon
                    :icon="formStatusIcon"
                    :spin="formStatus == 'LOADING'"
                />
            </span>
            {{ computedText }}
        </div>
    </div>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faCheck, faExclamationTriangle, faFile, faSpinner } from "@fortawesome/free-solid-svg-icons";
import type { FormStatus } from "@/twitchautomator";
import { useI18n } from "vue-i18n";
library.add(faCheck, faExclamationTriangle, faFile, faSpinner);

const props = defineProps<{
    formStatusText: string;
    formStatus: FormStatus;
}>();

const { t } = useI18n();

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

const computedText = computed(() => {
    if (props.formStatus === "LOADING") {
        return t("messages.loading");
    } else {
        return props.formStatusText;
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
        
        // background-color: #eee;
        background-color: rgba(128, 128, 128, 0.1);
        padding: 0.3rem 0.5rem;
        
        margin-left: 0.5em;
        border-radius: 0.3em;
        .icon {
            margin-right: 0.3em;
            vertical-align: -2px;
        }
        &.is-success {
            // background-color: #e6ffed;
            // border-color: #a3f7bf;
            background-color: rgba(0, 255, 85, 0.1);
            // border-color: rgba(0, 255, 85, 0.2);
        }
        &.is-error {
            // background-color: #fff1f0;
            // border-color: #ffccc7;
            background-color: rgba(255, 0, 0, 0.1);
            // border-color: rgba(255, 0, 0, 0.2);
        }
        &.is-loading {
            // background-color: #fffbe6;
            // border-color: #ffe58f;
            background-color: rgba(255, 255, 0, 0.1);
            // color: #dddd00;
            // border-color: rgba(255, 255, 0, 0.2);
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

.form-submit-buttons {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
    &:deep(.button:not(:last-child):not(.is-fullwidth)),
    &:deep(.icon-button:not(:last-child):not(.is-fullwidth)) {
        margin-right: .5rem;
    }
}

</style>