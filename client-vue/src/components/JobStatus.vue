<template>
    <div
        v-if="store.jobList !== undefined"
        class="statustab statustab-jobs"
    >
        <div class="statustab-jobs-list">
            <table v-if="store.jobList.length == 1 || expanded">
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
                    <td v-if="job.progress && job.progress > 0">
                        <!--{{ shortDuration(store.getJobTimeRemaining(job.name) / 1000) }}-->
                        <duration-display
                            :start-date="new Date().getTime() + store.getJobTimeRemaining(job.name)"
                            output-style="humanLong"
                        />
                    </td>
                </tr>
            </table>
            <em v-if="store.jobList.length == 0">{{ t('jobs.no-jobs-running') }}</em>
            <em v-if="store.jobList.length > 1 && !expanded">
                <span class="icon"><fa
                    icon="sync"
                    spin
                /></span>
                {{ t('jobs.jobs-running', { count: store.jobList.length }) }}
            </em>
        </div>
        <div class="statustab-jobs-toggle">
            <button
                v-if="store.jobList.length > 1"
                class="icon-button icon-button-big"
                title="Toggle job list"
                @click="expanded = !expanded"
            >
                <fa
                    :icon="expanded ? 'chevron-down' : 'chevron-up'"
                />
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
</script>