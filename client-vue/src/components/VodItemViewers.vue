<template>
    <div
        v-if="vod.viewers && vod.viewers.length > 0"
        class="video-block video-viewers"
    >
        <div class="video-block-header">
            <h4>Viewers</h4>
        </div>
        <div class="video-block-content">
            <button
                class="button is-small"
                @click="isMaximized = !isMaximized"
            >
                <span class="icon">
                    <font-awesome-icon :icon="isMaximized ? 'chevron-up' : 'chevron-down'" />
                </span>
                <span>
                    {{ isMaximized ? 'Minimize' : 'Maximize' }}
                </span>
            </button>
            <!--
            <ul v-if="isMaximized">
                <li
                    v-for="entry in vod.viewers"
                    :key="entry.timestamp.getTime()"
                >
                    <strong>{{ formatDuration(vod.dateToTimestamp(entry.timestamp) || 0) }}:</strong> {{ entry.amount.toLocaleString() }}
                </li>
            </ul>
        -->
            <div class="viewer-chart">
                <ViewerChart
                    v-if="isMaximized && chartData"
                    :chart-options="chartOptions"
                    :chart-data="chartData"
                />
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { useStore } from '@/store';
import { useI18n } from 'vue-i18n';
import type { VODTypes } from '@/twitchautomator';
import { formatDuration } from '@/mixins/newhelpers';
import { computed, onMounted, reactive, ref } from 'vue';
import type { ChartData, ChartOptions } from 'chart.js';
import ViewerChart from '@/components/reusables/ViewerChart.vue';
// const ViewerChart = () => import('@/components/reusables/ViewerChart.vue');

const props = defineProps({
    vod: {
        type: Object as () => VODTypes,
        default: null,
        // required: true,
    }
});

const chartOptions = reactive<ChartOptions>({
    responsive: true,
    maintainAspectRatio: false,
    scales: {
        x: {
            ticks: {
                color: 'white',
            }
        },
        y: {
            ticks: {
                color: 'white',
            },
        },
    },
    plugins: {
        title: {
            display: false,
            // text: 'Viewers',
            // color: 'white',
        },
        legend: {
            display: false,
        },
    },
});

onMounted(() => {
    if (!chartOptions?.scales?.x?.ticks) return; // why, typescript
    if (!chartOptions?.scales?.y?.ticks) return; // why, typescript
    // if (!chartOptions?.plugins?.title) return; // why, typescript
    chartOptions.scales.x.ticks.color = getComputedStyle(document.body).getPropertyValue('--body-color');
    chartOptions.scales.y.ticks.color = getComputedStyle(document.body).getPropertyValue('--body-color');
    // chartOptions.plugins.title.color = getComputedStyle(document.body).getPropertyValue('--body-color');
});

const chartData = computed((): ChartData<'bar', number[], string> | null => {
    if (!props.vod.viewers || props.vod.viewers.length === 0) {
        return null;
    }

    const labels = props.vod.viewers.map(entry => formatDuration(props.vod.dateToTimestamp(entry.timestamp) || 0));
    const data = props.vod.viewers.map(entry => entry.amount);

    return {
        labels,
        datasets: [
            {
                label: 'Viewers',
                data,
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 1,
            },
        ],
    };
});

const store = useStore();
const { t } = useI18n();
const isMaximized = ref(false);

</script>

<style lang="scss" scoped>
.viewer-chart {
    margin-top: 1em;
}

.video-viewers {
    // padding: 1em;
    background-color: var(--video-segments-background-color);
}
</style>