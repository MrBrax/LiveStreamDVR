<template>
    <div v-if="!initialLoad">
        <p class="error">
            {{ $t('messages.changing-values-here-will-most-likely-require-a-restart') }}
        </p>
        <transition-group
            name="list"
            tag="table"
            class="table is-fullwidth is-striped is-hoverable"
            v-if="keyvalue && Object.keys(keyvalue).length > 0"
        >
            <thead key="header">
                <tr>
                    <th>Key</th>
                    <th>Value</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tr v-for="(value, key) in sortedKeyValues" :key="key">
                <td>{{ key }}</td>
                <td>
                    {{ value }}
                    <button class="icon-button" @click="editKeyValue(key, value)">
                        <span><fa icon="pencil" /></span>
                    </button>
                </td>
                <td>
                    <button class="button is-danger is-small" @click="deleteKeyValue(key)">
                        <span class="icon"><fa icon="trash" /></span>
                        <span>{{ $t('buttons.delete') }}</span>
                    </button>
                </td>
            </tr>
            <tr key="deleteall">
                <td colspan="999">
                    <button class="button is-danger" @click="deleteAllKeyValues">
                        <span class="icon"><fa icon="trash" /></span>
                        <span>{{ $t('buttons.delete-all') }}</span>
                    </button>
                </td>
            </tr>
        </transition-group>
        <p v-else>No key-value data found.</p>

        <hr />

        <form @submit.prevent="doAdd">
            <div class="field">
                <label for="key" class="label">{{ $t('forms.keyvalue.key') }}</label>
                <div class="control">
                    <input class="input" type="text" id="key" v-model="addForm.key" />
                </div>
            </div>
            <div class="field">
                <label for="value" class="label">{{ $t('forms.keyvalue.value') }}</label>
                <div class="control">
                    <input class="input" type="text" id="value" v-model="addForm.value" />
                </div>
                <p class="input-help">The value will be stored as a string, and depending on how it is used, it might be converted to another type.</p>
            </div>
            <div class="field">
                <div class="control">
                    <button class="button is-confirm" type="submit">
                        <span class="icon"><fa icon="plus"></fa></span>
                        <span>{{ $t('buttons.create') }}</span>
                    </button>
                </div>
            </div>
        </form>
    </div>
    <div v-if="initialLoad">
        <span class="icon"><fa icon="sync" spin></fa></span> Loading...
    </div>
</template>

<script lang="ts">
import { useStore } from "@/store";
import { defineComponent, PropType } from "vue";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faPencil, faSync, faTrash, faPlus } from "@fortawesome/free-solid-svg-icons";
library.add(faPencil, faSync, faTrash, faPlus);

export default defineComponent({
    name: "KeyValueForm",
    setup() {
        const store = useStore();
        return { store };
    },
    emits: ["formSuccess"],
    data(): {
        keyvalue?: Record<string, string>;
        initialLoad: boolean;
        addForm: {
            key: string;
            value: string;
        }
    } {
        return {
            keyvalue: undefined,
            initialLoad: true,
            addForm: {
                key: "",
                value: ""
            }
        };
    },
    mounted(): void {
        this.fetchData();
    },

    methods: {
        fetchData(): void {
            this.$http
                .get(`/api/v0/keyvalue`)
                .then((response) => {
                    const json = response.data;
                    const kv = json.data;
                    // console.debug("kv", kv);
                    this.keyvalue = kv;
                })
                .catch((err) => {
                    console.error("fetch data error", err.response);
                })
                .finally(() => {
                    this.initialLoad = false;
                });
        },
        deleteKeyValue(key: string) {
            this.$http
                .delete(`/api/v0/keyvalue/${key}`)
                .then((response) => {
                    const json = response.data;
                    console.debug("deleteKeyValue", json);
                    // alert(`Deleted key ${key}`);
                    this.fetchData();
                })
                .catch((err) => {
                    console.error("delete error", err.response);
                });
        },
        deleteAllKeyValues() {
            this.$http
                .delete(`/api/v0/keyvalue`)
                .then((response) => {
                    const json = response.data;
                    console.debug("deleteAllKeyValues", json);
                    alert(`Deleted all key values`);
                    this.fetchData();
                })
                .catch((err) => {
                    console.error("delete all error", err.response);
                });
        },
        editKeyValue(key: string, value: string) {
            const new_value = prompt(`Edit value for key ${key}`, value);
            if (!new_value || new_value == value) return;
            this.$http
                .put(`/api/v0/keyvalue/${key}`, { value: new_value })
                .then((response) => {
                    const json = response.data;
                    console.debug("editKeyValue", json);
                    this.fetchData();
                })
                .catch((err) => {
                    console.error("edit error", err.response);
                    if (err.response && err.response.data && err.response.data.message) {
                        alert(err.response.data.message);
                    }
                });
        }, 
        doAdd() {
            this.$http
                .put(`/api/v0/keyvalue/${this.addForm.key}`, { value: this.addForm.value })
                .then((response) => {
                    const json = response.data;
                    console.debug("doAdd", json);
                    this.fetchData();
                    this.addForm.key = "";
                    this.addForm.value = "";
                    // this.$emit("formSuccess");
                }).catch((err) => {
                    console.error("add error", err.response);
                    if (err.response && err.response.data && err.response.data.message) {
                        alert(err.response.data.message);
                    }
                });
        },       
    },
    computed: {
        sortedKeyValues(): Record<string, string> {
            if (!this.keyvalue) return {};
            return Object.fromEntries(Object.entries(this.keyvalue).sort());
        }       
    },
});
</script>
