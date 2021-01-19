<template>
    <form method="POST" enctype="multipart/form-data" action="#" @submit="saveSettings">
        <div class="field" v-for="(data, key) in settingsFields" v-bind:key="key">
            <label v-if="data.type != 'boolean'" class="label" :for="'input_' + key">{{ data.text }}</label>

            <!-- boolean -->
            <div v-if="data.type == 'boolean'" class="control">
                <label class="checkbox">
                    <input type="checkbox" :name="key" :id="'input_' + key" :checked="settingsData[key] !== undefined ? settingsData[key] : data.default" />
                    {{ data.text }}
                </label>
            </div>

            <!-- string -->
            <div v-if="data.type == 'string'" class="control">
                <input class="input" type="text" :name="key" :id="'input_' + key" :value="settingsData[key] !== undefined ? settingsData[key] : data.default" />
            </div>

            <!-- number -->
            <div v-if="data.type == 'number'" class="control">
                <input class="input" type="number" :name="key" :id="'input_' + key" :value="settingsData[key] !== undefined ? settingsData[key] : data.default" />
            </div>

            <!-- array -->
            <div v-if="data.type == 'array'" class="control">
                <!--<input class="input" :name="key" :id="key" :value="settings[key]" />-->
                <select :name="key" :id="'input_' + key">
                    <option v-for="item in data.choices" :key="item" :selected="( settingsData[key] !== undefined && settingsData[key] === item ) || ( settingsData[key] === undefined && item === data.default )">
                        {{ item }}
                    </option>
                </select>
            </div>
            <p v-if="data.help" class="input-help">{{ data.help }}</p>
            <p v-if="data.default" class="input-help">Default: {{ data.default }}</p>
        </div>

        <div class="control">
            <button class="button is-confirm" type="button" @click="saveSettings">
                <span class="icon"><i class="fa fa-save"></i></span> Save
            </button>
            <span :class="formStatusClass">{{ formStatusText }}</span>
        </div>
    </form>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
    name: "Settings",
    props: ['settingsData', 'settingsFields'],
    emits: ['formSuccess'],
    data(){
        return {
            formStatusText: 'Ready',
            formStatus: '',
            formData: {}
        }
    },
    /*
    created: {
        this.formData = this.settingsData;
    },
    */
    methods: {
        saveSettings( event : Event ){
            
            const form = event.target as HTMLFormElement;
            const inputs = new FormData(form);

            this.formStatusText = 'Loading...';
            this.formStatus = '';

            console.log( "form", form );
            console.log( "entries", inputs, inputs.entries(), inputs.values() );            

            fetch(`/api/v0/settings/save`, {
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