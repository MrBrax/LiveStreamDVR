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
            /**
             * @todo: make this reactive, how?
             */
            if (store.isAnyoneLive) {
                document.title = `[${store.channelsOnline}] ${title} - ${store.app_name}`;
            } else{
                document.title = `${title} - ${store.app_name}`;
            }
        }
    },
};
