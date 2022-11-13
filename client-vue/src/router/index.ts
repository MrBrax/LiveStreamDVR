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
    },
    {
        path: "/vod/:uuid/editor",
        name: "Editor",
        props: true,
        component: () => import(/* webpackChunkName: "editor" */ "../views/EditorView.vue"),
    },
    {
        path: "/tools",
        name: "Tools",
        component: () => import(/* webpackChunkName: "tools" */ "../views/ToolsView.vue"),
    },
    {
        path: "/settings",
        // name: "Settings",
        component: () => import(/* webpackChunkName: "settings" */ "../views/SettingsView.vue"),
        children: [
            {
                path: '',
                redirect: '/settings/channels', // default child path
            },
            {
                path: "/settings/channels/:channel?",
                name: "SettingsChannels",
                component: () => import(/* webpackChunkName: "settingschannels" */ "../views/Settings/SettingsChannels.vue"),
            },
            {
                path: "/settings/newchannel",
                name: "SettingsAddChannel",
                component: () => import(/* webpackChunkName: "settingsaddchannel" */ "../views/Settings/SettingsAddChannel.vue"),
            },
            {
                path: "/settings/config",
                name: "SettingsConfig",
                component: () => import(/* webpackChunkName: "settingsconfig" */ "../views/Settings/SettingsConfig.vue"),
            },
            {
                path: "/settings/keyvalue",
                name: "SettingsKeyvalue",
                component: () => import(/* webpackChunkName: "settingsKeyvalue" */ "../views/Settings/SettingsKeyvalue.vue"),
            },
            {
                path: "/settings/notifications",
                name: "SettingsNotifications",
                component: () => import(/* webpackChunkName: "settingsNotifications" */ "../views/Settings/SettingsNotifications.vue"),
            },
            {
                path: "/settings/favourites",
                name: "SettingsFavourites",
                component: () => import(/* webpackChunkName: "settingsFavourites" */ "../views/Settings/SettingsFavourites.vue"),
            },
            {
                path: "/settings/clientsettings",
                name: "SettingsClientSettings",
                component: () => import(/* webpackChunkName: "settingsClientSettings" */ "../views/Settings/SettingsClientSettings.vue"),
            },
            {
                path: "/settings/tips",
                name: "SettingsTips",
                component: () => import(/* webpackChunkName: "settingsTips" */ "../views/Settings/SettingsTips.vue"),
            },
        ]
    },
    {
        path: "/about",
        name: "About",
        component: () => import(/* webpackChunkName: "about" */ "../views/AboutView.vue"),
    },
    {
        path: "/files",
        name: "Files",
        component: () => import(/* webpackChunkName: "files" */ "../views/FilesView.vue"),
    },

    // catch all 404
    {
        path: "/:pathMatch(.*)*",
        name: "NotFound",
        component: () => import(/* webpackChunkName: "notfound" */ "../views/NotFoundView.vue"),
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
