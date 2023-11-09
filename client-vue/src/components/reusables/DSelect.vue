<template>
    <div class="select is-small">
        <select class="d-select" v-model="selected">
            <template v-if="!isObject">
                <option v-for="option in options">{{ option }}</option>
            </template>
            <template v-else>
                <option v-for="(option, key) in options" :value="key">{{ option }}</option>
            </template>
        </select>
    </div>
</template>

<script lang="ts" setup>
import { ref, watch, computed, onMounted } from "vue";

const emit = defineEmits<{
    ( e: "update:modelValue", value: string ): void;
}>();

const props = defineProps<{
    modelValue: string;
    options: string[] | Record<string, string>;
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

watch(selected, (value) => {
    emit("update:modelValue", value);
});

watch(() => props.modelValue, (value) => {
    selected.value = value;
});

</script>