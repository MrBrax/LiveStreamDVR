<template>
    <div>
        <div v-for="(streamer) in streamerList" v-bind:key="streamer.username" class="top-menu-item streamer" :data-streamer="streamer.username">
            {{ streamer.username }}
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