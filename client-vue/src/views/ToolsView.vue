<template>
    <div class="container">
        <!--
        <section class="section">
            <div class="section-title"><h1>Full VOD fetch and burn chat</h1></div>
            <div class="section-content">
                <tools-burn-form />
            </div>
        </section>
        -->

        <section class="section">
            <div class="section-title">
                <h1>{{ t("views.tools.vod-download") }}</h1>
            </div>
            <div class="section-content">
                <tools-vod-download-form />
            </div>
        </section>

        <section class="section">
            <div class="section-title">
                <h1>{{ t("views.tools.chat-download") }}</h1>
            </div>
            <div class="section-content">
                <tools-chat-download-form />
            </div>
        </section>

        <section class="section">
            <div class="section-title">
                <h1>{{ t("views.tools.clip-download") }}</h1>
            </div>
            <div class="section-content">
                <tools-clip-download-form />
            </div>
        </section>
    </div>
    <div class="container">
        <section class="section">
            <div class="section-title">
                <h1>{{ t("views.tools.chat-dump") }}</h1>
            </div>
            <div class="section-content">
                <tools-chat-dump-form />
            </div>
        </section>

        <section v-if="store.cfg('debug')" class="section">
            <div class="section-title">
                <h1>Hook debug</h1>
            </div>
            <div class="section-content">
                <input type="file" accept=".json" @change="sendHookDebug" />
                <p>
                    Fakes a hook call from a JSON payload. Useful for debugging.<br />
                    Payloads are stored in <code>/data/payloads/</code>
                </p>
            </div>
        </section>

        <section class="section">
            <div class="section-title">
                <h1>{{ t("views.tools.system") }}</h1>
            </div>
            <div class="section-content">
                <div class="field">
                    <div class="control">
                        <d-button type="button" color="danger" icon="sync">
                            {{ t("views.tools.reset-channels") }}
                        </d-button>
                        <p class="input-help">
                            {{ t("messages.this-is-a-bad-idea-if-any-of-your-channels-are-live") }}
                        </p>
                    </div>
                </div>
                <div class="field">
                    <div class="control">
                        <d-button type="button" color="danger" icon="power-off" @click="shutdown">
                            {{ t("views.tools.shutdown") }}
                        </d-button>
                    </div>
                </div>
                <div class="field">
                    <div class="control">
                        <d-button type="button" color="success" icon="sync" @click="buildClient">
                            {{ t("views.tools.build-client") }}
                        </d-button>
                    </div>
                </div>
            </div>
        </section>

        <!--
        <section class="section">
            <div class="section-title"><h1>Saved VODs</h1></div>
            <div class="section-content">

                {% if saved_vods %}
                    <ul>
                    {% for vod in saved_vods %}
                        <li><a href="{{ base_path() }}/saved_vods/{{ vod.name }}">{{ vod.name }}</a> ({{ formatBytes(vod.size) }})</li>
                    {% endfor %}
                    </ul>
                {% else %}
                    <em>None</em>
                {% endif %}

            </div>
        </section>
        -->
    </div>
    <div class="container">
        <section class="section">
            <div class="section-title">
                <h1>{{ t("views.tools.current-jobs") }}</h1>
            </div>
            <div class="section-content">
                <table v-if="store.jobList && store.jobList.length > 0" class="table is-fullwidth is-striped">
                    <thead>
                        <tr>
                            <th>{{ t("jobs.name") }}</th>
                            <th>{{ t("jobs.started-at") }}</th>
                            <th>{{ t("jobs.pid") }}</th>
                            <th>{{ t("jobs.status") }}</th>
                            <th>{{ t("jobs.progress") }}</th>
                            <th>{{ t("jobs.time-left") }}</th>
                            <th>{{ t("jobs.action") }}</th>
                        </tr>
                    </thead>
                    <tr v-for="job in store.jobList" :key="job.name">
                        <td>
                            <span class="text-overflow">{{ job.name }}</span>
                        </td>
                        <td>
                            {{ job.dt_started_at ? formatDate(job.dt_started_at) : "No date" }}
                        </td>
                        <td>{{ job.pid }}</td>
                        <td>
                            <span v-if="job.status == JobStatus.RUNNING">Running</span>
                            <span v-else-if="job.status == JobStatus.STOPPED">Stopped</span>
                            <span v-else-if="job.status == JobStatus.ERROR">Error</span>
                            <span v-else-if="job.status == JobStatus.WAITING">Waiting</span>
                            <span v-else-if="job.status == JobStatus.NONE">None</span>
                        </td>
                        <td>
                            <span v-if="job.progress">
                                <progress
                                    :value="job.progress * 100"
                                    max="100"
                                    :title="Math.round(job.progress * 100).toString() + '%'"
                                    class="progress"
                                /><br />
                                <!--<span class="input-help">{{ Math.round(job.progress * 100) }}%</span>-->
                            </span>
                        </td>
                        <td>
                            <span v-if="job.progress && job.progress > 0">
                                <!--{{ shortDuration(store.getJobTimeRemaining(job.name) / 1000) }}-->
                                <duration-display :start-date="new Date().getTime() + store.getJobTimeRemaining(job.name)" output-style="humanLong" />
                            </span>
                        </td>
                        <td>
                            <div class="buttons">
                                <a
                                    v-if="job.status"
                                    class="button is-danger is-small"
                                    title="Gracefully kill job (SIGHUP)"
                                    @click="killJob(job.name, 'SIGHUP')"
                                >
                                    <span class="icon"><font-awesome-icon icon="heart" /></span>
                                </a>
                                <a
                                    v-if="job.status"
                                    class="button is-danger is-small"
                                    title="Gracefully kill job (SIGINT)"
                                    @click="killJob(job.name, 'SIGINT')"
                                >
                                    <span class="icon"><font-awesome-icon icon="stop" /></span>
                                </a>
                                <a v-if="job.status" class="button is-danger is-small" title="Kill job (SIGTERM)" @click="killJob(job.name)">
                                    <span class="icon"><font-awesome-icon icon="skull" /></span>
                                </a>
                                <a v-if="job.status" class="button is-danger is-small" title="Clear job" @click="clearJob(job.name)">
                                    <span class="icon"><font-awesome-icon icon="trash" /></span>
                                </a>
                            </div>
                        </td>
                    </tr>
                </table>
                <em v-else>{{ t("jobs.no-jobs-running") }}</em>
                <p v-if="store.jobList && store.jobList.length > 0 && allJobsDuration !== 0">
                    All jobs finish in <duration-display :start-date="new Date().getTime() + allJobsDuration" output-style="humanLong" />
                </p>
            </div>
        </section>
    </div>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import type { ApiResponse } from "@common/Api/Api";

