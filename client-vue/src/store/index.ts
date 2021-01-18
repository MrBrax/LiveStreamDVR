import { createStore, Store, mapState, StoreOptions } from "vuex";

export default createStore({
    state(){
        // eslint-disable-next-line no-unused-labels
        streamerList: []
    },
    mutations: {
        updateStreamerList(state, data){
            console.log("store update");
            (state as any).streamerList = data;
        }
    },
    actions: {},
    modules: {}
});
