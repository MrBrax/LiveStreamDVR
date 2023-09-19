<template>
    <div class="zod-error-formatter">
        <ul>
            <li v-for="error in props.error.errors" :key="error.path.toString()">
                {{ error }}
            </li>
        </ul>
        <ul>
            <li v-for="issue in props.error.issues" :key="issue.path.toString()">
                {{ issue }} 
            </li>
        </ul>
    </div>
</template>

<script lang="ts" setup>
import type { z } from "zod";

const props = defineProps<{
    error: z.ZodError;
}>();

</script>