<template>
    <form method="POST" enctype="multipart/form-data" action="#" @submit.prevent="submitForm">
        <div class="favourites_list" v-if="gamesData && favouritesData">
            <div v-for="game in sortedGames" :key="game.id" class="checkbox">
                <label>
                    <input
                        type="checkbox"
                        :name="game.id"
                        :value="game.id"
                        :id="game.id"
                        v-model="formData"
                    /> {{ game.name }}
                    <span class="game-date">{{ formatDate(game.added) }}</span>
                </label>
            </div>
            <div v-if="!gamesData || gamesData.length == 0">
                <p>No games in cache. When streamers change games, they will be added to the cache.</p>
            </div>
        </div>
        <br />
        <div class="control">
            <button class="button is-confirm" type="submit">
                <span class="icon"><fa icon="save"></fa></span> Save
            </button>
            <span :class="formStatusClass">{{ formStatusText }}</span>
        </div>
    </form>
</template>

<script lang="ts">
import { ApiGame } from "@common/Api/Client";
import { defineComponent } from "vue";

export default defineComponent({
    name: "FavouritesForm",
    props: {
        favouritesData: {
            type: Array as () => string[],
        },
        gamesData: {
            type: Object as () => Record<string, ApiGame>,
        },
    },
    emits: ["formSuccess"],
    data() {
        return {
            formStatusText: "Ready",
            formStatus: "",
            formData: this.favouritesData?.slice() ?? [],
        };
    },
    methods: {
        submitForm(event: Event) {
            this.formStatusText = "Loading...";
            this.formStatus = "";

            this.$http
                .put(`/api/v0/favourites`, this.formData)
                .then((response) => {
                    const json = response.data;
                    this.formStatusText = json.message;
                    this.formStatus = json.status;
                    if (json.message) alert(json.message);
                    if (json.status == "OK") {
                        this.$emit("formSuccess", json);
                    }
                })
                .catch((err) => {
                    console.error("form error", err.response);
                });

            event.preventDefault();
            return false;
        },
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
});
</script>

<style lang="scss">
.game-date {
    font-size: 0.8em;
    color: #888;
}
</style>