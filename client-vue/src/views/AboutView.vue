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
                    <table class="table">
                        <tr>
                            <th>Name</th>
                            <th>Path</th>
                            <th>Version</th>
                            <th>Status</th>
                        </tr>
                        <tr v-if="aboutData.bins.ffmpeg">
                            <td>FFmpeg</td>
                            <td>{{ aboutData.bins.ffmpeg.path }}</td>
                            <td>{{ aboutData.bins.ffmpeg.version }}</td>
                            <td>{{ aboutData.bins.ffmpeg.status }}</td>
                        </tr>
                        <tr v-if="aboutData.bins.mediainfo">
                            <td>Mediainfo</td>
                            <td>{{ aboutData.bins.mediainfo.path }}</td>
                            <td>{{ aboutData.bins.mediainfo.version }}</td>
                            <td>{{ aboutData.bins.mediainfo.status }}</td>
                        </tr>
                        <tr v-if="aboutData.bins.tcd">
                            <td>Twitch chat downloader</td>
                            <td>{{ aboutData.bins.tcd.path }}</td>
                            <td>{{ aboutData.bins.tcd.version }}</td>
                            <td>{{ aboutData.bins.tcd.status }}</td>
                        </tr>
                        <tr v-if="aboutData.bins.streamlink">
                            <td>Streamlink</td>
                            <td>{{ aboutData.bins.streamlink.path }}</td>
                            <td>{{ aboutData.bins.streamlink.version }}</td>
                            <td>{{ aboutData.bins.streamlink.status }}</td>
                        </tr>
                        <tr v-if="aboutData.bins.youtubedl">
                            <td>yt-dlp</td>
                            <td>{{ aboutData.bins.youtubedl.path }}</td>
                            <td>{{ aboutData.bins.youtubedl.version }}</td>
                            <td>{{ aboutData.bins.youtubedl.status }}</td>
                        </tr>
                        <tr v-if="aboutData.bins.pipenv">
                            <td>Pipenv</td>
                            <td>{{ aboutData.bins.pipenv.path }}</td>
                            <td>{{ aboutData.bins.pipenv.version }}</td>
                            <td v-html="aboutData.bins.pipenv.status" />
                        </tr>
                        <tr v-if="aboutData.bins.twitchdownloader">
                            <td>TwitchDownloaderCLI</td>
                            <td>{{ aboutData.bins.twitchdownloader.path }}</td>
                            <td>{{ aboutData.bins.twitchdownloader.version }}</td>
                            <td v-html="aboutData.bins.twitchdownloader.status" />
                        </tr>
                    </table>
                    <p>
                        This app tries to find all the executables using system utilities. This may not work if they're on a custom PATH. Please visit
                        <router-link :to="{ name: 'SettingsConfig' }">
                            settings
                        </router-link> to manually change them.
                    </p>
                </div>

                <!-- software -->
                <div class="block">
                    <h3>{{ t('about.software') }}</h3>
                    <ul>
                        <li><strong>Python version:</strong> {{ aboutData.bins.python.version ? aboutData.bins.python.version : "(no output)" }}</li>
                        <li><strong>Python3 version:</strong> {{ aboutData.bins.python3.version ? aboutData.bins.python3.version : "(no output)" }}</li>
                        <li><strong>Node.js version:</strong> {{ aboutData.bins.node.version ? aboutData.bins.node.version : "(no output)" }}</li>
                        <li><strong>Docker:</strong> {{ aboutData.is_docker ? "Yes" : "No" }}</li>
                        <li><strong>Backend type:</strong> {{ store.serverType || "unknown" }}</li>
                        <li><strong>Backend version:</strong> {{ store.version }}</li>
                        <li><strong>Backend git hash:</strong> {{ store.serverGitHash }}</li>
                        <li><strong>Frontend version:</strong> {{ clientVersion }}</li>
                        <li><strong>Frontend build:</strong> {{ clientMode }}</li>
                        <li><strong>Frontend verbose:</strong> {{ verboseClientVersion }}</li>
                    </ul>
                </div>

                <div class="block">
                    <h3>{{ t('about.subscriptions') }}</h3>
                    <p class="buttons">
                        <button
                            class="button is-confirm is-small"
                            :disabled="subscriptionsLoading"
                            @click="fetchSubscriptions"
                        >
                            <span class="icon"><font-awesome-icon icon="sync" /></span>
                            <span>{{ t("buttons.fetch") }}</span>
                        </button>
                        <button
                            class="button is-confirm is-small"
                            :disabled="subscriptionsLoading"
                            @click="subscribeAll"
                        >
                            <span class="icon"><font-awesome-icon icon="rss" /></span>
                            <span>{{ t("buttons.subscribe") }} </span>
                        </button>
                    </p>
                    <!--<button class="button is-confirm is-small" @click="unsubscribeAll" :disabled="subscriptionsLoading">Unsubscribe</button>-->
                    <span v-if="subscriptionsLoading">{{ t("messages.loading") }}</span>
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
                                    <button
                                        class="button is-confirm is-small"
                                        :disabled="subscriptionsLoading"
                                        @click="unsubscribe(subscription.id)"
                                    >
                                        <span class="icon"><font-awesome-icon icon="ban" /></span>
                                        <span>Unsubscribe</span>
                                    </button>
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
                    <code class="code">pip install --user --upgrade {{ pipKeys }}</code>
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
                <span class="icon"><fa
                    icon="sync"
                    spin
                /></span> {{ t("messages.loading") }}
            </div>
        </section>
    </div>
