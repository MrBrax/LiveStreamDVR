<template>
    <form method="POST" enctype="multipart/form-data" action="#" ref="form" @submit="addStreamer">
        <div class="field">
            <label class="label">Username <span class="required">*</span></label>
            <div class="control">
                <input class="input input-required" type="text" name="username" value="" required />
                <p class="input-help">Streamer username, case sensitive</p>
            </div>
        </div>
        <div class="field">
            <label class="label">Quality <span class="required">*</span></label>
            <div class="control">
                <input class="input input-required" type="text" name="quality" value="" required />
                <p class="input-help">Separate by spaces, e.g. best 1080p 720p audio_only</p>
            </div>
        </div>
        <div class="field">
            <label class="label">Match keywords</label>
            <div class="control">
                <input class="input" type="text" name="match" value="" />
                <p class="input-help">Separate by commas, e.g. christmas,media share,opening,po box</p>
            </div>
        </div>
        <div class="field">
            <label class="checkbox">
                <input type="checkbox" name="download_chat" value="1" />
                Download chat after video capture is complete
            </label>
        </div>
        <div class="field">
            <label class="checkbox">
                <input type="checkbox" name="burn_chat" value="1" />
                Burn chat after downloading
            </label>
        </div>
        <div class="field">
            <div class="control">
                <button class="button is-confirm" type="submit">
                    <span class="icon"><i class="fa fa-user-plus"></i></span> Add
                </button>
                <span :class="formStatusClass">{{ formStatusText }}</span>
            </div>
        </div>
    </form>
</template>

<script lang="ts">
import { defineComponent } from "vue";
// import type { ApiSettingsField, ApiGame } from "@/twitchautomator.d";

export default defineComponent({
    name: "Settings",
    emits: ['formSuccess'],
    data(){
        return {
            formStatusText: 'Ready',
            formStatus: ''
        }
    },
    methods: {
        addStreamer( event : Event ){
            
            const form = event.target as HTMLFormElement;
            const inputs = new FormData(form);

            this.formStatusText = 'Loading...';
            this.formStatus = '';

            console.log( "form", form );
            console.log( "entries", inputs, inputs.entries(), inputs.values() );            

            fetch(`/api/v0/channels/add`, {
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