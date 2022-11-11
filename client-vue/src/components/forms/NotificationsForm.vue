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

        <FormSubmit
            :form-status="formStatus"
            :form-status-text="formStatusText"
        >
            <div class="control">
                <button
                    class="button is-confirm"
                    type="submit"
                >
                    <span class="icon"><font-awesome-icon icon="save" /></span>
                    <span>{{ t('buttons.save') }}</span>
                </button>
            </div>
        </FormSubmit>
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

<script lang="ts" setup>
import FormSubmit from "@/components/reusables/FormSubmit.vue";
import { useStore } from "@/store";
import { FormStatus } from "@/twitchautomator";
import { ApiResponse } from "@common/Api/Api";
import axios from "axios";
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { NotificationProvidersList, NotificationCategories } from "../../../../common/Defs";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faSave } from "@fortawesome/free-solid-svg-icons";
library.add(faSave);

// emit
const emit = defineEmits(["formSuccess"]);

// setup
const store = useStore();
const { t } = useI18n();

// data
const formStatusText = ref<string>("Ready");
const formStatus = ref<FormStatus>("IDLE");
const formData = ref<Record<string, Record<string, boolean>>>({});
const test = ref<{ provider: string; category: string }>({ provider: "", category: "" });


onMounted(() => {
    resetBitmask();
    fetchData();
});

    
function resetBitmask() {
    for (const cat of NotificationCategories) {
        formData.value[cat.id] = {};
        for (const provider of NotificationProvidersList) {
            formData.value[cat.id][provider.id] = false;
        }
    }
}

function getBitmasks() {
    const bitmasks: Record<string, number> = {};
    for (const cat in formData.value) {
        bitmasks[cat] = 0;
        for (const provider in formData.value[cat]) {
            if (formData.value[cat][provider]) {
                const providerBit = NotificationProvidersList.find((p) => p.id == parseInt(provider))?.id;
                if (providerBit) {
                    bitmasks[cat] |= providerBit;
                }
            }
        }
    }
    return bitmasks;
}

function setBitmasks(bitmasks: Record<string, number>) {
    for (const cat in bitmasks) {
        for (const provider in formData.value[cat]) {
            const providerBit = NotificationProvidersList.find((p) => p.id == parseInt(provider))?.id;
            if (providerBit) {
                formData.value[cat][provider] = (bitmasks[cat] & providerBit) > 0;
            }
        }
    }
}

function fetchData() {
    axios
        .get<ApiResponse>("/api/v0/notifications")
        .then((response) => {
            const json = response.data;
            if (json.status == "OK") {
                setBitmasks(json.data);
            }
        })
        .catch((err) => {
            console.error("fetch error", err.response);
        });
}

function submitForm(event: Event) {
    const bitmasks = getBitmasks();

    formStatus.value = "LOADING";
    formStatusText.value = t("messages.loading");

    axios
        .put<ApiResponse>(`/api/v0/notifications`, bitmasks)
        .then((response) => {
            const json = response.data;
            console.debug("notifications", json);
            formStatusText.value = json.message || "Unknown";
            formStatus.value = json.status;
            if (json.status == "OK") {
                emit("formSuccess", json);
                fetchData();
            }
        })
        .catch((err) => {
            console.error("form error", err.response);
            if (err.response.data.status == "ERROR") {
                formStatusText.value = err.response.data.message;
                formStatus.value = err.response.data.status;
            } else {
                formStatusText.value = err.response.data;
                formStatus.value = "ERROR";
            }
        });

    event.preventDefault();
    return false;
}

function testNotification() {
    axios
        .post<ApiResponse>(`/api/v0/notifications/test`, {
            provider: test.value.provider,
            category: test.value.category,
        })
        .then((response) => {
            const json = response.data;
            console.debug("notifications", json);
            formStatusText.value = json.message || "Unknown";
            formStatus.value = json.status;
            if (json.status == "OK") {
                emit("formSuccess", json);
                fetchData();
            }
        })
        .catch((err) => {
            console.error("form error", err.response);
            if (err.response.data.status == "ERROR") {
                formStatusText.value = err.response.data.message;
                formStatus.value = err.response.data.status;
            } else {
                formStatusText.value = err.response.data;
                formStatus.value = "ERROR";
            }
        });
}
    
</script>