</template>

<script lang="ts">
import { useStore } from "@/store";
import { ApiSubscription } from "@common/Api/Client";
import { defineComponent } from "vue";
import { ApiResponse } from "@common/Api/Api";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faRss, faBan } from "@fortawesome/free-solid-svg-icons";
import { useI18n } from "vue-i18n";
import axios from "axios";
library.add(faRss, faBan);

// import licenses from "../../LICENSES.txt";

interface SoftwareCallback {
    path: string;
    status: string;
    update: string;
    version: string;

    user?: string;
    pid?: number;
    uid?: number;
    gid?: number;
    sapi: string;
    platform?: string;
    platform_family?: string;
    display_errors?: string;
    error_reporting?: string;
}

interface AboutData {
    is_docker: boolean;
    bins: {
        ffmpeg: SoftwareCallback;
        mediainfo: SoftwareCallback;
        tcd: SoftwareCallback;
        streamlink: SoftwareCallback;
        youtubedl: SoftwareCallback;
        pipenv: SoftwareCallback;
        python: SoftwareCallback;
        python3: SoftwareCallback;
        twitchdownloader: SoftwareCallback;
        php: SoftwareCallback;
        node: SoftwareCallback;
    };
    pip: Record<string, { comparator: string; version: string; }>;
}

export default defineComponent({
    name: "AboutView",
    title: "About",
    setup() {
        const store = useStore();
        const { t } = useI18n();
        return { store, t };
    },
    data(): {
        aboutData: AboutData | null;
        // envs: any;
        subscriptions: ApiSubscription[];
        subscriptionsLoading: boolean;
    } {
        return {
            aboutData: null,
            // envs: {},
            subscriptions: [],
            subscriptionsLoading: false,
        };
    },
    computed: {
        clientVersion(): string {
            return import.meta.env.VITE_APP_VERSION; // injected
        },
        clientMode(): string {
            return import.meta.env.MODE; // injected
        },
        verboseClientVersion(): string {
            return `${import.meta.env.VITE_APP_VERSION} (${import.meta.env.VITE_APP_BUILDDATE} / ${import.meta.env.VITE_APP_GIT_HASH})`; // injected
        },
        pipKeys(): string {
            if (!this.aboutData) {
                return "";
            }
            return Object.keys(this.aboutData.pip).join(" ");
        },
        licenseUrl(): string {
            // return this.store.cfg("basepath") + "/LICENSES.txt";
            return new URL("../../LICENSES.txt", import.meta.url).href;
        },
    },
    created() {
        this.fetchData();
    },
    methods: {
        fetchData() {
            this.aboutData = null;

            axios
                .get<ApiResponse>(`/api/v0/about`)
                .then((response) => {
                    const json = response.data;
                    const about = json.data;
                    console.debug("aboutData", about);
                    this.aboutData = about;
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
                this.aboutData = about;
            });
            */
        },
        fetchSubscriptions() {
            this.subscriptionsLoading = true;
            axios
                .get<ApiResponse>(`/api/v0/subscriptions`)
                .then((response) => {
                    const json = response.data;
                    console.log("subscriptions", json);
                    this.subscriptions = json.data.channels as ApiSubscription[];
                    this.subscriptionsLoading = false;
                    // TODO: handle when there are 0 subscriptions
                })
                .catch((err) => {
                    console.error("fetchSubscriptions error", err.response);
                    this.subscriptionsLoading = false;
                });
        },
        unsubscribe(id: string) {
            this.subscriptionsLoading = true;
            axios
                .delete(`/api/v0/subscriptions/${id}`)
                .then((response) => {
                    const json = response.data;
                    console.debug("unsubscribe", json);
                    this.subscriptionsLoading = false;
                    this.fetchSubscriptions();
                })
                .catch((err) => {
                    console.error("about error", err.response);
                });
        },
        subscribeAll() {
            this.subscriptionsLoading = true;
            axios
                .post(`/api/v0/subscriptions`)
                .then((response) => {
                    const json = response.data;
                    console.debug("subscribeAll", json);
                    this.subscriptionsLoading = false;
                    this.fetchSubscriptions();
                })
                .catch((err) => {
                    console.error("about error", err.response);
                });
        },
        /*
        unsubscribeAll() {
            this.subscriptionsLoading = true;
            axios
                .delete(`/api/v0/subscriptions`)
                .then((response) => {
                    const json = response.data;
                    console.debug("unsubscribeAll", json);
                    this.subscriptionsLoading = false;
                    this.fetchSubscriptions();
                })
                .catch((err) => {
                    console.error("about error", err.response);
                });
        },
        */
    },
});
</script>
