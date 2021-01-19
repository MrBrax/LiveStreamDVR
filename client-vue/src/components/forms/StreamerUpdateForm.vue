<template>
    <div>
        <form method="POST" enctype="multipart/form-data" action="#" @submit="updateStreamer">
                            
            <input type="hidden" name="username" :value="streamer.username" />
            
            <div class="field">
                <label class="label" :for="'input_' + streamer.username + '_quality'">Quality</label>
                <div class="control">
                    <input class="input input-required" type="text" name="quality" :id="'input_' + streamer.username + '_quality'" :value="streamer.quality.join(' ')" required />
                    <p class="input-help">Separate by spaces, e.g. best 1080p 720p audio_only</p>
                </div>
            </div>

            <div class="field">
                <label class="label" :for="'input_' + streamer.username + '_match'">Match keywords</label>
                <div class="control">
                    <input class="input" type="text" name="match" :id="'input_' + streamer.username + '_match'" :value="streamer.match?.join(', ')" />
                    <p class="input-help">Separate by commas, e.g. christmas,media share,opening,po box</p>
                </div>
            </div>

            <div class="field">
                <label class="checkbox">
                    <input class="input" type="checkbox" name="download_chat" value="1" :checked="streamer.download_chat" />
                    Download chat after video capture is complete
                </label>
            </div>

            <div class="field">
                <label class="checkbox">
                    <input class="input" type="checkbox" name="burn_chat" value="1" :checked="streamer.burn_chat" />
                    Burn chat after downloading
                </label>
            </div>

            <div class="field">
                <div class="control">
                    <button class="button is-confirm" type="submit">
                        <span class="icon"><i class="fa fa-save"></i></span> Save
                    </button>
                    <span :class="formStatusClass">{{ formStatusText }}</span>
                </div>
            </div>

        </form>
        <hr>
        <form>
            <input type="hidden" name="username" :value="streamer.username" />
            <button class="button is-danger" type="submit"><span class="icon"><i class="fa fa-trash"></i></span> Delete</button> (no undo, no confirmation)
        </form>
    </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
    name: "Settings",
    props: ['streamer'],
    emits: ['formSuccess'],
    data(){
        return {
            formStatusText: 'Ready',
            formStatus: ''
        }
    },
    methods: {
        updateStreamer( event : Event ){
            const form = event.target as HTMLFormElement;
            const inputs = new FormData(form);

            this.formStatusText = 'Loading...';
            this.formStatus = '';

            console.log( "form", form );
            console.log( "entries", inputs, inputs.entries(), inputs.values() );

            fetch(`api/v0/channels/update`, {
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
        }
    }
});

</script>