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
            <button
                class="button is-small is-confirm"
                type="button"
                @click="fetchLog(true)"
            >
                <span class="icon"><fa icon="sync" /></span>
                <span>Fetch</span>
            </button>
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
                <td :title="'PID: ' + line.pid">
                    {{ line.level || "UNKNOWN" }}
                </td>
                <td @click="expandLog(lineIndex)">
                    {{ line.text }}
                </td>
            </tr>
        </table>
    </div>
</template>

<script lang="ts">
import { useStore } from "@/store";
import { ApiLogResponse } from "@common/Api/Api";
import { ApiLogLine } from "@common/Api/Client";
import axios from "axios";
import { format } from "date-fns";
import { defineComponent } from "vue";
import { formatDate, formatTimestamp } from "@/mixins/newhelpers";

export default defineComponent({
    name: "LogViewer",
    setup() {
        const store = useStore();
        return { store, formatDate, formatTimestamp };
    },
    data(): {
        logFilename: string;
        logFilenames: string[];
        logFromLine: number;
        logVisible: boolean;
        logModule: string;
        watcher: () => void;
    } {
        return {
            logFilename: "",
            logFilenames: [],
            logFromLine: 0,
            logVisible: false,
            logModule: "",
            watcher: () => { console.log("watcher"); },
        };
    },
    computed: {
        logFiltered(): ApiLogLine[] {
            return this.logLines.filter(line => {
                if (this.logModule) {
                    return line.module === this.logModule;
                }
                return true;
            });
        },
        logLines(): ApiLogLine[] {
            return this.store.log;
        },
    },
    mounted() {
        this.watcher = this.store.$onAction(({ name, store, args, after, onError }) => {
            if (!args) return;
            if (name !== "addLog" && name !== "clearLog") return;
            after(() => {
                setTimeout(() => {
                    this.scrollLog();
                }, 100);
            })
        });
        this.fetchLog();
    },
    unmounted() {
        if (this.watcher) this.watcher(); // remove listener
    },
    methods: {
        async fetchLog(clear = false) {

            // today's log file
            if (this.logFilename == "") {
                this.logFilename = format(new Date(), "yyyy-MM-dd");
            }

            if (clear) {
                this.logFromLine = 0;
                this.store.clearLog();
            }

            let response;
            try {
                response = await axios.get<ApiLogResponse>(`/api/v0/log/${this.logFilename}/${this.logFromLine}`);
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

            this.logFromLine = data.data.last_line;

            this.logFilenames = data.data.logs;

            // this.logLines = this.logLines.concat(data.data.lines);
            this.store.addLog(data.data.lines);

            // scroll to bottom
            setTimeout(() => {
                this.scrollLog();
            }, 100);
        },
        scrollLog() {
            const lv = this.$refs.logViewer as HTMLDivElement;
            if (!lv) return;
            lv.scrollTop = lv.scrollHeight;
        },
        logSetFilter(val: string) {
            this.logModule = this.logModule ? "" : val;
            console.log(`Log filter set to ${this.logModule}`);
        },
        logLineClass(line: ApiLogLine): Record<string, boolean> {
            return {
                "log-line": true,
                [`log-line-${line.level.toLowerCase()}`]: true,
                "log-line-interactive": line.metadata !== undefined,
            };
        },
        expandLog(lineNumber: number) {
            if (!this.store.log[lineNumber]) return;
            if (this.store.log[lineNumber].metadata) {
                alert(JSON.stringify(this.store.log[lineNumber].metadata, undefined, 2));
                console.log(this.store.log[lineNumber].metadata);
            }
        },
    },
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