<template>
    <form @submit.prevent="submitForm">
        <div class="field">
            <table class="table is-fullwidth is-striped is-hoverable">
                <thead>
                    <tr>
                        <th>Category</th>
                        <th colspan="999">
                            Providers
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="cat in NotificationCategories"
                        :key="cat.id"
                    >
                        <td>{{ cat.name }}</td>
                        <td
                            v-for="provider in NotificationProvidersList"
                            :key="provider.id"
                        >
                            <label
                                v-if="formData[cat.id] !== undefined"
                                class="checkbox"
                            >
                                <input
                                    v-model="formData[cat.id][provider.id]"
                                    type="checkbox"
                                    :value="provider.id"
                                >
                                {{ provider.name }}
                            </label>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="field form-submit">
            <div class="control">
                <button
                    class="button is-confirm"
                    type="submit"
                >
                    <span class="icon"><fa icon="save" /></span>
                    <span>{{ t('buttons.save') }}</span>
                </button>
            </div>
            <div :class="formStatusClass">
                {{ formStatusText }}
            </div>
        </div>
    </form>
    <hr>
    <div>
        <h2 class="title is-2">Test</h2>
        <!--
        <div class="select">
            <select v-model="test.provider">
                <option
                    v-for="provider in NotificationProvidersList"
                    :key="provider.id"
                    :value="provider.id"
                >
                    {{ provider.name }}
                </option>
            </select>
        </div>
        -->
        <div class="field">
            <div class="select">
                <select v-model="test.category">
                    <option
                        v-for="cat in NotificationCategories"
                        :key="cat.id"
                        :value="cat.id"
                    >
                        {{ cat.name }}
                    </option>
                </select>
            </div>
        </div>
        <button
            class="button is-confirm"
            @click="testNotification"
        >Test</button>
    </div>
</template>

<script lang="ts">
import { useStore } from "@/store";
import { ApiResponse } from "@common/Api/Api";
import axios from "axios";
import { defineComponent } from "vue";
import { useI18n } from "vue-i18n";
import { NotificationProvider, NotificationProvidersList, NotificationCategories } from "../../../../common/Defs";

export default defineComponent({
    name: "NotificationsForm",
    emits: ["formSuccess"],
    // props: {},
    setup() {
        const store = useStore();
        const { t } = useI18n();
        return { store, NotificationProvider, NotificationProvidersList, NotificationCategories, t };
    },
    data(): {
        formStatusText: string;
        formStatus: string;
        formData: Record<string, Record<string, boolean>>;
        test: {
            provider: string;
            category: string;
        };
    } {
        return {
            formStatusText: "Ready",
            formStatus: "",
            formData: {},
            test: {
                provider: "",
                category: "",
            },
        };
    },
    computed: {
        formStatusClass(): Record<string, boolean> {
            return {
                "form-status": true,
                "is-error": this.formStatus == "ERROR",
                "is-success": this.formStatus == "OK",
            };
        },
    },
    mounted(): void {
        this.resetBitmask();
        this.fetchData();
    },
    methods: {
        resetBitmask() {
            for (const cat of this.NotificationCategories) {
                this.formData[cat.id] = {};
                for (const provider of NotificationProvidersList) {
                    this.formData[cat.id][provider.id] = false;
                }
            }
        },
        getBitmasks() {
            const bitmasks: Record<string, number> = {};
            for (const cat in this.formData) {
                bitmasks[cat] = 0;
                for (const provider in this.formData[cat]) {
                    if (this.formData[cat][provider]) {
                        const providerBit = NotificationProvidersList.find((p) => p.id == parseInt(provider))?.id;
                        if (providerBit) {
                            bitmasks[cat] |= providerBit;
                        }
                    }
                }
            }
            return bitmasks;
        },
        setBitmasks(bitmasks: Record<string, number>) {
            for (const cat in bitmasks) {
                for (const provider in this.formData[cat]) {
                    const providerBit = NotificationProvidersList.find((p) => p.id == parseInt(provider))?.id;
                    if (providerBit) {
                        this.formData[cat][provider] = (bitmasks[cat] & providerBit) > 0;
                    }
                }
            }
        },
        fetchData() {
            axios
                .get<ApiResponse>("/api/v0/notifications")
                .then((response) => {
                    const json = response.data;
                    if (json.status == "OK") {
                        this.setBitmasks(json.data);
                    }
                })
                .catch((err) => {
                    console.error("fetch error", err.response);
                });
        },
        submitForm(event: Event) {
            // convert record to bitmask with enum
            const bitmasks = this.getBitmasks();
            console.debug("bitmasks", bitmasks);

            axios
                .put<ApiResponse>(`/api/v0/notifications`, bitmasks)
                .then((response) => {
                    const json = response.data;
                    console.debug("notifications", json);
                    this.formStatusText = json.message || "Unknown";
                    this.formStatus = json.status;
                    if (json.status == "OK") {
                        this.$emit("formSuccess", json);
                        this.fetchData();
                    }
                })
                .catch((err) => {
                    console.error("form error", err.response);
                    if (err.response.data.status == "ERROR") {
                        this.formStatusText = err.response.data.message;
                        this.formStatus = err.response.data.status;
                    } else {
                        this.formStatusText = err.response.data;
                        this.formStatus = "ERROR";
                    }
                });

            event.preventDefault();
            return false;
        },
        testNotification() {
            axios
                .post(`/api/v0/notifications/test`, {
                    provider: this.test.provider,
                    category: this.test.category,
                })
                .then((response) => {
                    const json: ApiResponse = response.data;
                    console.debug("notifications", json);
                    this.formStatusText = json.message || "Unknown";
                    this.formStatus = json.status;
                    if (json.status == "OK") {
                        this.$emit("formSuccess", json);
                        this.fetchData();
                    }
                })
                .catch((err) => {
                    console.error("form error", err.response);
                    if (err.response.data.status == "ERROR") {
                        this.formStatusText = err.response.data.message;
                        this.formStatus = err.response.data.status;
                    } else {
                        this.formStatusText = err.response.data;
                        this.formStatus = "ERROR";
                    }
                });
        },
    },
});
</script>
