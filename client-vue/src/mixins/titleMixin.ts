import { Component, ComponentOptions, ComponentOptionsMixin } from "vue"
import { Store } from "vuex";

function getTitle(vm: ComponentOptionsMixin) {
    const { title } = vm.$options
    if (title) {
        return typeof title === 'function'
            ? title.call(vm)
            : title
    }
}

export default {
    created() {
        const title = getTitle(this)
        if (title) {
            document.title = title + " - TwitchAutomator";
        }
    }
}