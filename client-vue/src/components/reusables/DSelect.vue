<template>
    <select class="d-select" v-model="selected">
        <template v-if="!isOptions(options)">
            <option v-for="option in options">{{ option }}</option>
        </template>
        <template v-else>
            <option v-for="(option, key) in options" :value="option.value" :disabled="option.disabled">
                <span v-if="option.icon" class="icon" :title="option.icon">
                    <fa :icon="option.icon.split(' ')" />
                </span>
                {{ option.label }}
            </option>
        </template>
    </select>
</template>

<style lang="scss" scoped>
.d-select {
    option {
        &:disabled {
            font-style: italic;
        }
        &[disabled] {
            font-style: italic;
        }
    }
}
</style>

<script lang="ts" setup>
import { ref, watch, computed, onMounted } from "vue";

export type Option = {
    value: string;
    label: string;
    icon?: string;
    disabled?: boolean;
};

const emit = defineEmits<{
    ( e: "update:modelValue", value: string ): void;
}>();

const props = defineProps<{
    modelValue: string;
    options: string[] | Option[];
}>();

const selected = ref(props.modelValue);

onMounted(() => {
    if (props.modelValue) {
        selected.value = props.modelValue;
    }
});

const isObject = computed(() => {
    return typeof props.options === "object";
});

function isOption( option: string | Option ): option is Option {
    return (option as Option).value !== undefined;
}

function isOptions( options: string[] | Option[] ): options is Option[] {
    if (options === undefined || options.length === 0) {
        return false;
    }
    return (options as Option[])[0].value !== undefined;
}

watch(selected, (value) => {
    emit("update:modelValue", value);
});

watch(() => props.modelValue, (value) => {
    selected.value = value;
});

</script>