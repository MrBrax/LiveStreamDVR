<template>
    <form method="POST" enctype="multipart/form-data" action="#" @submit="submitForm">
        <div class="favourites_list" v-if="gamesData && favouritesData">
            <div v-for="game in sortedGames" :key="game.id" class="checkbox">
                <label v-if="favouritesData">
                    <input type="checkbox" :name="game.id" :checked="favouritesData[game.id]" value="1" /> {{ game.name }}
                    <span class="is-gray">{{ formatTimestamp(game.added) }}</span>
                </label>
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
import { ApiGame } from "@/twitchautomator";
import { defineComponent } from "vue";

export default defineComponent({
    name: "FavouritesForm",
    props: {
        favouritesData: {
            type: Object as () => { [key: string]: boolean },
        },
        gamesData: {
            type: Object as () => Record<number, ApiGame>,
        },
    },
    emits: ["formSuccess"],
    data() {
        return {
            formStatusText: "Ready",
            formStatus: "",
            formData: {},
        };
    },
    methods: {
        submitForm(event: Event) {
            const form = event.target as HTMLFormElement;
            const inputs = new FormData(form);

            this.formStatusText = "Loading...";
            this.formStatus = "";

            // console.log("form", form);
            // console.log("entries", inputs, inputs.entries(), inputs.values());
            let data: { games: Record<number, boolean> } = {
                games: {},
            };
            inputs.forEach((value, key) => (data.games[parseInt(key)] = value == "1"));

            this.$http
                .put(`/api/v0/favourites`, data)
                .then((response) => {
                    const json = response.data;
                    this.formStatusText = json.message;
                    this.formStatus = json.status;
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
