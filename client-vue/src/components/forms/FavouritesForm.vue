<template>
    <form method="POST" enctype="multipart/form-data" action="#" @submit="saveFavourites">
        <div class="favourites_list">
            <div v-for="[id, game] in sortedGames" :key="id" class="checkbox">
                <label>
                    <input type="checkbox" :name="'games[' + id + ']'" :checked="favouritesData[id]"  /> <!-- :checked="$store.state.config.favourites[id]" -->
                    {{ game.name }}
                    <span class="is-gray">{{ formatTimestamp(game.added) }}</span>
                </label>
            </div>
        </div>

        <div class="control">
            <button class="button is-confirm" type="submit">
                <span class="icon"><i class="fa fa-save"></i></span> Save
            </button>
            <span :class="formStatusClass">{{ formStatusText }}</span>
        </div>
    </form>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
    name: "FavouritesForm",
    props: ['favouritesData', 'gamesData'],
    emits: ['formSuccess'],
    data(){
        return {
            formStatusText: 'Ready',
            formStatus: '',
            formData: {}
        }
    },
    methods: {
        saveFavourites( event : Event ){
            
            const form = event.target as HTMLFormElement;
            const inputs = new FormData(form);

            this.formStatusText = 'Loading...';
            this.formStatus = '';

            console.log( "form", form );
            console.log( "entries", inputs, inputs.entries(), inputs.values() );            

            fetch(`/api/v0/favourites/save`, {
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

            event.preventDefault();
            return false;
        }
    },
    computed: {
        formStatusClass() : Record<string, any> {
            return {
                'form-status': true,
                'is-error': this.formStatus == 'ERROR',
                'is-success': this.formStatus == 'OK',
            }
        },
        sortedGames(){
            return Object.entries( (this as any).gamesData ).sort(([, a], [, b]) =>
                (a as any).name.localeCompare((b as any).name)
            );
        }
    }
});

</script>