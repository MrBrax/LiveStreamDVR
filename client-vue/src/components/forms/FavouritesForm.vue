<template>
    <form
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
                            <fa icon="trash" />
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
                        <fa icon="sync" />
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
        <div class="field form-submit">
            <div class="control">
                <button
                    class="button is-confirm"
                    type="submit"
                >
                    <span class="icon"><fa icon="save" /></span>
                    <span>{{ t('buttons.save-favourites') }}</span>
                </button>
            </div>
            <div :class="formStatusClass">
                {{ formStatusText }}
            </div>
        </div>
    </form>
</template>

<script lang="ts">
import { useStore } from "@/store";
import { ApiGamesResponse, ApiSettingsResponse } from "@common/Api/Api";
import { ApiGame } from "@common/Api/Client";
import { defineComponent } from "vue";
import { useI18n } from "vue-i18n";

export default defineComponent({
    name: "FavouritesForm",
    emits: ["formSuccess"],
    setup() {
        const store = useStore();
        const { t } = useI18n();
        return { store, t };
    },
    data(): {
        loading: boolean;
        formStatusText: string;
        formStatus: string;
        formData: {
            games: string[];
        },
        favouritesData: string[];
        gamesData: Record<string, ApiGame>;
        isGrid: boolean;
    } {
        return {
            loading: false,
            formStatusText: "Ready",
            formStatus: "",
            formData: {
                games: [],
            },
            favouritesData: [],
            gamesData: {},
            isGrid: false,
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
        sortedGames(): ApiGame[] {
            if (!this.gamesData) return [];
            return Object.values(this.gamesData).sort((a, b) => a.name.localeCompare(b.name));
        },
    },
    mounted() {
        // this.formData.games = this.favouritesData ? [...this.favouritesData] : [];
        console.debug("FavouritesForm mounted", this.favouritesData, this.formData);
        this.fetchData();
    },
    methods: {
        submitForm(event: Event) {
            this.formStatusText = this.t("messages.loading");
            this.formStatus = "";

            this.$http
                .put(`/api/v0/favourites`, this.formData)
                .then((response) => {
                    const json = response.data;
                    this.formStatusText = json.message;
                    this.formStatus = json.status;
                    // if (json.message) alert(json.message);
                    if (json.status == "OK") {
                        this.$emit("formSuccess", json);
                        this.fetchData();
                    }
                })
                .catch((err) => {
                    console.error("form error", err.response);
                });

            event.preventDefault();
            return false;
        },
        fetchData() {
            console.debug("FavouritesForm fetchData");
            this.$http.all([
                this.$http.get(`api/v0/games`)
                .then((response) => {
                    const json: ApiGamesResponse = response.data;
                    if (json.message) alert(json.message);
                    const games = json.data;
                    this.gamesData = games;
                })
                .catch((err) => {
                    console.error("settings fetch error", err.response);
                }).finally(() => {
                    this.loading = false;
                }),
                this.$http
                    .get(`api/v0/settings`)
                    .then((response) => {
                        const json: ApiSettingsResponse = response.data;
                        if (json.message) alert(json.message);
                        const favourites = json.data.favourite_games;
                        this.favouritesData = favourites;
                        this.formData.games = favourites;
                        this.store.updateFavouriteGames(favourites);
                    })
                    .catch((err) => {
                        console.error("settings fetch error", err.response);
                    }),
            ]).finally(() => {
                this.loading = false;
            });
        },
        refreshGame(id: string) {
            this.$http
                .get(`/api/v0/games/${id}/refresh`)
                .then((response) => {
                    const json = response.data;
                    if (json.message) alert(json.message);
                    if (json.status == "OK") {
                        this.fetchData();
                    }
                })
                .catch((err) => {
                    console.error("form error", err.response);
                });
        },
    },
});
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