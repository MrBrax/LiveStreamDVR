import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import axios from "axios";
import VueAxios from "vue-axios";
import titleMixin from "./mixins/titleMixin";
import helpers from "./mixins/helpers";
import { createPinia } from "pinia";
import websocket from "./plugins/websocket";
// import "./registerServiceWorker";

// font-awesome
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";

import "./assets/style.scss";

if (import.meta.env.BASE_URL !== undefined) {
    axios.defaults.baseURL = import.meta.env.BASE_URL;
}

createApp(App).use(router).use(createPinia()).use(VueAxios, axios).use(websocket).component("fa", FontAwesomeIcon).mixin(titleMixin).mixin(helpers).mount("#app");
