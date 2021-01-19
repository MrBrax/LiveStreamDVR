<template>
    <form method="POST" @submit="submitForm">

        <div class="field">
            <label class="label">VOD URL</label>
            <div class="control">
                <input class="input input-required" type="text" name="url" value="" />
            </div>
        </div>

        <div class="field">
            <div class="control">
                <button class="button is-confirm" type="submit"><span class="icon"><i class="fa fa-download"></i></span> Execute</button>
                <span :class="formStatusClass">{{ formStatusText }}</span>
            </div>
        </div>

        <div class="field" v-if="fileLink">
            <a :href="fileLink">{{ fileLink }}</a>
        </div>

    </form>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
    name: "ToolsVodDownloadForm",
    emits: ['formSuccess'],
    data(){
        return {
            formStatusText: 'Ready',
            formStatus: '',
            fileLink: ''
        }
    },
    methods: {
        submitForm( event : Event ){
            
            const form = event.target as HTMLFormElement;
            const inputs = new FormData(form);

            this.formStatusText = 'Loading...';
            this.formStatus = '';

            console.log( "form", form );
            console.log( "entries", inputs, inputs.entries(), inputs.values() );            

            fetch(`api/v0/tools/chatdownload`, {
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
                if(json.data && json.data.web_path){
                    this.fileLink = json.data.web_path;
                }
            }).catch((err) => {
                console.error("Error burn form", err);
                this.formStatusText = err;
                this.formStatus = 'ERROR';
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