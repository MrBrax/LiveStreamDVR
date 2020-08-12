<template>
    <div class="dashboard">
        <div v-for="(streamer) in $store.state.streamerList" v-bind:key="streamer.username" class="streamer-box" :data-streamer="streamer.username">
            
        </div>
        <strong>Free size:</strong> {{ $root.free_size }}.
    </div>
</template>

<script>

export default {
    name: 'Dashboard',
    mounted(){
        console.log( this.data );
        console.log( this.free_size );
        console.log( this.$route );
    },
}
</script>
