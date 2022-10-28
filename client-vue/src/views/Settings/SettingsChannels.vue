<template>
    <section class="section">
        <div class="section-title">
            <h1>{{ t('pages.channels') }}</h1>
        </div>
        <div class="section-content">
            <h1>Channels</h1>
            <ul class="list">
                <li
                    v-for="channel in formChannels"
                    :key="channel.uuid"
                >
                    <router-link :to="{ params: { channel: channel.uuid } }">
                        <span class="icon">
                            <fa :icon="['fab', channel.provider]" />
                        </span>
                        <span>{{ store.channelUUIDToInternalName(channel.uuid) || channel.login || "<<unknown>>" }}</span>
                    </router-link>
                </li>
            </ul>
            <hr>
            <div v-if="formChannel">
                <h1>{{ store.channelUUIDToInternalName(formChannel.uuid) || formChannel.login || "<<unknown>>" }}</h1>
                <channel-update-form
                    :channel="formChannel"
                    @form-success="updateAll"
                />
            </div>
            <span v-if="(!formChannels || formChannels.length == 0) && store.authElement">
                No channels added. Use the tab "New channel" above.</span>
            <div
                v-else-if="!store.authElement"
                class="section-content"
            >
                <span class="icon">
                    <fa icon="sign-in-alt" />
                </span> {{ t("messages.login") }}
            </div>
        </div>
    </section>
</template>

<script lang="ts" setup>
import ChannelUpdateForm from "@/components/forms/ChannelUpdateForm.vue";
import type { ApiSettingsResponse } from "@common/Api/Api";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faUser, faCalendarCheck, faStar, faBell, faUserCog, faDatabase } from "@fortawesome/free-solid-svg-icons";
import { faTwitch, faYoutube } from "@fortawesome/free-brands-svg-icons";
import { useStore } from "@/store";
import { ApiChannelConfig } from "@common/Api/Client";
import { useI18n } from "vue-i18n";
import axios from "axios";
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
library.add(faUser, faCalendarCheck, faStar, faBell, faUserCog, faDatabase, faTwitch, faYoutube);

const store = useStore();
const { t } = useI18n();
const route = useRoute();
const router = useRouter();

// title() {
//     return "Settings - Channels";
// },

const loading = ref(false);
const formChannels = ref<ApiChannelConfig[]>([]);
const currentChannel = ref("");

const formChannel = computed((): ApiChannelConfig | undefined => {
    return formChannels.value.find(c => c.uuid == currentChannel.value);
});

watch(() => route.params.channel, (channel) => {
    currentChannel.value = channel as string;
});

onMounted(() => {
    currentChannel.value = route.params.channel as string;
    fetchData();
});

function fetchData() {
    console.debug("Fetching channels");
    loading.value = true;
    axios
        .get<ApiSettingsResponse>(`api/v0/settings`)
        .then((response) => {
            const json = response.data;
            if (json.message) alert(json.message);
            const channels = json.data.channels;
            /* formChannels.value = */ 
            channels.sort((a, b) => {
                // if (a.provider == "youtube" || b.provider == "youtube") return -1;
                // return a..localeCompare(b.login)
                return store.channelUUIDToInternalName(a.uuid).localeCompare(store.channelUUIDToInternalName(b.uuid));
            });
            formChannels.value = channels;
            if (!currentChannel.value && formChannels.value.length > 0) {
                router.replace({ params: { channel: formChannels.value[0].uuid }});
                // this.currentChannel = formChannels.value[0].uuid;
            }
        })
        .catch((err) => {
            console.error("settings fetch error", err.response);
            if (err.response.data && err.response.data.message) {
                alert(`Settings fetch error: ${err.response.data.message}`);
            } else {
                alert("Error fetching settings");
            }
        }).finally(() => {
            loading.value = false;
        });

}

function updateUsers() {
    store.fetchAndUpdateStreamerList();
}

function updateAll() {
    fetchData();
    updateUsers();
}
    
</script>

<style lang="scss" scoped>

.list {
    list-style: none;
    margin: 0 0 0.8em 0;
    padding: 0;
    li {
        padding: 0.1em 0;
    }
    a {
        display: inline-block;
        // background-color: rgba(128, 128, 128, 0.4);
        // padding: 0.4em 0.8em;
        // margin-bottom: 0.2em;
        // border-radius: 0.5em;
        &.router-link-exact-active {
            color: var(--link-active-color);
            text-shadow: 0 0 5px rgba(255, 255, 255, 0.7);
            // background-color: rgba(128, 128, 128, 0.6);
        }
        .icon {
            vertical-align: middle;
            margin-right: 0.2em;
        }
    }
}

</style>