import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";

import "./assets/style.scss";

import { format, toDate, parse, formatDistance } from 'date-fns';
const dateFormat = "yyyy-MM-dd HH:mm:ss.SSSSSS"; // 2020-11-03 02:48:01.000000

const helpers =  {
    methods: {
        formatDate( date : string, fmt = "yyyy-MM-dd HH:mm:ss" ){
            if(!date) return "";
            // console.log("formatDate", date, fmt);
            const o = parse(date, dateFormat, new Date());
            return format(o, fmt);
        },
        humanDuration( duration: number ){
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
            return `${Math.round(bytes)} ${units[pow]}`;
        },
        niceDuration(durationInSeconds : number): string{

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
        twitchDuration(seconds : number): string {
            return this.niceDuration(seconds).replaceAll(" ", "").trim();
            // return trim(str_replace(" ", "", self::getNiceDuration($seconds)));
        },
        formatNumber( num: number, decimals = 0 ){
            return num.toLocaleString('us', {minimumFractionDigits: decimals, maximumFractionDigits: decimals})
        },
        humanDate(date : string){

            const o = parse(date, dateFormat, new Date());
            
            return formatDistance(
                o,
                new Date()
            );
        
        }
    }
};

const app = createApp(App)
    .use(store)
    .use(router)
    .mixin(helpers).mount("#app");

/*
createApp(App)
  .use(store)
  .use(router)
  .mount("#app");
*/