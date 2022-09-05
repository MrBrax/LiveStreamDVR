<template>
    <div class="youtube-auth">
        <h3><span class="icon"><fa icon="key" /></span> YouTube authentication</h3>
        <div class="buttons">
            <button class="button is-confirm" @click="doCheckYouTubeStatus">
                <span class="icon"><fa icon="sync" /></span>
                <span>{{ $t("buttons.checkstatus") }}</span>
            </button>
            <button class="button is-confirm" @click="doAuthenticateYouTube">
                <span class="icon"><fa icon="key" /></span>
                <span>{{ $t("buttons.authenticate") }}</span>
            </button>
            <button class="button is-danger" @click="doDestroyYouTube">
                <span class="icon"><fa icon="right-from-bracket" /></span>
                <span>{{ $t("buttons.destroy-session") }}</span>
            </button>
        </div>
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
library.add(faRightFromBracket);

export default defineComponent({
    name: "YoutubeAuth",
    setup() {
        const store = useStore();
        return {
            store,
        };
    },
    methods: {
        doCheckYouTubeStatus() {
            this.$http.get(`/api/v0/youtube/status`).then((response) => {
                const json: ApiResponse = response.data;
                if (json.message) alert(json.message);
                console.log(json);
            }).catch((err) => {
                console.error("youtube check error", err.response);
                if (err.response.data && err.response.data.message) alert(err.response.data.message);
            });
        },
        doAuthenticateYouTube() {
            const url = `${this.store.cfg<string>("basepath", "")}/api/v0/youtube/authenticate`;
            window.open(url, "_blank");
        },
        doDestroyYouTube() {
            this.$http.get(`/api/v0/youtube/destroy`).then((response) => {
                const json: ApiResponse = response.data;
                if (json.message) alert(json.message);
                console.log(json);
            }).catch((err) => {
                console.error("youtube destroy error", err.response);
                if (err.response.data && err.response.data.message) alert(err.response.data.message);
            });
        },
    }
});

</script>

