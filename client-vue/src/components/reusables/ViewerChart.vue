<template>
    <Bar
        :chart-options="chartOptions"
        :chart-data="chartData"
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
import { Bar } from 'vue-chartjs';
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from 'chart.js'
import type { Plugin, ChartOptions, ChartData, BubbleDataPoint } from 'chart.js';
import { onMounted, reactive } from 'vue';

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

const props = withDefaults(defineProps<{
    chartOptions: ChartOptions;
    chartData: ChartData<'bar', number[], string>;
    chartId: string;
    datasetIdKey: string;
    cssClasses: string;
    styles?: Partial<CSSStyleDeclaration>;
    width: number;
    height: number;
    plugins: Plugin<'bar'>[];
}>(), {
    width: 400,
    height: 400,
    cssClasses: '',
    styles: () => ({}),
    plugins: () => [],
    datasetIdKey: 'id',
    chartId: 'chart',
});

</script>
