<template>
    <div class="not-found-view">
        <h1>404</h1>
        <p class="title-1">
            Page not found
        </p>
        <p class="info">
            This was generated clientside. Endpoint <code>{{ route.fullPath }}</code> does not exist.<br>
            If you think this is a bug (did you not type the URL manually?), please report it to the developers.
        </p>
        <p
            v-if="version"
            class="is-gray"
        >
            Client version {{ version }}/{{ hash }}/{{ date }}
        </p>
        <p>
            <router-link
                to="/"
                class="button is-primary"
            >
                <span class="icon"><font-awesome-icon icon="home" /></span>
                <span>Go to home</span>
            </router-link>
        </p>
    </div>
</template>

<script lang="ts" setup>
import { useStore } from "@/store";
import { faHome } from "@fortawesome/free-solid-svg-icons";
import { library } from "@fortawesome/fontawesome-svg-core";
import { useRoute } from "vue-router";
library.add(faHome);

const store = useStore();
const route = useRoute();

const version = import.meta.env.VITE_APP_VERSION;
const hash = import.meta.env.VITE_APP_GIT_HASH;
const date = import.meta.env.VITE_APP_BUILDDATE;

</script>

<style lang="scss" scoped>
.not-found-view {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    line-height: 1.6em;
    h1 {
        font-size: 5rem;
    }
    .title-1 {
        font-size: 2rem;
    }
    .info {
        font-size: 1rem;
    }
}
</style>