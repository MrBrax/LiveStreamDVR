import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import axios from "axios";
import { createPinia } from "pinia";
import VueObserveVisibility from "vue-observe-visibility";
// import "./registerServiceWorker";

// font-awesome
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";

import "./assets/style.scss";
import i18n from "./plugins/i18n";

import LoadingBox from "@/components/reusables/LoadingBox.vue";
import DButton from "@/components/reusables/DButton.vue";

if (import.meta.env.BASE_URL !== undefined) {
    axios.defaults.baseURL = import.meta.env.BASE_URL;
}

createApp(App)
    .use(router)
    .use(createPinia())
    .use(i18n)
    .use(VueObserveVisibility)
    .component("fa", FontAwesomeIcon)
    .component("font-awesome-icon", FontAwesomeIcon)
    .component("LoadingBox", LoadingBox)
    .component("DButton", DButton)
    // .mixin(titleMixin)
    // .mixin(helpers)
    .mount("#app");
