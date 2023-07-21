<template>
    <Line
        :options="chartOptions"
        :data="chartData"
        :chart-id="chartId"
        :dataset-id-key="datasetIdKey"
        :plugins="plugins"
        :css-classes="cssClasses"
        :styles="styles"
        :width="width"
        :height="height"
    />
</template>

<script lang="ts" setup>
import { Line } from "vue-chartjs";
import { Chart as ChartJS, Title, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement } from "chart.js";
import type { Plugin, ChartOptions, ChartData } from "chart.js";

ChartJS.register(Title, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement);

const props = withDefaults(defineProps<{
    chartOptions: ChartOptions;
    chartData: ChartData<"line", number[], string>;
    chartId: string;
    datasetIdKey?: string;
    cssClasses?: string;
    styles?: Partial<CSSStyleDeclaration>;
    width?: number;
    height?: number;
    plugins: Plugin<"line">[];
}>(), {
    width: 400,
    height: 400,
    cssClasses: "",
    styles: () => ({}),
    plugins: () => [],
    datasetIdKey: "id",
    chartId: "chart",
    data: () => ({ datasets: [] }),
    options: () => ({}),
});

/*
onMounted(() => {
    console.debug('chart mounted', props.chartId);
});

onUnmounted(() => {
    console.debug('chart unmounted', props.chartId);
});
*/

</script>
