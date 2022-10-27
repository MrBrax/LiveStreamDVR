import { mount } from '@vue/test-utils'
import FavouritesForm from './FavouritesForm.vue'
import { expect, test, vi, vitest } from 'vitest'

import { createPinia } from 'pinia';
import helpers from '@/mixins/helpers';
import { MockApiGamesData } from '@/../test/mockdata';
import axios from 'axios';
import { createI18n } from 'vue-i18n';
import i18n from '@/plugins/i18n';

// mock axios
vi.mock("axios", () => ({
    default: {
        put: vi.fn(() => {
            return new Promise((resolve) => {
                resolve({
                    data: {
                        status: "OK",
                        message: "Favorites updated"
                    }
                });
            });
        }),
    }
}));

test('FavouritesForm', async () => {
    expect(FavouritesForm).toBeTruthy();

    // mock fetchData on FavouritesForm
    const fetchDataSpy = vitest.spyOn(FavouritesForm.methods, "fetchData" as never);
    fetchDataSpy.mockImplementation(() => {
        return;
    });

    const wrapper = mount(FavouritesForm, {
        global: {
            mixins: [helpers],
            plugins: [createPinia(), createI18n(i18n)],
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
    // expect(wrapper.findAll(".favourites_list .checkbox")).toHaveLength(2);
    expect(wrapper.findAll(".favourites_list .favourites_list__item")[0].text()).toContain('Test Game 1');
    expect(wrapper.findAll(".favourites_list .favourites_list__item")[1].text()).toContain('Test Game 2');
    expect(wrapper.findAll(".favourites_list .favourites_list__item input")[0].attributes('name')).toBe('123');

    await wrapper.get('input[name="123"]').setValue();
    expect(wrapper.vm.formData).toEqual({ games: ["123"] });

    await wrapper.get('input[name="123"]').setValue(false);
    await wrapper.get('input[name="456"]').setValue();
    expect(wrapper.vm.formData).toEqual({ games: ["456"] });

    // submit
    await wrapper.find('form').trigger('submit');

    // check if put was called
    expect(axios.put).toHaveBeenCalled();
    expect(axios.put).toHaveBeenCalledWith('/api/v0/favourites', wrapper.vm.formData);

    // expect emit
    expect(wrapper.emitted().formSuccess).toBeTruthy();

});