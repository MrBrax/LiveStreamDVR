import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";
import axios from "axios";
import VueAxios from "vue-axios";
import titleMixin from "./mixins/titleMixin";

// font-awesome
import { library } from '@fortawesome/fontawesome-svg-core'
import { fas } from '@fortawesome/free-solid-svg-icons'
import { faGithub } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
library.add(fas, faGithub);

import "./assets/style.scss";

import { format, parse, formatDistance, parseJSON } from 'date-fns';
const dateFormat = "yyyy-MM-dd HH:mm:ss.SSSSSS"; // 2020-11-03 02:48:01.000000

const helpers = {
    methods: {
        formatDate(date: string, fmt = "yyyy-MM-dd HH:mm:ss") {
            if (!date) return "";
            // console.log("formatDate", date, fmt);
            // const o = parse(date, dateFormat, new Date());
            const o = parseJSON(date);
            return format(o, fmt);
        },
        formatTimestamp(timestamp: number, fmt = "yyyy-MM-dd HH:mm:ss") {
            const o = new Date(timestamp * 1000);
            return format(o, fmt);
        },
        humanDuration(duration: number) {
            const hours = Math.floor(duration / 3600);
            const minutes = Math.floor((duration / 60) % 60);
            const seconds = duration % 60;
            return hours.toString().padStart(2, "0") + ":" + minutes.toString().padStart(2, "0") + ":" + seconds.toString().padStart(2, "0");
        },
        formatBytes(bytes: number, precision = 2) {
            const units = ['B', 'KB', 'MB', 'GB', 'TB'];
            bytes = Math.max(bytes, 0);
            let pow = Math.floor((bytes ? Math.log(bytes) : 0) / Math.log(1024));
            pow = Math.min(pow, units.length - 1);
            // Uncomment one of the following alternatives
            bytes /= Math.pow(1024, pow);
            // bytes /= (1 << (10 * pow));
            // const finalAmount = Math.round(bytes)
            const finalAmount = bytes.toFixed(precision);
            return `${finalAmount} ${units[pow]}`;
        },
        niceDuration(durationInSeconds: number): string {

            let duration = '';
            const days = Math.floor(durationInSeconds / 86400);
            durationInSeconds -= days * 86400;
            const hours = Math.floor(durationInSeconds / 3600);
            durationInSeconds -= hours * 3600;
            const minutes = Math.floor(durationInSeconds / 60);
            const seconds = durationInSeconds - minutes * 60;

            if (days > 0) {
                duration += Math.round(days) + 'd';
            }
            if (hours > 0) {
                duration += ' ' + Math.round(hours) + 'h';
            }
            if (minutes > 0) {
                duration += ' ' + Math.round(minutes) + 'm';
            }
            if (seconds > 0) {
                duration += ' ' + Math.round(seconds) + 's';
            }
            return duration.trim();
        },
        twitchDuration(seconds: number): string {
            return this.niceDuration(seconds).replaceAll(" ", "").trim();
            // return trim(str_replace(" ", "", self::getNiceDuration($seconds)));
        },
        formatNumber(num: number, decimals = 0) {
            return num.toLocaleString('us', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        },
        humanDate(date: string) {
            // const o = parse(date, dateFormat, new Date());
            const o = parseJSON(date);
            return formatDistance(
                o,
                new Date()
            );
        },
        sortObject(game: Record<string, any>, value: string) {
            return Object.entries(game).sort((a, b) => {
                return (a as any)[value] - (b as any)[value];
            });
        }
    },
    data() {
        return {
            twitchQuality: ['best', '1080p60', '1080p', '720p60', '720p', '480p', '360p', '160p', '140p', 'worst']
        };
    }
};

if( process.env.BASE_URL !== undefined){
    axios.defaults.baseURL = process.env.BASE_URL;
}

const app = createApp(App)
    .use(store)
    .use(router)
    .use(VueAxios, axios)
    .component("fa", FontAwesomeIcon)
    .mixin(titleMixin)
    .mixin(helpers).mount("#app");

/*
createApp(App)
  .use(store)
  .use(router)
  .mount("#app");
*/