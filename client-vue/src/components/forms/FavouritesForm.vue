<template>
    <form
        v-if="!loading"
        method="POST"
        enctype="multipart/form-data"
        action="#"
        @submit.prevent="submitForm"
    >
        <div
            v-if="gamesData && favouritesData"
            :class="{favourites_list: true, 'is-grid': isGrid}"
        >
            <div
                v-for="game in sortedGames"
                :key="game.id"
                :class="{favourites_list__item: true, is_active: formData.games.includes(game.id)}"
            >
                <label>
                    <img
                        :src="game.image_url"
                        :alt="game.name"
                        height="20"
                        class="cover"
                    >
                    <span class="input-combo">
                        <input
                            :id="game.id"
                            v-model="formData.games"
                            type="checkbox"
                            :name="game.id"
                            :value="game.id"
                        >
                        <span
                            v-if="game.deleted"
                            class="icon is-error"
                            title="Deleted"
                        >
                            <font-awesome-icon icon="trash" />
                        </span>
                        <span class="game-name">
                            {{ game.name }}
                        </span>
                    </span>
                    <span
                        v-if="game.added"
                        class="game-date"
                    >{{ formatDate(game.added) }}</span>
                    <button
                        type="button"
                        class="icon-button is-small"
                        @click="refreshGame(game.id)"
                    >
                        <font-awesome-icon icon="sync" />
                    </button>
                </label>
            </div>
            <div v-if="!gamesData || Object.keys(gamesData).length == 0">
                <p>{{ t('forms.favourites.no-games-in-cache-when-streamers-change-games-they-will-be-added-to-the-cache') }}</p>
            </div>
        </div>
        <div class="field">
            <label>
                <input
                    v-model="isGrid"
                    type="checkbox"
                >
                {{ t('forms.favourites.display-as-grid') }}
            </label>
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
                    <span>{{ t('buttons.save-favourites') }}</span>
                </button>
            </div>
        </FormSubmit>
    </form>
    <div
        v-else
        class="loading"
    >
        <span class="icon"><fa
            icon="sync"
            spin
        /></span> {{ t("messages.loading") }}
    </div>
</template>

<script lang="ts" setup>
import FormSubmit from "@/components/reusables/FormSubmit.vue";
import { useStore } from "@/store";
import { ApiGamesResponse, ApiSettingsResponse, ApiResponse } from "@common/Api/Api";
import { ApiGame } from "@common/Api/Client";
import axios from "axios";
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { formatDate } from "@/mixins/newhelpers";
import { FormStatus } from "@/twitchautomator";

// emit
const emit = defineEmits(["formSuccess"]);

// setup
const store = useStore();
const { t } = useI18n();
        
// data
const loading = ref<boolean>(false);
const formStatusText = ref<string>("Ready");
const formStatus = ref<FormStatus>("IDLE");
const formData = ref<{ games: string[] }>({ games: [] });
const favouritesData = ref<string[]>([]);
const gamesData = ref<Record<string, ApiGame>>({});
const isGrid = ref<boolean>(false);


const sortedGames = computed((): ApiGame[] => {
    if (!gamesData.value) return [];
    return Object.values(gamesData.value).sort((a, b) => a.name.localeCompare(b.name));
});

onMounted(() => {
    // formData.value.games = favouritesData.value ? [...favouritesData.value] : [];
    console.debug("FavouritesForm mounted", favouritesData.value, formData.value);
    fetchData();
});
    
function submitForm(event: Event) {
    formStatusText.value = t("messages.loading");
    formStatus.value = "LOADING";

    axios
        .put(`/api/v0/favourites`, formData.value)
        .then((response) => {
            const json = response.data;
            formStatusText.value = json.message;
            formStatus.value = json.status;
            // if (json.message) alert(json.message);
            if (json.status == "OK") {
                emit("formSuccess", json);
                fetchData();
            }
        })
        .catch((err) => {
            console.error("form error", err.response);
            if (axios.isAxiosError(err)) {
                const response = err.response;
                if (response) {
                    const json = response.data;
                    formStatusText.value = json.message;
                    formStatus.value = json.status;
                }
            }
        });

    event.preventDefault();
    return false;
}

function fetchData() {
    console.debug("FavouritesForm fetchData");
    loading.value = true;
    axios.all([
        axios.get<ApiGamesResponse>(`api/v0/games`)
        .then((response) => {
            const json = response.data;
            if (json.message) alert(json.message);
            const games = json.data;
            gamesData.value = games;
        })
        .catch((err) => {
            console.error("settings fetch error", err.response);
        }),
        axios
            .get<ApiSettingsResponse>(`api/v0/settings`)
            .then((response) => {
                const json = response.data;
                if (json.message) alert(json.message);
                const favourites = json.data.favourite_games;
                favouritesData.value = favourites;
                formData.value.games = favourites;
                store.updateFavouriteGames(favourites);
            })
            .catch((err) => {
                console.error("settings fetch error", err.response);
            }),
    ]).finally(() => {
        loading.value = false;
    });
}

function refreshGame(id: string) {
    axios
        .get<ApiResponse>(`/api/v0/games/${id}/refresh`)
        .then((response) => {
            const json = response.data;
            if (json.message) alert(json.message);
            if (json.status == "OK") {
                fetchData();
            }
        })
        .catch((err) => {
            console.error("form error", err.response);
        });
}
    
</script>

<style lang="scss" scoped>

.favourites_list {
    max-height: 600px;
    overflow-y: scroll;
    margin-bottom: 1em;

    .favourites_list__item {
        padding: 0.2em 0;
        input {
            margin-right: 0.2em;
        }
        .game-date {
            display: inline-block;
            margin-left: 0.3em;
        }
        &.is_active {
            background-color: rgba(43, 236, 59, 0.1);
        }
    }

    &.is-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        grid-gap: 1rem;
        margin: 1rem 0;
        .favourites_list__item {
            text-align: center;
            .cover {
                height: 96px;
                margin-bottom: 0.5em;
            }
            .game-date {
                display: block;
                margin: 0;
            }
            .input-combo {
                display: block;
            }
            input {
                margin-right: 0.3em;
            }
        }
    }
}

.game-date {
    font-size: 0.8em;
    color: #888;
}
.cover {
    margin: 0 0.3em;
    vertical-align: middle;
}

.icon-button {
    margin-left: 0.5em;
}
</style>