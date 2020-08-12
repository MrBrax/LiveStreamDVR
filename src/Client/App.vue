<template>
    <div id="app">
        <div id="nav">
            <top-menu :streamerList="streamerList" />
        </div>
        <router-view/>
    </div>
</template>

<script>

import TopMenu from './components/TopMenu.vue'

export default {
    name: 'App',
    data: function(){
        return {
            test: 'HelloWorld',
            streamerList: [],
            free_size: 0,
            total_size: 0
        }
    },
    mounted(){
        this.$store.dispatch('fetchStreamers');
        // this.refresh();
    },
    components: {
        TopMenu
    },
    methods: {
        refresh(){
            /*
            let server_url = 'http://localhost:8080/api/v0';

            fetch( server_url + "/list").then(response => response.json()).then(data => {
                data = data.data;
                this.streamerList = data.streamerList;
                this.free_size = data.free_size;
                this.total_size = data.total_size;
            });
            */
        }
    }
}
</script>