// import ToolsBurnForm from "@/components/forms/ToolsBurnForm.vue";
import ToolsVodDownloadForm from "@/components/forms/ToolsVodDownloadForm.vue";
import ToolsChatDownloadForm from "@/components/forms/ToolsChatDownloadForm.vue";
import ToolsChatDumpForm from "@/components/forms/ToolsChatDumpForm.vue";
import ToolsClipDownloadForm from "../components/forms/ToolsClipDownloadForm.vue";
import DurationDisplay from "@/components/reusables/DurationDisplay.vue";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faHeart, faStop, faSkull, faTrash, faPowerOff } from "@fortawesome/free-solid-svg-icons";
import { useStore } from "@/store";
import { JobStatus } from "@common/Defs";
import { useI18n } from "vue-i18n";
import axios from "axios";
import { formatDate } from "@/mixins/newhelpers";

library.add(faHeart, faStop, faSkull, faTrash, faPowerOff);

interface PayloadDump {
    headers: Record<string, string>;
    body: any;
    query: any;
    ip: string;
}

const store = useStore();
const { t } = useI18n();

const allJobsDuration = computed((): number => {
    return store.jobList.reduce((prev, cur) => (store.getJobTimeRemaining(cur.name) || 0) + prev, 0);
});

function killJob(name: string, method = "") {
    if (!confirm(`Kill job "${name}?"`)) return;

    axios
        .delete(`/api/v0/jobs/${name}`, {
            params: {
                method: method,
            },
        })
        .then((response) => {
            const json = response.data;
            if (json.message) alert(json.message);
            console.log(json);
        })
        .catch((err) => {
            console.error("tools jobs fetch error", err.response);
        });
}

function clearJob(name: string) {
    if (!confirm(`Clear job "${name}? This does not necessarily kill the process."`)) return;

    axios
        .delete(`/api/v0/jobs/${name}?clear=1`)
        .then((response) => {
            const json = response.data;
            if (json.message) alert(json.message);
            console.log(json);
        })
        .catch((err) => {
            console.error("tools jobs fetch error", err.response);
        });
}

function sendHookDebug(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
        const file = target.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            const raw = e.target?.result;
            if (!raw) {
                alert("No data");
                return;
            }
            const data: PayloadDump = JSON.parse(raw.toString());

            console.log("payload", data);

            axios
                .post<ApiResponse>("/api/v0/hook", data.body, {
                    headers: data.headers,
                })
                .then((response) => {
                    const json = response.data;
                    if (json.message) alert(json.message);
                    console.log(json);
                })
                .catch((err) => {
                    console.error("tools hook debug error", err.response);
                });
        };
        reader.readAsText(file, "UTF-8");
    }
}

function resetChannels() {
    if (!confirm("Reset channels?")) return;

    axios
        .post<ApiResponse>("/api/v0/tools/reset_channels")
        .then((response) => {
            const json = response.data;
            if (json.message) alert(json.message);
            console.log(json);
        })
        .catch((err) => {
            console.error("tools reset channels error", err.response);
        });
}

function shutdown() {
    if (!confirm("Shutdown?")) return;

    axios
        .post<ApiResponse>("/api/v0/tools/shutdown")
        .then((response) => {
            const json = response.data;
            if (json.message) alert(json.message);
            console.log(json);
        })
        .catch((err) => {
            console.error("tools shutdown error", err.response);
        });
}

function buildClient() {
    if (!confirm("Build client?")) return;

    const basepath = prompt("Base path", "/");

    axios
        .post<ApiResponse>(`/api/v0/tools/buildclient?basepath=${basepath}`)
        .then((response) => {
            const json = response.data;
            if (json.message) alert(json.message);
            console.log(json);
        })
        .catch((err) => {
            console.error("tools build client error", err.response);
        });
}
</script>
