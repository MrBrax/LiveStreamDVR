<template>
    <div>
        <select v-model="logFilename">
            <option v-for="fn in logFilenames" :key="fn">{{ fn }}</option>
        </select>
        <button type="button" @click="fetchLog(true)">Fetch</button>
    </div>

    <div class="log_viewer" ref="logViewer">
        <table>
            <tr v-for="(line, lineIndex) in logFiltered" :key="lineIndex" :class="logLineClass(line)">
                <td v-if="line.date">{{ formatDate(line.date) }}</td>
                <td v-else-if="line.time">{{ formatTimestamp(line.time / 1000, "yyyy-MM-dd HH:ii:ss.SSS") }}</td>
                <td v-else-if="line.date_string">{{ line.date_string }}</td>
                <td v-else>(no date)</td>
                <td>
                    <a @click="logSetFilter(line.module)">{{ line.module }}</a>
                </td>
                <td :title="'PID: ' + line.pid">{{ line.level || "UNKNOWN" }}</td>
                <td @click="expandLog(lineIndex)">{{ line.text }}</td>
            </tr>
        </table>
    </div>
</template>

<script lang="ts">
import { useStore } from "@/store";
import { ApiLogResponse } from "@common/Api/Api";
import { ApiLogLine } from "@common/Api/Client";
import { format } from "date-fns";
import { defineComponent } from "vue";

export default defineComponent({
    name: "LogViewer",
    setup() {
        const store = useStore();
        return { store };
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
            watcher: () => {},
        };
    },
    mounted() {
        this.watcher = this.store.$onAction(({ name, store, args, after, onError }) => {
            if (!args) return;
            if (name !== "addLog" && name !== "clearLog") return;
            console.debug("log added, scroll");
            after(() => {
                console.debug("log added, scroll after");
                setTimeout(() => {
                    this.scrollLog();
                }, 100);
            })
        });
        setTimeout(() => {
            this.scrollLog();
        }, 100);
    },
    unmounted() {
        this.watcher(); // remove listener
    },
    methods: {
        async fetchLog(clear = false) {

            console.debug("Fetching log");

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
                response = await this.$http.get(`/api/v0/log/${this.logFilename}/${this.logFromLine}`);
            } catch (error) {
                console.error(error);
                return;
            }

            // console.debug("log data", response.data);

            const data: ApiLogResponse = response.data;

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
});
</script>