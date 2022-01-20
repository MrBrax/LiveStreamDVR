import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";
import axios from "axios";
import VueAxios from "vue-axios";
import titleMixin from "./mixins/titleMixin";
import helpers from "./mixins/helpers";
import "./registerServiceWorker";

// font-awesome
// import { library } from '@fortawesome/fontawesome-svg-core';
// import { fas } from '@fortawesome/free-solid-svg-icons';
// import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
// import { faPlay } from '@fortawesome/free-solid-svg-icons'
// library.add(faGithub, faPlay);

import "./assets/style.scss";

if (process.env.BASE_URL !== undefined) {
    axios.defaults.baseURL = process.env.BASE_URL;
}

const app = createApp(App).use(store).use(router).use(VueAxios, axios).component("fa", FontAwesomeIcon).mixin(titleMixin).mixin(helpers).mount("#app");

/*
createApp(App)
  .use(store)
  .use(router)
  .mount("#app");
*/
