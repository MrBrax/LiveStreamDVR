<template>
    <div class="youtube-auth">
        <h3><span class="icon"><fa :icon="['fab', 'youtube']" /></span> YouTube authentication</h3>
        <div class="youtube-help">
            Follow the guide here and set up the API keys in the config tab:
            <a
                href="https://developers.google.com/youtube/v3/getting-started"
                target="_blank"
                rel="noreferrer"
            >
                https://developers.google.com/youtube/v3/getting-started
            </a>
        </div>
        <div class="buttons">
            <button
                class="button is-confirm"
                @click="doCheckYouTubeStatus"
            >
                <span class="icon"><fa icon="sync" /></span>
                <span>{{ $t("buttons.checkstatus") }}</span>
            </button>
            <button
                class="icon-button"
                style="padding-top: 2px"
                title="Authenticate with YouTube using method 1"
                @click="doAuthenticateYouTubeMethod1"
            >
                <img
                    src="../assets/google/btn_google_signin_dark_normal_web.png"
                    height="36"
                >
            </button>
            <button
                class="icon-button"
                style="padding-top: 2px"
                title="Authenticate with YouTube using method 2"
                @click="doAuthenticateYouTubeMethod2"
            >
                <img
                    src="../assets/google/btn_google_signin_light_normal_web.png"
                    height="36"
                >
            </button>
            <button
                class="button is-danger"
                @click="doDestroyYouTube"
            >
                <span class="icon"><fa icon="right-from-bracket" /></span>
                <span>{{ $t("buttons.destroy-session") }}</span>
            </button>
        </div>
        <div
            v-if="status"
            class="youtube-status"
        >
            {{ status }}
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { ApiResponse } from "@common/Api/Api";
import { useStore } from "@/store";
import { library } from "@fortawesome/fontawesome-svg-core";
import {
    faRightFromBracket
} from "@fortawesome/free-solid-svg-icons";
import {
    faYoutube
} from "@fortawesome/free-brands-svg-icons";
library.add(faRightFromBracket, faYoutube);

export default defineComponent({
    name: "YoutubeAuth",
    setup() {
        const store = useStore();
        return {
            store,
        };
    },
    data() {
        return {
            status: "",
        };
    },
    methods: {
        doCheckYouTubeStatus() {
            this.status = "";
            this.$http.get(`/api/v0/youtube/status`).then((response) => {
                const json: ApiResponse = response.data;
                if (json.message) this.status = json.message;
                console.log(json);
            }).catch((err) => {
                console.error("youtube check error", err.response);
                if (err.response.data && err.response.data.message) this.status = err.response.data.message;
            });
        },
        async doAuthenticateYouTubeMethod1() {
            const url = `${this.store.cfg<string>("basepath", "")}/api/v0/youtube/authenticate`;
            const width = 600;
            const height = 600;
            const left = (screen.width / 2) - (width / 2);
            const top = (screen.height / 2) - (height / 2);
            console.debug("youtube auth url", url);
            window.open(url, "_blank", `width=${width},height=${height},top=${top},left=${left}`);
        },
        async doAuthenticateYouTubeMethod2() {
            
            let res;
            try {
                res = await this.$http.get(`/api/v0/youtube/authenticate?rawurl=true`);
            } catch (error) {
                if (this.$http.isAxiosError(error)) {
                    console.error("youtube auth error", error.response);
                    if (error.response && error.response.data && error.response.data.message) this.status = error.response.data.message;
                }
                return;                    
            }
            const url = res.data.data;
            const width = 600;
            const height = 600;
            const left = (screen.width / 2) - (width / 2);
            const top = (screen.height / 2) - (height / 2);
            console.debug("youtube auth url", url);
            window.open(url, "_blank", `width=${width},height=${height},top=${top},left=${left}`);
        },
        doDestroyYouTube() {
            this.status = "";
            this.$http.get(`/api/v0/youtube/destroy`).then((response) => {
                const json: ApiResponse = response.data;
                if (json.message) this.status = json.message;
                console.log(json);
            }).catch((err) => {
                console.error("youtube destroy error", err.response);
                if (err.response.data && err.response.data.message) this.status = err.response.data.message;
            });
        },
    }
});

</script>

