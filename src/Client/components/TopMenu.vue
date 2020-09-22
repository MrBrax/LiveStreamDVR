<template>
    <div>
        <div v-for="(streamer) in $store.state.streamerList" v-bind:key="streamer.display_name" class="top-menu-item streamer" :data-streamer="streamer.display_name">
            {{ streamer.display_name }}
        </div>
        <!--
        <router-link to="/">Home</router-link> |
        <router-link to="/about">About</router-link>
        -->
    </div>
</template>

<script lang="ts">


export default {
    name: 'TopMenu',
    props: ['streamerList'],
}
</script>