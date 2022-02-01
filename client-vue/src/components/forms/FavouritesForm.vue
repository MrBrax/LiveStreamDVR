<template>
    <form method="POST" enctype="multipart/form-data" action="#" @submit="submitForm">
        <div class="favourites_list" v-if="gamesData">
            <div v-for="[id, game] in sortedGames" :key="id" class="checkbox">
                <label>
                    <input type="checkbox" :name="'games[' + id + ']'" :checked="favouritesData[id]" /> {{ game.name }}
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
    props: ["favouritesData", "gamesData"],
    emits: ["formSuccess"],
    data() {
        return {
            formStatusText: "Ready",
            formStatus: "",
            formData: {},
            sortedGames: [] as any,
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
            let data: Record<string, unknown> = {};
            inputs.forEach((value, key) => (data[key] = value));

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

            /*
            fetch(`api/v0/favourites/save`, {
                method: 'POST',
                body: inputs
            })
            .then((response) => response.json())
            .then((json) => {
                this.formStatusText = json.message;
                this.formStatus = json.status;
                if(json.status == 'OK'){
                    this.$emit('formSuccess', json);
                }
            }).catch((test) => {
                console.error("Error", test);
            });
            */

            event.preventDefault();
            return false;
        },
    },
    watch: {
        gamesData() {
            this.sortedGames = Object.entries(this.gamesData as Record<number, ApiGame>).sort(([, a], [, b]) => a.name.localeCompare(b.name));
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
    },
});
</script>
