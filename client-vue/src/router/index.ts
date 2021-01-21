import { createRouter, createWebHashHistory, createWebHistory, RouteRecordRaw } from "vue-router";
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
    // route level code-splitting
    // this generates a separate chunk (about.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    component: () =>
      import(/* webpackChunkName: "editor" */ "../views/Editor.vue")
  },
  {
    path: "/tools",
    name: "Tools",
    // route level code-splitting
    // this generates a separate chunk (about.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    component: () =>
      import(/* webpackChunkName: "tools" */ "../views/Tools.vue")
  },
  {
    path: "/settings",
    name: "Settings",
    // route level code-splitting
    // this generates a separate chunk (about.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    component: () =>
      import(/* webpackChunkName: "settings" */ "../views/Settings.vue")
  },
  {
    path: "/clientsettings",
    name: "ClientSettings",
    // route level code-splitting
    // this generates a separate chunk (about.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    component: () =>
      import(/* webpackChunkName: "clientsettings" */ "../views/ClientSettings.vue")
  },
  {
    path: "/about",
    name: "About",
    // route level code-splitting
    // this generates a separate chunk (about.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    component: () =>
      import(/* webpackChunkName: "about" */ "../views/About.vue")
  }
];

const router = createRouter({
    // history: createWebHashHistory(),
    history: createWebHistory(process.env.BASE_URL),
    // history: createWebHistory((window as any).BASE_URL),
    routes,
    scrollBehavior(to, from, savedPosition){
        if (savedPosition) {
            return savedPosition;
        } else {
            return { x: 0, y: 0 } as any;
        }
    }, 
});

export default router;
