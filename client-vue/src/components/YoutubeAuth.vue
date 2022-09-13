<template>
    <div class="youtube-auth">
        <h3><span class="icon"><fa :icon="['fab', 'youtube']" /></span> YouTube authentication</h3>
        <div class="youtube-help">
            Follow the guide here and set up the API keys in the config tab:
            <a href="https://developers.google.com/youtube/v3/getting-started" target="_blank" rel="noreferrer">
                https://developers.google.com/youtube/v3/getting-started
            </a>
        </div>
        <div class="buttons">
            <button class="button is-confirm" @click="doCheckYouTubeStatus">
                <span class="icon"><fa icon="sync" /></span>
                <span>{{ $t("buttons.checkstatus") }}</span>
            </button>
            <button class="icon-button" @click="doAuthenticateYouTube" style="padding-top: 2px">
                <img src="../assets/google/btn_google_signin_dark_normal_web.png" height="36" />
            </button>
            <button class="button is-danger" @click="doDestroyYouTube">
                <span class="icon"><fa icon="right-from-bracket" /></span>
                <span>{{ $t("buttons.destroy-session") }}</span>
            </button>
        </div>
        <div class="youtube-status" v-if="status">{{ status }}</div>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref } from "vue";
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
        doAuthenticateYouTube() {
            const url = `${this.store.cfg<string>("basepath", "")}/api/v0/youtube/authenticate`;
            window.open(url, "_blank");
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

