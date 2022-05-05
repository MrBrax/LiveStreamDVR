<template>
    <transition name="modal-transition">
        <div class="modal-box" v-if="show" @click.self="show = false">
            <div class="modal-box__container">
                <div class="modal-box__header">
                    <div class="modal-box__title">
                        {{ title }}
                    </div>
                    <div class="modal-box__close" @click="show = false">
                        <fa icon="times" />
                    </div>
                </div>
                <div class="modal-box__body">
                    <slot></slot>
                </div>
            </div>
        </div>
    </transition>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faTimes } from "@fortawesome/free-solid-svg-icons";
library.add(faTimes);

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
