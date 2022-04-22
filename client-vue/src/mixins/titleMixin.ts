import { ComponentOptionsMixin } from "vue";
import { useStore } from "../store";

function getTitle(vm: ComponentOptionsMixin) {
    const { title } = vm.$options;
    if (title) {
        return typeof title === "function" ? title.call(vm) : title;
    }
}

export default {
    created() {
        const title = getTitle(this);
        const store = useStore();
        if (title) {
            document.title = `${title} - ${store.app_name}`;
        }
    },
};
