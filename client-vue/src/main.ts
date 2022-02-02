import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import axios from "axios";
import VueAxios from "vue-axios";
import titleMixin from "./mixins/titleMixin";
import helpers from "./mixins/helpers";
import { createPinia } from "pinia";
import "./registerServiceWorker";

// font-awesome
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";

import "./assets/style.scss";

if (process.env.BASE_URL !== undefined) {
    axios.defaults.baseURL = process.env.BASE_URL;
}

createApp(App).use(router).use(createPinia()).use(VueAxios, axios).component("fa", FontAwesomeIcon).mixin(titleMixin).mixin(helpers).mount("#app");
