<template>
    <div
        v-if="store.cfg('twitchapi.auth_type') == 'user'"
        class="youtube-auth"
    >
        <h3><span class="icon"><font-awesome-icon :icon="['fab', 'twitch']" /></span> Twitch authentication</h3>
        <div class="buttons">
            <button
                class="button is-confirm"
                :disabled="loading"
                type="button"
                @click="doCheckTwitchStatus"
            >
                <span class="icon"><font-awesome-icon icon="sync" /></span>
                <span>{{ t("buttons.checkstatus") }}</span>
            </button>
            <button
                class="button is-confirm"
                title="Authenticate with Twitch using method 1"
                :disabled="loading"
                type="button"
                @click="doAuthenticateTwitchMethod1"
            >
                <span class="icon"><font-awesome-icon icon="sign-in-alt" /></span>
                <span>{{ t("buttons.authmethod1") }}</span>
            </button>
            <button
                class="button is-confirm"
                title="Authenticate with Twitch using method 2"
                :disabled="loading"
                type="button"
                @click="doAuthenticateTwitchMethod2"
            >
                <span class="icon"><font-awesome-icon icon="sign-in-alt" /></span>
                <span>{{ t("buttons.authmethod2") }}</span>
            </button>
            <button
                class="button is-danger"
                :disabled="loading"
                type="button"
                @click="doDestroyTwitch"
            >
                <span class="icon"><font-awesome-icon icon="right-from-bracket" /></span>
                <span>{{ t("buttons.destroy-session") }}</span>
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
                    <strong>Redirect URI:</strong> <CodeBox>{{ store.appUrl }}/api/v0/twitch/callback</CodeBox>
                </li>
            </ul>
        </div>
    </div>
    <div
        v-else
        class="youtube-auth"
    >
        <font-awesome-icon :icon="['fab', 'twitch']" /> Twitch authentication is disabled because you are using app token authentication.
    </div>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import type { ApiResponse, ApiErrorResponse } from "@common/Api/Api";
import { useStore } from "@/store";
import CodeBox from "@/components/reusables/CodeBox.vue";
import { library } from "@fortawesome/fontawesome-svg-core";
import {
    faRightFromBracket,
    faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import {
    faTwitch
} from "@fortawesome/free-brands-svg-icons";
import axios, { AxiosError } from "axios";
import { useI18n } from "vue-i18n";
library.add(faRightFromBracket, faTwitch, faSpinner);

const store = useStore();
const { t } = useI18n();

const status = ref("");
const loading = ref(false);

function doCheckTwitchStatus(): void {
    status.value = "Checking Twitch status...";
    loading.value = true;
    axios.get<ApiResponse>(`/api/v0/twitch/status`).then((response) => {
        const json = response.data;
        if (json.message) status.value = json.message;
        console.log(json);
    }).catch((err: Error | AxiosError) => {
        console.error("twitch check error", err);
        if (axios.isAxiosError<ApiErrorResponse>(err)) {
            if (err.response && err.response.data && err.response.data.message) {
                status.value = err.response.data.message;
            } else {
                status.value = err.message;
            }
        } else {
            status.value = `Error checking Twitch status (${err.message})`;
        }
    }).finally(() => {
        loading.value = false;
    });
}

async function doAuthenticateTwitchMethod1(): Promise<void> {
    const url = `${store.cfg<string>("basepath", "")}/api/v0/twitch/authenticate`;
    const width = 600;
    const height = 600;
    const left = (screen.width / 2) - (width / 2);
    const top = (screen.height / 2) - (height / 2);
    console.debug("twitch auth url", url);
    window.open(url, "_blank", `width=${width},height=${height},top=${top},left=${left}`);
}

async function doAuthenticateTwitchMethod2(): Promise<void> {

    status.value = "Fetching Twitch authentication URL...";
    loading.value = true;

    let res;
    try {
        res = await axios.get<ApiResponse>(`/api/v0/twitch/authenticate?rawurl=true`);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error("twitch auth error", error.response);
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
    console.debug("twitch auth url", url);
    window.open(url, "_blank", `width=${width},height=${height},top=${top},left=${left}`);
}

function doDestroyTwitch(): void {
    status.value = "Destroying Twitch session...";
    loading.value = true;
    axios.get<ApiResponse>(`/api/v0/twitch/destroy`).then((response) => {
        const json = response.data;
        if (json.message) status.value = json.message;
        console.log(json);
    }).catch((err) => {
        console.error("twitch destroy error", err.response);
        if (err.response.data && err.response.data.message) status.value = err.response.data.message;
    }).finally(() => {
        loading.value = false;
    });
}

</script>

<style lang="scss" scoped>
    h3 {
        margin: 0 0 0.5rem 0;
    }
</style>