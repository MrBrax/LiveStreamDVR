<template>
    <div class="container">
        <section class="section">
            <div class="section-content">
                <div class="section-title"><h1>About</h1></div>
                <div class="section-content" v-if="aboutData && aboutData.bins">
                    <div class="block">
                        <h3>Installed utilities</h3>
                        <table class="table">
                            <tr>
                                <th>Name</th>
                                <th>Path</th>
                                <th>Status</th>
                            </tr>
                            <tr>
                                <td>FFmpeg</td>
                                <td>{{ aboutData.bins.ffmpeg.path }}</td>
                                <td>{{ aboutData.bins.ffmpeg.status }}</td>
                            </tr>
                            <tr>
                                <td>Mediainfo</td>
                                <td>{{ aboutData.bins.mediainfo.path }}</td>
                                <td>{{ aboutData.bins.mediainfo.status }}</td>
                            </tr>
                            <tr>
                                <td>Twitch chat downloader</td>
                                <td>{{ aboutData.bins.tcd.path }}</td>
                                <td>{{ aboutData.bins.tcd.status }}</td>
                                <td>{{ aboutData.bins.tcd.update }}</td>
                            </tr>
                            <tr>
                                <td>Streamlink</td>
                                <td>{{ aboutData.bins.streamlink.path }}</td>
                                <td>{{ aboutData.bins.streamlink.status }}</td>
                                <td>{{ aboutData.bins.streamlink.update }}</td>
                            </tr>
                            <tr>
                                <td>yt-dlp</td>
                                <td>{{ aboutData.bins.youtubedl.path }}</td>
                                <td>{{ aboutData.bins.youtubedl.status }}</td>
                                <td>{{ aboutData.bins.youtubedl.update }}</td>
                            </tr>
                            <tr>
                                <td>Pipenv</td>
                                <td>{{ aboutData.bins.pipenv.path }}</td>
                                <td v-html="aboutData.bins.pipenv.status"></td>
                            </tr>
                            <tr>
                                <td>TwitchDownloaderCLI</td>
                                <td>{{ aboutData.bins.twitchdownloader.path }}</td>
                                <td v-html="aboutData.bins.twitchdownloader.status"></td>
                            </tr>
                        </table>
                        <p>
                            This app tries to find all the executables using system utilities. This may not work if they're on a custom PATH. Please visit
                            <router-link :to="{ name: 'Settings' }">settings</router-link> to manually change them.
                        </p>
                    </div>

                    <!-- software -->
                    <div class="block">
                        <h3>Software</h3>
                        <ul>
                            <li><strong>Python version:</strong> {{ aboutData.bins.python.version ? aboutData.bins.python.version : "(no output)" }}</li>
                            <li><strong>Python3 version:</strong> {{ aboutData.bins.python3.version ? aboutData.bins.python3.version : "(no output)" }}</li>
                            <li><strong>Node.js version:</strong> {{ aboutData.bins.node.version ? aboutData.bins.node.version : "(no output)" }}</li>
                            <li><strong>PHP version:</strong> {{ aboutData.bins.php.version ? aboutData.bins.php.version : "(no output)" }}</li>
                            <li><strong>PHP User:</strong> {{ aboutData.bins.php.user }}</li>
                            <li><strong>PHP PID:</strong> {{ aboutData.bins.php.pid }}</li>
                            <li><strong>PHP UID:</strong> {{ aboutData.bins.php.uid }}</li>
                            <li><strong>PHP GID:</strong> {{ aboutData.bins.php.gid }}</li>
                            <li><strong>PHP SAPI:</strong> {{ aboutData.bins.php.sapi }}</li>
                            <li><strong>PHP Display errors:</strong> {{ aboutData.bins.php.display_errors }}</li>
                            <li><strong>PHP Error reporting:</strong> {{ aboutData.bins.php.error_reporting }}</li>
                            <li>
                                <strong>Platform:</strong> {{ aboutData.bins.php.platform ? aboutData.bins.php.platform : "unknown" }}/{{
                                    aboutData.bins.php.platform_family ? aboutData.bins.php.platform_family : "unknown"
                                }}
                            </li>
                            <li><strong>Docker:</strong> {{ aboutData.is_docker ? "Yes" : "No" }}</li>
                            <li><strong>Backend version:</strong> {{ store.version }}</li>
                            <li><strong>Frontend version:</strong> {{ clientVersion }}</li>
                            <li><strong>Frontend build:</strong> {{ clientMode }}</li>
                            <li><strong>Frontend verbose:</strong> {{ verboseClientVersion }}</li>
                            <!--<li v-if="envs && envs.NODE"><strong>Node:</strong> {{ envs.npm_config_node_version }}{% endif %}</li>-->
                        </ul>
                    </div>

                    <!-- env -->
                    <!--
                    <template v-if="envs">
                        <h3>Environment variables</h3>
                        <table class="table">
                            {% for k,v in envs %}
                                <tr>
                                    <td>{{ k }}</td><td>{{ v }}</td>
                                </tr>
                            {% endfor %}
                        </table>

                        <hr />
                    </template>
                    -->

                    <!-- cronjobs -->
                    <div class="block">
                        <h3>Cronjobs</h3>
                        <table class="table">
                            <tr v-for="(cron_status, cron_name) in aboutData.cron_lastrun" :key="cron_name">
                                <td>{{ cron_name }}</td>
                                <td>{{ cron_status }}</td>
                                <td><button class="button is-confirm is-small" @click="runCron(cron_name)">Run now</button></td>
                            </tr>
                        </table>
                    </div>

                    <div class="block">
                        <h3>Subscriptions</h3>
                        <button class="button is-confirm is-small" @click="fetchSubscriptions" :disabled="subscriptionsLoading">Fetch</button>
                        <button class="button is-confirm is-small" @click="subscribeAll" :disabled="subscriptionsLoading">Subscribe</button>
                        <span v-if="subscriptionsLoading">Loading...</span>
                        <table>
                            <tr v-for="subscription in subscriptions" :key="subscription.id">
                                <td>{{ subscription.id }}</td>
                                <td>{{ subscription.created_at }}</td>
                                <td>{{ subscription.username }}</td>
                                <td>{{ subscription.type }}</td>
                                <td>
                                    <button class="button is-confirm is-small" @click="unsubscribe(subscription.id)" :disabled="subscriptionsLoading">
                                        Unsubscribe
                                    </button>
                                </td>
                            </tr>
                        </table>
                    </div>

                    <!-- pip update -->
                    <div class="block" v-if="!aboutData.is_docker">
                        <h3>Pip update</h3>
                        <code>pip install --user --upgrade yt-dlp streamlink tcd pipenv</code>
                        <br />You might want to install without the --user switch depending on environment.
                    </div>
                    <div class="block">
                        <!-- links -->
                        <h3>Links</h3>
                        <ul>
                            <li><a href="https://www.python.org/downloads/" target="_blank">Python</a></li>
                            <li><a href="https://www.gyan.dev/ffmpeg/builds/" target="_blank">FFmpeg builds for Windows</a> (rip zeranoe)</li>
                            <li><a href="https://mediaarea.net/en/MediaInfo" target="_blank">MediaInfo</a></li>
                            <li><a href="https://github.com/lay295/TwitchDownloader" target="_blank">TwitchDownloader</a></li>
                        </ul>
                    </div>
                </div>
                <div class="section-content" v-else>
                    <span class="icon"><fa icon="sync" spin></fa></span> Loading...
                </div>
            </div>
        </section>
    </div>
