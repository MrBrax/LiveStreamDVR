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
                <h1>{{ $t('views.tools.vod-download') }}</h1>
            </div>
            <div class="section-content">
                <tools-vod-download-form />
            </div>
        </section>

        <section class="section">
            <div class="section-title">
                <h1>{{ $t('views.tools.chat-download') }}</h1>
            </div>
            <div class="section-content">
                <tools-chat-download-form />
            </div>
        </section>

        <section class="section">
            <div class="section-title">
                <h1>{{ $t('views.tools.clip-download') }}</h1>
            </div>
            <div class="section-content">
                <tools-clip-download-form />
            </div>
        </section>
    </div>
    <div class="container">
        <section class="section">
            <div class="section-title">
                <h1>{{ $t('views.tools.chat-dump') }}</h1>
            </div>
            <div class="section-content">
                <tools-chat-dump-form />
            </div>
        </section>

        <section class="section">
            <div class="section-title">
                <h1>Hook debug</h1>
            </div>
            <div class="section-content">
                <input
                    type="file"
                    accept=".json"
                    @change="sendHookDebug"
                >
                <p>
                    Fakes a hook call from a JSON payload. Useful for debugging.<br>
                    Payloads are stored in <code>/data/payloads/</code>
                </p>
            </div>
        </section>

        <section class="section">
            <div class="section-title">
                <h1>{{ $t('views.tools.reset-channels') }}</h1>
            </div>
            <div class="section-content">
                <button
                    type="button"
                    class="button is-danger"
                    @click="resetChannels"
                >
                    <span class="icon"><fa icon="sync" /></span>
                    <span>{{ $t('buttons.reset') }}</span>
                </button>
                <p>
                    {{ $t('messages.this-is-a-bad-idea-if-any-of-your-channels-are-live') }}
                </p>
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
                <h1>{{ $t('views.tools.current-jobs') }}</h1>
            </div>
            <div class="section-content">
                <table
                    v-if="store.jobList && store.jobList.length > 0"
                    class="table is-fullwidth is-striped"
                >
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Started at</th>
                            <th>PID</th>
                            <th>Status</th>
                            <th>Progress</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tr
                        v-for="job in store.jobList"
                        :key="job.name"
                    >
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
                            <span v-if="job.progress">{{ Math.round(job.progress * 100) }}%</span>
                        </td>
                        <td>
                            <div class="buttons">
                                <a
                                    v-if="job.status"
                                    class="button is-danger is-small"
                                    title="Gracefully kill job (SIGHUP)"
                                    @click="killJob(job.name, 'SIGHUP')"
                                >
                                    <span class="icon"><fa icon="heart" /></span>
                                </a>
                                <a
                                    v-if="job.status"
                                    class="button is-danger is-small"
                                    title="Gracefully kill job (SIGINT)"
                                    @click="killJob(job.name, 'SIGINT')"
                                >
                                    <span class="icon"><fa icon="stop" /></span>
                                </a>
                                <a
                                    v-if="job.status"
                                    class="button is-danger is-small"
                                    title="Kill job (SIGTERM)"
                                    @click="killJob(job.name)"
                                >
                                    <span class="icon"><fa icon="skull" /></span>
                                </a>
                                <a
                                    v-if="job.status"
                                    class="button is-danger is-small"
                                    title="Clear job"
                                    @click="clearJob(job.name)"
                                >
                                    <span class="icon"><fa icon="trash" /></span>
                                </a>
                            </div>
                        </td>
                    </tr>
                </table>
                <em v-else>{{ $t('jobs.no-jobs-running') }}</em>
            </div>
        </section>
    </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

// import ToolsBurnForm from "@/components/forms/ToolsBurnForm.vue";
import ToolsVodDownloadForm from "@/components/forms/ToolsVodDownloadForm.vue";
import ToolsChatDownloadForm from "@/components/forms/ToolsChatDownloadForm.vue";
import ToolsChatDumpForm from "@/components/forms/ToolsChatDumpForm.vue";
import ToolsClipDownloadForm from "../components/forms/ToolsClipDownloadForm.vue";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faHeart, faStop, faSkull, faTrash } from "@fortawesome/free-solid-svg-icons";
import { useStore } from "@/store";
import { JobStatus } from "@common/Defs";

library.add(faHeart, faStop, faSkull, faTrash);

interface PayloadDump {
    headers: Record<string, string>;
    body: any;
    query: any;
    ip: string;
}

export default defineComponent({
    name: "ToolsView",
    title: "Tools",
    components: {
        // ToolsBurnForm,
        ToolsVodDownloadForm,
        ToolsChatDownloadForm,
        ToolsChatDumpForm,
        ToolsClipDownloadForm
    },
    setup() {
        const store = useStore();
        return { store, JobStatus };
    },
    methods: {
        killJob(name: string, method = "") {
            if (!confirm(`Kill job "${name}?"`)) return;

            this.$http
                .delete(`/api/v0/jobs/${name}`, {
                    params: {
                        method: method,
                    }
                })
                .then((response) => {
                    const json = response.data;
                    if (json.message) alert(json.message);
                    console.log(json);
                })
                .catch((err) => {
                    console.error("tools jobs fetch error", err.response);
                });
        },
        clearJob(name: string) {
            if (!confirm(`Clear job "${name}? This does not necessarily kill the process."`)) return;

            this.$http
                .delete(`/api/v0/jobs/${name}?clear=1`)
                .then((response) => {
                    const json = response.data;
                    if (json.message) alert(json.message);
                    console.log(json);
                })
                .catch((err) => {
                    console.error("tools jobs fetch error", err.response);
                });
        },
        sendHookDebug(e: Event) {
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

                    this.$http
                        .post(`/api/v0/hook`, data.body, {
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
        },
        resetChannels() {
            if (!confirm("Reset channels?")) return;

            this.$http
                .post(`/api/v0/tools/reset_channels`)
                .then((response) => {
                    const json = response.data;
                    if (json.message) alert(json.message);
                    console.log(json);
                })
                .catch((err) => {
                    console.error("tools reset channels error", err.response);
                });
        },
    },
});
</script>
