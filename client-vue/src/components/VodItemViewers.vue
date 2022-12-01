<template>
    <div
        v-if="vod.viewers && vod.viewers.length > 0"
        class="video-block video-viewers"
    >
        <div
            class="video-block-header collapsible"
            aria-role="button"
            @click="isCollapsed = !isCollapsed"
        >
            <h4>
                <span class="icon">
                    <font-awesome-icon :icon="isCollapsed ? 'chevron-down' : 'chevron-up'" />
                </span>
                {{ t('vod.blocks.viewers') }}
            </h4>
        </div>
        <transition name="blinds">
            <div
                v-if="!isCollapsed"
                class="video-block-content"
            >
                <div
                    v-if="chartData"
                    class="viewer-chart"
                >
                    <ViewerChart
                        :chart-options="chartOptions"
                        :chart-data="chartData"
                        :chart-id="chartId"
                    />
                </div>
                <div v-else>
                    No data
                </div>
            </div>
        </transition>
    </div>
</template>

<script lang="ts" setup>
import { useStore } from '@/store';
import { useI18n } from 'vue-i18n';
import type { VODTypes } from '@/twitchautomator';
import { humanDuration } from '@/mixins/newhelpers';
import { computed, onMounted, reactive, ref, defineAsyncComponent } from 'vue';
import type { ChartData, ChartOptions } from 'chart.js';
// import ViewerChart from '@/components/reusables/ViewerChart.vue';
// const ViewerChart = () => import('@/components/reusables/ViewerChart.vue');

const ViewerChart = defineAsyncComponent(() => import('@/components/reusables/ViewerChart.vue'));

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

const chartId = computed(() => `viewer-chart-${props.vod.uuid}`);

const isCollapsed = ref(true);

onMounted(() => {

    isCollapsed.value = store.videoBlockShow.viewers;

    if (!chartOptions?.scales?.x?.ticks) return; // why, typescript
    if (!chartOptions?.scales?.y?.ticks) return; // why, typescript
    // if (!chartOptions?.plugins?.title) return; // why, typescript
    chartOptions.scales.x.ticks.color = getComputedStyle(document.body).getPropertyValue('--body-color');
    chartOptions.scales.y.ticks.color = getComputedStyle(document.body).getPropertyValue('--body-color');
    // chartOptions.plugins.title.color = getComputedStyle(document.body).getPropertyValue('--body-color');
});

const chartData = computed((): ChartData<'line', number[], string> | null => {
    if (!props.vod.viewers || props.vod.viewers.length === 0) {
        return null;
    }

    const labels = props.vod.viewers.map(entry => humanDuration(props.vod.dateToTimestamp(entry.timestamp) || 0));
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

</script>

<style lang="scss" scoped>
.viewer-chart {
    margin-top: 1em;
}

.video-viewers {
    // padding: 1em;
    // background-color: var(--video-segments-background-color);
    background-color: var(--video-block-background-color);
}
</style>