</template>

<script lang="ts">
import { useStore } from "@/store";
import { ApiSubscription } from "@/twitchautomator";
import { defineComponent } from "vue";

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
    cron_lastrun: {
        check_deleted_vods: string;
        check_muted_vods: string;
        dump_playlists: string;
        sub: string;
    };
}

export default defineComponent({
    name: "AboutView",
    title: "About",
    setup() {
        const store = useStore();
        return { store };
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
    created() {
        this.fetchData();
    },
    computed: {
        clientVersion() {
            return process.env.VUE_APP_VERSION; // injected
        },
        clientMode() {
            return process.env.NODE_ENV; // injected
        },
        verboseClientVersion() {
            return `${process.env.VUE_APP_VERSION} (${process.env.VUE_APP_BUILDDATE} / ${process.env.VUE_APP_GIT_HASH})`; // injected
        },
    },
    methods: {
        fetchData() {
            this.aboutData = null;

            this.$http
                .get(`/api/v0/about`)
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
        runCron(type: string) {
            this.$http
                .get(`/api/v0/cron/${type}`)
                .then((response) => {
                    const json = response.data;
                    console.debug("cronData", json);
                    if (json.message) alert(json.message);
                    this.fetchData();
                })
                .catch((err) => {
                    console.error("about error", err.response);
                });
        },
        fetchSubscriptions() {
            this.subscriptionsLoading = true;
            this.$http
                .get(`/api/v0/subscriptions`)
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
            this.$http
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
            this.$http
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
    },
});
</script>
