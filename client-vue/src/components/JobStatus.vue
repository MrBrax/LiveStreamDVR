<template>
    <div id="jobs-status" v-if="store.jobList !== undefined">
        <table>
            <tr v-for="job in store.jobList" :key="job.name">
                <td>
                    <span class="icon">
                        <fa icon="sync" spin v-if="job.status"></fa>
                        <fa icon="exclamation-triangle" v-else></fa>
                    </span>
                    <span class="text-overflow px-1">{{ job.name }}</span>
                </td>
                <td>{{ job.pid }}</td>
                <td><!-- {{ job.status }}-->{{ job.status ? "Running" : "Unexpected exit" }}</td>
            </tr>
        </table>

        <em v-if="store.jobList.length == 0">None</em>
    </div>
</template>

<script lang="ts">
import { useStore } from "@/store";
import { defineComponent } from "vue";

export default defineComponent({
    name: "JobStatus",
    setup() {
        const store = useStore();
        return { store };
    },
    methods: {
        async fetchJobs() {
            let response;

            try {
                response = await this.$http.get(`/api/v0/jobs`);
            } catch (error) {
                console.error(error);
                return;
            }

            const json = response.data;
            // console.debug("Update jobs list", json.data);
            this.store.updateJobList(json.data);
        },
    },
});
</script>