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
                :disabled="loading"
                @click="doCheckYouTubeStatus"
            >
                <span class="icon"><fa icon="sync" /></span>
                <span>{{ $t("buttons.checkstatus") }}</span>
            </button>
            <button
                class="icon-button"
                style="padding-top: 2px"
                title="Authenticate with YouTube using method 1"
                :disabled="loading"
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
                :disabled="loading"
                @click="doAuthenticateYouTubeMethod2"
            >
                <img
                    src="../assets/google/btn_google_signin_light_normal_web.png"
                    height="36"
                >
            </button>
            <button
                class="button is-danger"
                :disabled="loading"
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
            <span
                v-if="loading"
                class="icon"
            >
                <fa
                    icon="spinner"
                    spin
                />
            </span>
            {{ status }}
        </div>
        <hr>
        <div class="youtube-help">
            <h3>Suggested configuration:</h3>
            <ul class="list less-padding">
                <li>
                    <strong>Authorized JavaScript origins:</strong> {{ store.cfg("app_url") }}
                </li>
                <li>
                    <strong>Redirect URI:</strong> {{ store.cfg("app_url") }}/api/v0/youtube/callback
                </li>
            </ul>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { ApiResponse } from "@common/Api/Api";
import { useStore } from "@/store";
import { library } from "@fortawesome/fontawesome-svg-core";
import {
    faRightFromBracket,
    faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import {
    faYoutube
} from "@fortawesome/free-brands-svg-icons";
import axios from "axios";
library.add(faRightFromBracket, faYoutube, faSpinner);

const store = useStore();
        

const status = ref("");
const loading = ref(false);
    
function doCheckYouTubeStatus(): void {
    status.value = "Checking YouTube status...";
    loading.value = true;
    axios.get(`/api/v0/youtube/status`).then((response) => {
        const json: ApiResponse = response.data;
        if (json.message) status.value = json.message;
        console.log(json);
    }).catch((err) => {
        console.error("youtube check error", err.response);
        if (err.response.data && err.response.data.message) status.value = err.response.data.message;
    }).finally(() => {
        loading.value = false;
    });
}

async function doAuthenticateYouTubeMethod1(): Promise<void> {
    const url = `${store.cfg<string>("basepath", "")}/api/v0/youtube/authenticate`;
    const width = 600;
    const height = 600;
    const left = (screen.width / 2) - (width / 2);
    const top = (screen.height / 2) - (height / 2);
    console.debug("youtube auth url", url);
    window.open(url, "_blank", `width=${width},height=${height},top=${top},left=${left}`);
}

async function doAuthenticateYouTubeMethod2(): Promise<void> {

    status.value = "Fetching YouTube authentication URL...";
    loading.value = true;
    
    let res;
    try {
        res = await axios.get(`/api/v0/youtube/authenticate?rawurl=true`);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error("youtube auth error", error.response);
            if (error.response && error.response.data && error.response.data.message) status.value = error.response.data.message;
        }
        loading.value = false;
        return;                    
    }
    loading.value = false;
    const url = res.data.data;
    const width = 600;
    const height = 600;
    const left = (screen.width / 2) - (width / 2);
    const top = (screen.height / 2) - (height / 2);
    console.debug("youtube auth url", url);
    window.open(url, "_blank", `width=${width},height=${height},top=${top},left=${left}`);
}

function doDestroyYouTube(): void {
    status.value = "Destroying YouTube session...";
    loading.value = true;
    axios.get(`/api/v0/youtube/destroy`).then((response) => {
        const json: ApiResponse = response.data;
        if (json.message) status.value = json.message;
        console.log(json);
    }).catch((err) => {
        console.error("youtube destroy error", err.response);
        if (err.response.data && err.response.data.message) status.value = err.response.data.message;
    }).finally(() => {
        loading.value = false;
    });
}

</script>

<style lang="scss" scoped>
    h3 {
        margin: 0;
    }
</style>