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

<style lang="scss" scoped>
.modal-box {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 9999;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    .modal-box__container {
        width: 100%;
        max-width: 800px;
        max-height: 90vh;
        overflow-y: scroll;
        background: #fff;
        border-radius: 5px;
        padding: 20px;
        cursor: default;
        .modal-box__header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            .modal-box__title {
                font-size: 20px;
                font-weight: bold;
                color: #333;
            }
            .modal-box__close {
                cursor: pointer;
                i {
                    font-size: 20px;
                    color: #333;
                }
            }
        }
        .modal-box__body {
            padding: 20px;
            color: #444;
        }
    }
}
</style>
