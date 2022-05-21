import { mount } from '@vue/test-utils'
import FavouritesForm from './FavouritesForm.vue'
import { assert, describe, expect, it, test, vitest } from 'vitest'

import axios from "axios";
import VueAxios from "vue-axios";
import { VideoQualityArray } from '@common/Defs';
import { createPinia } from 'pinia';
import { ApiChannelConfig, ApiGame } from '@common/Api/Client';
import helpers from '@/mixins/helpers';
import { MockApiGamesData } from '@/../test/mockdata';

// mock $http on vue

test('FavouritesForm', async () => {
    expect(FavouritesForm).toBeTruthy();

    // mock fetchData on FavouritesForm
    const fetchDataSpy = vitest.spyOn(FavouritesForm.methods, "fetchData" as never);
    fetchDataSpy.mockImplementation(() => {
        return;
    });

    const wrapper = mount(FavouritesForm, {
        global: {
            mocks: {
                $http: {
                    put: vitest.fn((url, data) => {
                        console.log('mock $http.put', url, data);
                        return new Promise((resolve, reject) => {
                            resolve({
                                data: {
                                    status: "OK",
                                    message: "Favorites updated"
                                }
                            });
                        });
                    }),
                },
                $t: vitest.fn((key) => { return key; }),
                $tc: vitest.fn((key, count) => { return key; }),
            },
            mixins: [helpers],
            plugins: [createPinia()],
        },
        props: {
            favouritesData: [],
            gamesData: MockApiGamesData
        }
    });

    wrapper.vm.gamesData = {...MockApiGamesData};
    wrapper.vm.favouritesData = [];

    await wrapper.vm.$nextTick();

    console.debug('wrapper.vm.gamesData', Object.keys(wrapper.vm.gamesData).length);

    // const fetchDataSpy = vitest.spyOn(wrapper.vm, "fetchData");
    // console.log('fetchDataSpy', fetchDataSpy);


    // expect favourites list to have two items
    expect(wrapper.findAll(".favourites_list .checkbox")).toHaveLength(2);
    expect(wrapper.findAll(".favourites_list .checkbox")[0].text()).toContain('Test Game 1');
    expect(wrapper.findAll(".favourites_list .checkbox")[1].text()).toContain('Test Game 2');
    expect(wrapper.findAll(".favourites_list .checkbox input")[0].attributes('name')).toBe('123');

    await wrapper.get('input[name="123"]').setValue();
    expect(wrapper.vm.formData).toEqual({ games: ["123"] });

    await wrapper.get('input[name="123"]').setValue(false);
    await wrapper.get('input[name="456"]').setValue();
    expect(wrapper.vm.formData).toEqual({ games: ["456"] });

    // submit
    await wrapper.find('form').trigger('submit');

    // check if put was called
    expect(wrapper.vm.$http.put).toHaveBeenCalled();
    expect(wrapper.vm.$http.put).toHaveBeenCalledWith('/api/v0/favourites', wrapper.vm.formData);

    // expect emit
    expect(wrapper.emitted().formSuccess).toBeTruthy();

});