<template>
    <div class="field is-horizontal">
        <div class="control has-addon">
            <div class="select is-small">
                <select v-model="logFilename">
                    <option
                        v-for="fn in logFilenames"
                        :key="fn"
                    >
                        {{ fn }}
                    </option>
                </select>
            </div>
            <d-button
                class="is-small is-confirm"
                icon="sync"
                @click="fetchLog(true)"
            >
                Fetch
            </d-button>
        </div>
    </div>

    <div
        ref="logViewer"
        class="log_viewer"
    >
        <table>
            <tr
                v-for="(line, lineIndex) in logFiltered"
                :key="lineIndex"
                :class="logLineClass(line)"
            >
                <td v-if="line.date">
                    {{ formatDate(line.date) }}
                </td>
                <td v-else-if="line.time">
                    {{ formatTimestamp(line.time / 1000, "yyyy-MM-dd HH:ii:ss.SSS") }}
                </td>
                <td v-else-if="line.date_string">
                    {{ line.date_string }}
                </td>
                <td v-else>
                    (no date)
                </td>
                <td>
                    <a @click="logSetFilter(line.module)">{{ line.module }}</a>
                </td>
                <td :title="`PID: ${line.pid}`">
                    {{ line.level || "UNKNOWN" }}
                </td>
                <td @click="expandLog(lineIndex)">
                    {{ line.text }}
                </td>
            </tr>
        </table>
    </div>
</template>

<script lang="ts" setup>
import { useStore } from "@/store";
import type { ApiLogResponse } from "@common/Api/Api";
import type { ApiLogLine } from "@common/Api/Client";
import axios from "axios";
import { format } from "date-fns";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { formatDate, formatTimestamp } from "@/mixins/newhelpers";

// setup
const store = useStore();
        
// data
const logFilename = ref<string>("");
const logFilenames = ref<string[]>([]);
const logFromLine = ref<number>(0);
const logVisible = ref<boolean>(false);
const logModule = ref<string>("");
const watcher = ref<() => void>(() => { console.log("watcher"); });
const logViewer = ref<HTMLElement | null>(null);

// computed
const logFiltered = computed((): ApiLogLine[] => {
    return logLines.value.filter(line => {
        if (logModule.value) {
            return line.module === logModule.value;
        }
        return true;
    });
});

const logLines = computed((): ApiLogLine[] => {
    return store.log;
});

onMounted(() => {
    watcher.value = store.$onAction(({ name, store, args, after, onError }) => {
        if (!args) return;
        if (name !== "addLog" && name !== "clearLog") return;
        after(() => {
            setTimeout(() => {
                scrollLog();
            }, 100);
        })
    });
    fetchLog();
});
onUnmounted(() => {
    if (watcher.value) watcher.value(); // remove listener
});

async function fetchLog(clear = false) {

    // today's log file
    if (logFilename.value == "") {
        logFilename.value = format(new Date(), "yyyy-MM-dd");
    }

    if (clear) {
        logFromLine.value = 0;
        store.clearLog();
    }

    let response;
    try {
        response = await axios.get<ApiLogResponse>(`/api/v0/log/${logFilename.value}/${logFromLine.value}`);
    } catch (error) {
        console.error(error);
        return;
    }

    // console.debug("log data", response.data);

    const data = response.data;

    if (!data.data) {
        console.error("fetchLog invalid data", response.data);
        return;
    }

    if (!data.data.lines) return;

    logFromLine.value = data.data.last_line;

    logFilenames.value = data.data.logs;

    // this.logLines = this.logLines.concat(data.data.lines);
    store.addLog(data.data.lines);

    // scroll to bottom
    setTimeout(() => {
        scrollLog();
    }, 100);
}

function scrollLog() {
    const lv = logViewer.value;
    if (!lv) return;
    lv.scrollTop = lv.scrollHeight;
}

function logSetFilter(val: string) {
    logModule.value = logModule.value ? "" : val;
    console.log(`Log filter set to ${logModule.value}`);
}

function logLineClass(line: ApiLogLine): Record<string, boolean> {
    return {
        "log-line": true,
        [`log-line-${line.level.toLowerCase()}`]: true,
        "log-line-interactive": line.metadata !== undefined,
    };
}

function expandLog(lineNumber: number) {
    if (!store.log[lineNumber]) return;
    if (store.log[lineNumber].metadata) {
        alert(JSON.stringify(store.log[lineNumber].metadata, undefined, 2));
        console.log(store.log[lineNumber].metadata);
    }
}

defineExpose({
    scrollLog
});

</script>

<style lang="scss" scoped>
.log_viewer {
    font-family: Consolas, monospace;
    font-size: 80%;
    color: #333;
    max-height: 600px;
    // max-width: 600px;
    overflow-x: scroll;
    overflow-y: scroll;

    table {
        font-family: Consolas, monospace;
        font-size: inherit;
        color: #333;

        td {
            padding: 0 10px 0 0;
            margin: 0;
            vertical-align: top;

            &:nth-child(1) {
                width: 160px;
            }

            // date column
        }

        tr {
            padding: 0;
            margin: 0;
        }
    }

    .log-line {
        color: var(--log-color-default);

        &.log-line-success {
            // color: #3ea335;
            color: var(--log-color-success);
            font-weight: 700;
        }

        &.log-line-fatal {
            // color: #ff0000;
            color: var(--log-color-fatal);
            font-weight: 700;
            animation: 0.5s live infinite ease-in-out;
        }

        &.log-line-warning {
            // color: #ff7300;
            color: var(--log-color-warning);
            font-weight: 700;
        }

        &.log-line-error {
            // color: #f00;
            color: var(--log-color-error);
            font-weight: 700;
        }

        &.log-line-debug {
            // color: #9c9c9c;
            color: var(--log-color-debug);
            font-weight: 200;
        }

        &.log-line-interactive {
            cursor: pointer;
        }
    }

    a {
        color: inherit;
        text-decoration: none;

        &:hover {
            color: red;
        }
    }
}
</style>