<template>
    <div class="container">
        <section class="section">
            <div class="section-title">
                <h1>{{ t('pages.about') }}</h1>
            </div>
            <div
                v-if="aboutData && aboutData.bins"
                class="section-content"
            >
                <div class="block">
                    <h3>{{ t('about.installed-utilities') }}</h3>
                    <table class="table is-fullwidth is-striped">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Path</th>
                                <th>License</th>
                                <th>Min. version</th>
                                <th>Version</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for="(bin, id) in aboutData.bins"
                                :key="id"
                            >
                                <td>{{ id }}</td>
                                <td>{{ bin.path }}</td>
                                <td>
                                    <a
                                        :href="licensePath(id)"
                                        target="_blank"
                                    >Open</a>
                                </td>
                                <td>{{ bin.min_version || "?" }}</td>
                                <td>{{ bin.version }}</td>
                                <td
                                    :style="{
                                        color: bin.status == 'ok' ? 'limegreen' : 'red'
                                    }
                                    "
                                >
                                    {{ bin.status }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <p>
                        This app tries to find all the executables using system utilities. This may not work if they're on a custom PATH. Please visit
                        <router-link :to="{ name: 'SettingsConfig' }">
                            settings
                        </router-link> to manually change them.
                    </p>
                </div>

                <!-- quotas -->
                <div
                    v-if="store.quotas"
                    class="block"
                >
                    <h3>Quotas</h3>
                    <ul class="list">
                        <li
                            v-for="(v, k) in store.quotas"
                            :key="k"
                        >
                            {{ k }}
                            <ul class="list">
                                <li
                                    v-for="(v2, k2) in v"
                                    :key="k2"
                                >
                                    {{ k2 }}: {{ formatValue(v2) }}
                                </li>
                            </ul>
                        </li>
                    </ul>
                    <ul
                        v-if="store.websocket_quotas"
                        class="list"
                    >
                        <li
                            v-for="(v, k) in store.websocket_quotas"
                            :key="k"
                        >
                            Websocket {{ v.id }}
                            <ul class="list">
                                <li
                                    v-for="(v2, k2) in v"
                                    :key="k2"
                                >
                                    {{ k2 }}: {{ formatValue(v2) }}
                                </li>
                            </ul>
                        </li>
                    </ul>
                </div>

                <!-- software -->
                <div class="block">
                    <h3>{{ t('about.software') }}</h3>
                    <ul>
                        <li><strong>Python version:</strong> {{ aboutData.bins.python && aboutData.bins.python.version ? aboutData.bins.python.version : "(no output)" }}</li>
                        <li><strong>Python3 version:</strong> {{ aboutData.bins.python3 && aboutData.bins.python3.version ? aboutData.bins.python3.version : "(no output)" }}</li>
                        <li><strong>Node.js version:</strong> {{ aboutData.bins.node && aboutData.bins.node.version ? aboutData.bins.node.version : "(no output)" }}</li>
                        <li><strong>Docker:</strong> {{ aboutData.is_docker ? "Yes" : "No" }}</li>
                        <li><strong>Backend type:</strong> {{ store.serverType || "unknown" }}</li>
                        <li><strong>Backend version:</strong> {{ store.version }}</li>
                        <li><strong>Backend git hash:</strong> {{ store.serverGitHash }}</li>
                        <li><strong>Frontend version:</strong> {{ clientVersion }}</li>
                        <li><strong>Frontend build:</strong> {{ clientMode }}</li>
                        <li><strong>Frontend verbose:</strong> {{ verboseClientVersion }}</li>
                    </ul>
                </div>

                <!-- memory -->
                <div class="block">
                    <h3>{{ t('about.memory') }}</h3>
                    <ul v-if="'memory' in aboutData">
                        <li><strong>Array buffers:</strong> {{ formatBytes(aboutData.memory.arrayBuffers) }}</li>
                        <li><strong>External:</strong> {{ formatBytes(aboutData.memory.external) }}</li>
                        <li><strong>Heap total:</strong> {{ formatBytes(aboutData.memory.heapTotal) }}</li>
                        <li><strong>Heap used:</strong> {{ formatBytes(aboutData.memory.heapUsed) }}</li>
                    </ul>
                    <span
                        v-else
                        class="text-is-error"
                    >
                        {{ t('messages.data-error') }}
                    </span>
                </div>

                <!-- debug -->
                <div class="block">
                    <h3>{{ t('about.debug') }}</h3>
                    <ul>
                        <li v-for="(v, k) in aboutData.debug">
                            <strong>{{ k }}:</strong> {{ formatValue(v) }}
                        </li>
                    </ul>
                </div>

                <div class="block">
                    <h3>{{ t('about.subscriptions') }}</h3>
                    <p class="buttons">
                        <d-button
                            color="success"
                            size="small"
                            icon="sync"
                            :disabled="subscriptionsLoading"
                            @click="fetchSubscriptions"
                        >
                            {{ t("buttons.fetch") }}
                        </d-button>
                        <d-button
                            color="success"
                            size="small"
                            icon="rss"
                            :disabled="subscriptionsLoading"
                            @click="subscribeAll"
                        >
                            {{ t("buttons.subscribe") }}
                        </d-button>
                    </p>
                    <!--<button class="button is-confirm is-small" @click="unsubscribeAll" :disabled="subscriptionsLoading">Unsubscribe</button>-->
                    <LoadingBox v-if="subscriptionsLoading" />
                    <table class="table is-fullwidth is-striped">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Created</th>
                                <th>Username/Type</th>
                                <th>Status</th>
                                <th>Instance match</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for="subscription in subscriptions"
                                :key="subscription.id"
                            >
                                <td>{{ subscription.id }}</td>
                                <td>{{ subscription.created_at }}</td>
                                <td>
                                    {{ subscription.username }}<br>
                                    <small class="is-dark-gray">{{ subscription.type }}</small>
                                </td>
                                <td>{{ subscription.status }}</td>
                                <td>
                                    {{ subscription.instance_match }}<br>
                                    <small class="is-dark-gray">{{ subscription.callback }}</small>
                                </td>
                                <td>
                                    <d-button
                                        color="danger"
                                        size="small"
                                        icon="ban"
                                        :disabled="subscriptionsLoading"
                                        @click="unsubscribe(subscription.id)"
                                    >
                                        {{ t('buttons.unsubscribe') }}
                                    </d-button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- pip update -->
                <div
                    v-if="!aboutData.is_docker"
                    class="block"
                >
                    <h3>Pip update</h3>
                    <CodeBox>pip install --user --upgrade {{ pipKeys }}</CodeBox><br>
                    <br>You might want to install without the --user switch depending on environment.
                </div>
                <div class="block">
                    <!-- links -->
                    <h3>{{ t('about.links') }}</h3>
                    <ul>
                        <li>
                            <a
                                href="https://www.python.org/downloads/"
                                target="_blank"
                                rel="noreferrer"
                            >Python</a>
                        </li>
                        <li>
                            <a
                                href="https://www.gyan.dev/ffmpeg/builds/"
                                target="_blank"
                                rel="noreferrer"
                            >FFmpeg builds for Windows</a> (rip zeranoe)
                        </li>
                        <li>
                            <a
                                href="https://mediaarea.net/en/MediaInfo"
                                target="_blank"
                                rel="noreferrer"
                            >MediaInfo</a>
                        </li>
                        <li>
                            <a
                                href="https://github.com/lay295/TwitchDownloader"
                                target="_blank"
                                rel="noreferrer"
                            >TwitchDownloader</a>
                        </li>
                    </ul>
                </div>
                <div class="block">
                    <h3>Licenses</h3>
                    <a
                        :href="licenseUrl"
                        target="_blank"
                    >Show licenses in a new window</a>
                </div>
            </div>
            <div
                v-else
                class="section-content"
            >
                <LoadingBox />
            </div>
        </section>
    </div>
</template>

<script lang="ts" setup>
import { useStore } from "@/store";
import type { ApiSubscription } from "@common/Api/Client";
import type { AboutData } from "@common/Api/About";
import { ref, computed, onMounted } from "vue";
import type { ApiResponse, ApiAboutResponse, IApiResponse } from "@common/Api/Api";
import CodeBox from "@/components/reusables/CodeBox.vue";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faRss, faBan, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { useI18n } from "vue-i18n";
import axios from "axios";
import { formatBytes } from "@/mixins/newhelpers";
import { formatNumber } from "@/mixins/newhelpers";
library.add(faRss, faBan, faSpinner);


const store = useStore();
const { t } = useI18n();

const aboutData = ref<AboutData>();
const subscriptions = ref<ApiSubscription[]>([]);
const subscriptionsLoading = ref<boolean>(false);

const clientVersion = computed((): string => {
    return import.meta.env.VITE_APP_VERSION; // injected
});

const clientMode = computed((): string => {
    return import.meta.env.MODE; // injected
});

const verboseClientVersion = computed((): string => {
    return `${import.meta.env.VITE_APP_VERSION} (${import.meta.env.VITE_APP_BUILDDATE} / ${import.meta.env.VITE_APP_GIT_HASH})`; // injected
});

const pipKeys = computed((): string => {
    if (!aboutData.value) {
        return "";
    }
    return Object.keys(aboutData.value.pip).join(" ");
});

function formatValue(value: any): string {
    console.debug( "formatValue", value, typeof value);
    if (typeof value == "number") {
        return formatNumber(value);
    }
    if (typeof value == "object") {
        return JSON.stringify(value);
    }
    return value;
}

function licensePath(id: string | number): string {
    // return this.store.cfg("basepath") + "/LICENSES.txt#" + id;
    return new URL("/api/v0/about/license?package_name=" + id, import.meta.url).href;
}

const licenseUrl = computed((): string => {
    // return this.store.cfg("basepath") + "/LICENSES.txt";
    return new URL("../../LICENSES.txt", import.meta.url).href;
});

onMounted(() => {
    fetchData();
});

function fetchData() {
    aboutData.value = undefined;

    axios
        .get<ApiAboutResponse>(`/api/v0/about`)
        .then((response) => {
            const json = response.data;
            const about = json.data;
            console.debug("aboutData", about);
            aboutData.value = about;
        })
        .catch((err) => {
            console.error("about error", err.response);
        });

    /*
    fetch(`api/v0/about`)
    .then((response) => response.json())
    .then((json) => {
        const about = json.data;
        console.log("aboutData", about);
        aboutData.value = about;
    });
    */
}

function fetchSubscriptions() {
    subscriptionsLoading.value = true;
    axios
        .get<IApiResponse<{ channels: ApiSubscription[] }>>(`/api/v0/subscriptions`)
        .then((response) => {
            const json = response.data;
            console.log("subscriptions", json);
            subscriptions.value = json.data.channels;
            subscriptionsLoading.value = false;
            // TODO: handle when there are 0 subscriptions
        })
        .catch((err) => {
            console.error("fetchSubscriptions error", err.response);
            subscriptionsLoading.value = false;
        });
}

function unsubscribe(id: string) {
    subscriptionsLoading.value = true;
    axios
        .delete<ApiResponse>(`/api/v0/subscriptions/${id}`)
        .then((response) => {
            const json = response.data;
            console.debug("unsubscribe", json);
            subscriptionsLoading.value = false;
            if (json.status == "OK") {
                // fetchSubscriptions();
                subscriptions.value = subscriptions.value.filter((sub) => sub.id != id);
            }
        })
        .catch((err) => {
            console.error("about error", err.response);
        });
}

function subscribeAll() {
    subscriptionsLoading.value = true;
    axios
        .post<ApiResponse>(`/api/v0/subscriptions`)
        .then((response) => {
            const json = response.data;
            console.debug("subscribeAll", json);
            subscriptionsLoading.value = false;
            fetchSubscriptions();
        })
        .catch((err) => {
            console.error("about error", err.response);
        });
}

/*
unsubscribeAll() {
    subscriptionsLoading.value = true;
    axios
        .delete(`/api/v0/subscriptions`)
        .then((response) => {
            const json = response.data;
            console.debug("unsubscribeAll", json);
            subscriptionsLoading.value = false;
            this.fetchSubscriptions();
        })
        .catch((err) => {
            console.error("about error", err.response);
        });
},
*/

</script>
