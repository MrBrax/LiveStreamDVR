import { mount } from '@vue/test-utils'
import FavouritesForm from './FavouritesForm.vue'
import { assert, describe, expect, it, test, vitest } from 'vitest'

import axios from "axios";
import VueAxios from "vue-axios";
import { VideoQualityArray } from '@common/Defs';
import { createPinia } from 'pinia';
import { ApiChannelConfig, ApiGame } from '@common/Api/Client';
import helpers from '@/mixins/helpers';
import { GamesData } from '@/../test/mockdata';

// mock $http on vue

test('FavouritesForm', async () => {
    expect(FavouritesForm).toBeTruthy();

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
                }
            },
            mixins: [helpers],
            plugins: [createPinia()],
            // plugins: [VueAxios, [axios]],
        },
        props: {
            favouritesData: [],
            gamesData: GamesData
        }
    });

    // expect favourites list to have two items
    expect(wrapper.findAll(".favourites_list .checkbox")).toHaveLength(2);
    expect(wrapper.findAll(".favourites_list .checkbox")[0].text()).toContain('Test Game 1');
    expect(wrapper.findAll(".favourites_list .checkbox")[1].text()).toContain('Test Game 2');
    expect(wrapper.findAll(".favourites_list .checkbox input")[0].attributes('name')).toBe('123');

    await wrapper.get('input[name="123"]').setValue();
    expect(wrapper.vm.formData).toEqual(["123"]);

    await wrapper.get('input[name="123"]').setValue(false);
    await wrapper.get('input[name="456"]').setValue();
    expect(wrapper.vm.formData).toEqual(["456"]);

    // submit
    await wrapper.find('form').trigger('submit');

    // check if put was called
    expect(wrapper.vm.$http.put).toHaveBeenCalled();
    expect(wrapper.vm.$http.put).toHaveBeenCalledWith('/api/v0/favourites', wrapper.vm.formData);

    // expect emit
    expect(wrapper.emitted().formSuccess).toBeTruthy();

});