import { createRouter, createWebHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";
import Dashboard from "../views/DashboardView.vue";

const routes: Array<RouteRecordRaw> = [
    {
        path: "/",
        name: "Index",
        redirect: "/dashboard",
    },
    {
        path: "/dashboard",
        name: "Dashboard",
        component: Dashboard,
        meta: {
            title: "Dashboard",
        },
    },
    {
        path: "/vod/:uuid/editor",
        name: "Editor",
        props: true,
        component: () => import(/* webpackChunkName: "editor" */ "../views/EditorView.vue"),
        meta: {
            title: "Editor",
        },
    },
    {
        path: "/tools",
        name: "Tools",
        component: () => import(/* webpackChunkName: "tools" */ "../views/ToolsView.vue"),
        meta: {
            title: "Tools",
        },
    },
    {
        path: "/settings",
        // name: "Settings",
        component: () => import(/* webpackChunkName: "settings" */ "../views/SettingsView.vue"),
        meta: {
            title: "Settings",
        },
        children: [
            {
                path: "",
                redirect: "/settings/channels", // default child path
            },
            {
                path: "/settings/channels/:channel?",
                name: "SettingsChannels",
                component: () => import(/* webpackChunkName: "settingschannels" */ "../views/Settings/SettingsChannels.vue"),
                meta: {
                    title: "Settings - Channels",
                },
            },
            {
                path: "/settings/newchannel",
                name: "SettingsAddChannel",
                component: () => import(/* webpackChunkName: "settingsaddchannel" */ "../views/Settings/SettingsAddChannel.vue"),
                meta: {
                    title: "Settings - Add Channel",
                },
            },
            {
                path: "/settings/config",
                name: "SettingsConfig",
                component: () => import(/* webpackChunkName: "settingsconfig" */ "../views/Settings/SettingsConfig.vue"),
                meta: {
                    title: "Settings - Config",
                },
            },
            {
                path: "/settings/keyvalue",
                name: "SettingsKeyvalue",
                component: () => import(/* webpackChunkName: "settingsKeyvalue" */ "../views/Settings/SettingsKeyvalue.vue"),
                meta: {
                    title: "Settings - KeyValue",
                }
            },
            {
                path: "/settings/notifications",
                name: "SettingsNotifications",
                component: () => import(/* webpackChunkName: "settingsNotifications" */ "../views/Settings/SettingsNotifications.vue"),
                meta: {
                    title: "Settings - Notifications",
                },
            },
            {
                path: "/settings/favourites",
                name: "SettingsFavourites",
                component: () => import(/* webpackChunkName: "settingsFavourites" */ "../views/Settings/SettingsFavourites.vue"),
                meta: {
                    title: "Settings - Favourites",
                },
            },
            {
                path: "/settings/clientsettings",
                name: "SettingsClientSettings",
                component: () => import(/* webpackChunkName: "settingsClientSettings" */ "../views/Settings/SettingsClientSettings.vue"),
                meta: {
                    title: "Settings - Client Settings",
                },
            },
            {
                path: "/settings/tips",
                name: "SettingsTips",
                component: () => import(/* webpackChunkName: "settingsTips" */ "../views/Settings/SettingsTips.vue"),
                meta: {
                    title: "Settings - Tips",
                },
            },
        ]
    },
    {
        path: "/about",
        name: "About",
        component: () => import(/* webpackChunkName: "about" */ "../views/AboutView.vue"),
        meta: {
            title: "About",
        },
    },
    {
        path: "/files",
        name: "Files",
        component: () => import(/* webpackChunkName: "files" */ "../views/FilesView.vue"),
        meta: {
            title: "Files",
        },
    },

    {
        path: "/vodplayer",
        name: "VODPlayer",
        component: () => import(/* webpackChunkName: "files" */ "../views/VodPlayerView.vue"),
        meta: {
            title: "VODPlayer",
        },
    },

    // catch all 404
    {
        path: "/:pathMatch(.*)*",
        name: "NotFound",
        component: () => import(/* webpackChunkName: "notfound" */ "../views/NotFoundView.vue"),
        meta: {
            title: "404 - Not Found",
        },
    },
];

const router = createRouter({
    // history: createWebHashHistory(),
    history: createWebHistory(import.meta.env.BASE_URL),
    // history: createWebHistory((window as any).BASE_URL),
    routes,
    scrollBehavior(to, from, savedPosition) {
        if (to.hash) {
            return {
                el: to.hash,
            };
        }
        if (savedPosition) {
            return savedPosition;
        } else {
            return { top: 0, left: 0 };
        }
    },
});

export default router;
