import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";
import Dashboard from "../views/Dashboard.vue";

const routes: Array<RouteRecordRaw> = [
    {
        path: "/",
        name: "Index",
        redirect: "/dashboard"
    },
    {
        path: "/dashboard",
        name: "Dashboard",
        component: Dashboard
    },
    {
        path: "/vod/:vod/editor",
        name: "Editor",
        props: true,
        component: () =>
            import(/* webpackChunkName: "editor" */ "../views/Editor.vue")
    },
    {
        path: "/tools",
        name: "Tools",
        component: () =>
            import(/* webpackChunkName: "tools" */ "../views/Tools.vue")
    },
    {
        path: "/settings/:tab?",
        name: "Settings",
        component: () =>
            import(/* webpackChunkName: "settings" */ "../views/Settings.vue")
    },
    {
        path: "/clientsettings",
        name: "ClientSettings",
        component: () =>
            import(/* webpackChunkName: "clientsettings" */ "../views/ClientSettings.vue")
    },
    {
        path: "/about",
        name: "About",
        component: () =>
            import(/* webpackChunkName: "about" */ "../views/About.vue")
    }
];

const router = createRouter({
    // history: createWebHashHistory(),
    history: createWebHistory(process.env.BASE_URL),
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
            return { x: 0, y: 0 } as any;
        }
    },
});

export default router;
