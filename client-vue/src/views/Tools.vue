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
                    <tr v-for="job in jobsData" :key="job.name">
                        <td>{{ job.name }}</td>
                        <td>{{ job.pid }}</td>
                        <td><!-- {{ job.status }}-->{{ job.status ? 'Running' : 'Unexpected exit' }}</td>
                        <td><a v-if="job.status" @click="killJob(job.name)">Kill</a></td>
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

export default defineComponent({
    name: "Tools",
    data() {
        return {
            jobsData: {}
        };
    },
    created() {
        this.fetchData();
    },
    methods: {
        fetchData() {
            
            // this.settingsData = [];
            // this.settingsFields = [] as any;

            fetch(`api/v0/jobs/list`)
            .then((response) => response.json())
            .then((json) => {
                const jobs = json.data;
                this.jobsData = jobs;
            });

        },
        killJob( name:string ){
            alert("kill" + name);
        },
    },
    components: {
        ToolsBurnForm,
        ToolsVodDownloadForm,
        ToolsChatDownloadForm
    }
});
</script>
