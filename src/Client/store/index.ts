import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

export default new Vuex.Store({
    state: {
        streamerList: [],
        free_size: 0,
        total_size: 0
    },
    mutations: {
        streamerList(state, value){ state.streamerList = value }
    },
    actions: {
        fetchStreamers(store){
            console.log("fetchStreamers");
            const server_url = 'http://localhost:8080/api/v0';

            fetch( server_url + "/list").then(response => response.json()).then(data => {
                data = data.data;
                store.commit('streamerList', data.streamerList);
                // store.commit('free_size', data.free_size);
                // store.commit('total_size', data.total_size);
            });
        }
    },
    modules: {
    }
})
