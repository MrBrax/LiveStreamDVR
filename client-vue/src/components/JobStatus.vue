<template>
    <div
        v-if="store.jobList !== undefined"
        class="statustab statustab-jobs"
    >
        <table>
            <tr
                v-for="job in store.jobList"
                :key="job.name"
            >
                <td>
                    <span class="icon">
                        <fa
                            v-if="job.status == JobStatus.RUNNING"
                            icon="sync"
                            spin
                        />
                        <fa
                            v-else-if="job.status == JobStatus.STOPPED"
                            icon="exclamation-triangle"
                        />
                        <fa
                            v-else-if="job.status == JobStatus.ERROR"
                            icon="times"
                        />
                        <fa
                            v-else-if="job.status == JobStatus.WAITING"
                            icon="clock"
                        />
                        <fa
                            v-else-if="job.status == JobStatus.NONE"
                            icon="circle"
                        />
                    </span>
                    <span class="text-overflow px-1">{{ job.name }}</span>
                </td>
                <td>{{ job.pid }}</td>
                <td>
                    <span v-if="job.status == JobStatus.RUNNING">Running</span>
                    <span v-else-if="job.status == JobStatus.STOPPED">Stopped</span>
                    <span v-else-if="job.status == JobStatus.ERROR">Error</span>
                    <span v-else-if="job.status == JobStatus.WAITING">Waiting</span>
                    <span v-else-if="job.status == JobStatus.NONE">None</span>
                </td>
                <td v-if="job.progress && job.progress > 0">
                    {{ Math.round(job.progress * 100) }}%
                </td>
            </tr>
        </table>

        <em v-if="store.jobList.length == 0">{{ $t('jobs.no-jobs-running') }}</em>
    </div>
</template>

<script lang="ts">
import { useStore } from "@/store";
import { JobStatus } from "@common/Defs";
import { defineComponent } from "vue";
import { faTimes, faSync, faExclamationTriangle, faClock, faCircle } from "@fortawesome/free-solid-svg-icons";
import { library } from "@fortawesome/fontawesome-svg-core";
library.add(faSync, faTimes, faExclamationTriangle, faClock, faCircle);

export default defineComponent({
    name: "JobStatus",
    setup() {
        const store = useStore();
        return { store, JobStatus };
    },
});
</script>