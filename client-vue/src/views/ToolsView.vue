<template>
    <div class="container">
        <section class="section">
            <div class="section-title"><h1>Full VOD fetch and burn chat</h1></div>
            <div class="section-content">
                <tools-burn-form />
            </div>
        </section>

        <section class="section">
            <div class="section-title"><h1>VOD download</h1></div>
            <div class="section-content">
                <tools-vod-download-form />
            </div>
        </section>

        <section class="section">
            <div class="section-title"><h1>Chat download</h1></div>
            <div class="section-content">
                <tools-chat-download-form />
            </div>
        </section>

        <section class="section">
            <div class="section-title"><h1>Hook debug</h1></div>
            <div class="section-content">
                <input type="file" @change="sendHookDebug" accept=".json" />
            </div>
        </section>

        <section class="section">
            <div class="section-title"><h1>Reset channels</h1></div>
            <div class="section-content">
                <button type="button" class="button" @click="resetChannels">Reset</button>
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

        <section class="section">
            <div class="section-title"><h1>Current jobs</h1></div>
            <div class="section-content">
                <table>
                    <tr v-for="job in store.jobList" :key="job.name">
                        <td>
                            <span class="text-overflow">{{ job.name }}</span>
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
                            <a class="button is-danger is-small" v-if="job.status" @click="killJob(job.name)" title="Kill job">
                                <span class="icon"><fa icon="skull"></fa></span>
                            </a>
                            <a class="button is-danger is-small" v-if="job.status" @click="clearJob(job.name)" title="Clear job">
                                <span class="icon"><fa icon="trash"></fa></span>
                            </a>
                        </td>
                    </tr>
                </table>

                <em v-if="jobsData.length == 0">None</em>
            </div>
        </section>
    </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

import ToolsBurnForm from "@/components/forms/ToolsBurnForm.vue";
import ToolsVodDownloadForm from "@/components/forms/ToolsVodDownloadForm.vue";
import ToolsChatDownloadForm from "@/components/forms/ToolsChatDownloadForm.vue";

import type { ApiJob } from "@common/Api/Client";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faSkull, faTrash } from "@fortawesome/free-solid-svg-icons";
import { useStore } from "@/store";
import { JobStatus } from "@common/Defs";
library.add(faSkull, faTrash);

interface PayloadDump {
    headers: Record<string, string>;
    body: any;
    query: any;
    ip: string;
}

export default defineComponent({
    name: "ToolsView",
    title: "Tools",
    setup() {
        const store = useStore();
        return { store, JobStatus };
    },
    data() {
        return {
            jobsData: [] as ApiJob[],
        };
    },
    created() {
    },
    methods: {
        killJob(name: string) {
            if (!confirm(`Kill job "${name}?"`)) return;

            this.$http
                .delete(`/api/v0/jobs/${name}`)
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
    components: {
        ToolsBurnForm,
        ToolsVodDownloadForm,
        ToolsChatDownloadForm,
    },
});
</script>
