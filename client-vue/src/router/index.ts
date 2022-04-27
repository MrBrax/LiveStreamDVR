import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";
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
        path: "/vod/:vod/editor",
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
        path: "/settings/:tab?",
        name: "Settings",
        component: () => import(/* webpackChunkName: "settings" */ "../views/SettingsView.vue"),
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
