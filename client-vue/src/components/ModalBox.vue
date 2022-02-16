<template>
    <div class="modal-box" v-if="show" @click.self="show = false">
        <div class="modal-box__container">
            <div class="modal-box__header">
                <div class="modal-box__title">
                    {{ title }}
                </div>
                <div class="modal-box__close" @click="show = false">
                    <i class="fas fa-times"></i>
                </div>
            </div>
            <div class="modal-box__body">
                <slot></slot>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
export default defineComponent({
    emits: ["close"],
    data() {
        return {
            show: false,
        };
    },
    props: {
        title: {
            type: String,
            default: "Modal",
        },
        // show: {
        //     type: Boolean,
        //     default: false,
        // },
    },
    methods: {
        close() {
            this.$emit("close");
        },
    },
});
</script>
