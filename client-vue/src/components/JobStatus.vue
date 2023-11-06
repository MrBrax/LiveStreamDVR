<template>
    <div v-if="store.jobList !== undefined" class="statustab statustab-jobs">
        <div class="statustab-jobs-list">
            <table v-if="store.jobList.length == 1 || expanded">
                <tr v-for="job in store.jobList" :key="job.name">
                    <td>
                        <span class="icon">
                            <fa :icon="jobStatusIcon(job.status)" />
                        </span>
                        <span class="text-overflow px-1">{{ job.name }}</span>
                    </td>
                    <td>{{ job.pid }}</td>
                    <td>
                        <span>{{ jobStatusString(job.status) }}</span>
                    </td>
                    <td v-if="job.progress && job.progress > 0">{{ Math.round(job.progress * 100) }}%</td>
                    <td v-if="job.progress && job.progress > 0">
                        <!--{{ shortDuration(store.getJobTimeRemaining(job.name) / 1000) }}-->
                        <duration-display :start-date="new Date().getTime() + store.getJobTimeRemaining(job.name)" output-style="humanLong" />
                    </td>
                </tr>
            </table>
            <em v-if="store.jobList.length == 0">{{ t("jobs.no-jobs-running") }}</em>
            <em v-if="store.jobList.length > 1 && !expanded">
                <span class="icon"><fa icon="sync" spin /></span>
                {{ t("jobs.jobs-running", { count: store.jobList.length }) }}
            </em>
        </div>
        <div class="statustab-jobs-toggle">
            <button v-if="store.jobList.length > 1" class="icon-button icon-button-big" title="Toggle job list" @click="expanded = !expanded">
                <fa :icon="expanded ? 'chevron-down' : 'chevron-up'" />
            </button>
        </div>
    </div>
</template>

<script lang="ts" setup>
import DurationDisplay from "@/components/DurationDisplay.vue";
import { useStore } from "@/store";
import { JobStatus } from "@common/Defs";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faCircle, faClock, faExclamationTriangle, faSync, faTimes } from "@fortawesome/free-solid-svg-icons";
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
library.add(faSync, faTimes, faExclamationTriangle, faClock, faCircle);

const store = useStore();
const { t } = useI18n();
const expanded = ref(false);

onMounted(() => {
    expanded.value = store.clientCfg("jobStatusExpandedByDefault", false);
});

const jobStatusString = (status: JobStatus) => {
    switch (status) {
        case JobStatus.RUNNING:
            return "Running";
        case JobStatus.STOPPED:
            return "Stopped";
        case JobStatus.ERROR:
            return "Error";
        case JobStatus.WAITING:
            return "Waiting";
        case JobStatus.NONE:
            return "None";
    }
};

const jobStatusIcon = (status: JobStatus) => {
    switch (status) {
        case JobStatus.RUNNING:
            return "sync";
        case JobStatus.STOPPED:
            return "exclamation-triangle";
        case JobStatus.ERROR:
            return "times";
        case JobStatus.WAITING:
            return "clock";
        case JobStatus.NONE:
            return "circle";
    }
};

</script>
