import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import axios from "axios";
import VueAxios from "vue-axios";
import titleMixin from "./mixins/titleMixin";
import helpers from "./mixins/helpers";
import { createPinia } from "pinia";
import { createI18n } from "vue-i18n";
import messages_en from "./translations/en.json";
import messages_sv from "./translations/sv.json";
import messages_ko from "./translations/ko.json";
import messages_de from "./translations/de.json";
// import "./registerServiceWorker";

// font-awesome
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";

import "./assets/style.scss";


if (import.meta.env.BASE_URL !== undefined) {
    axios.defaults.baseURL = import.meta.env.BASE_URL;
}

const i18n = createI18n({
    locale: "en",
    fallbackLocale: "en",
    messages: {
        en: messages_en,
        sv: messages_sv,
        ko: messages_ko,
        de: messages_de
    },
});

createApp(App)
    .use(router)
    .use(createPinia())
    .use(VueAxios, axios)
    .use(i18n)
    .component("fa", FontAwesomeIcon)
    .mixin(titleMixin)
    .mixin(helpers)
    .mount("#app");
