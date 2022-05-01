import { mount } from '@vue/test-utils'
import ChannelUpdateForm from './ChannelUpdateForm.vue'
import { assert, describe, expect, it, test, vitest } from 'vitest'

import axios from "axios";
import VueAxios from "vue-axios";
import { VideoQualityArray } from '@common/Defs';
import { createPinia } from 'pinia';
import { ApiChannelConfig } from '@common/Api/Client';

// mock $http on vue

test('ChannelUpdateForm', async () => {
    expect(ChannelUpdateForm).toBeTruthy();

    const wrapper = mount(ChannelUpdateForm, {
        global: {
            mocks: {
                $http: {
                    put: vitest.fn((url, data) => {
                        console.log('mock $http.put', url, data);
                        return new Promise((resolve, reject) => {
                            resolve({
                                data: {
                                    status: "OK",
                                    message: "Channel updated successfully"
                                }
                            });
                        });
                    }),
                }
            },
            plugins: [createPinia()],
        },
        props: {
            channel: {
                login: "test123",
                match: ["match"],
                quality: ["best", "720p"],
                download_chat: true,
                no_capture: false,
                burn_chat: true,
                live_chat: false,
            } as ApiChannelConfig,
        }
    });

    // vitest.mock(wrapper.vm.$http, 'post', (url, data) => {

    // vitest.fn(wrapper.vm.store, 'fetchAndUpdateStreamerList', (a: any, b: any) => {
    //     return;
    // });

    vitest.spyOn(wrapper.vm.store, 'fetchAndUpdateStreamerList');

    expect(wrapper.text()).toContain('Separate by spaces, e.g. best 1080p 720p audio_only');

    // wrapper.vm.$http.post.mockResolvedValue(wrapper.vm.formData);

    /*
        name="login"
        name="quality"
        name="match"
        name="download_chat"
        name="live_chat"
        name="burn_chat"
        name="no_capture"
    */

    // validate quality
    const input_quality = wrapper.get<HTMLInputElement>('input[name="quality"]');
    await input_quality.setValue('721p');
    await input_quality.trigger('blur');
    expect(wrapper.vm.formData.quality).toBe('721p');
    expect(input_quality.element.checkValidity()).toBe(false);

    const v = VideoQualityArray.join(' ');
    await input_quality.setValue(v);
    await input_quality.trigger('blur');
    expect(wrapper.vm.formData.quality).toBe(v);
    expect(input_quality.element.checkValidity()).toBe(true);

    // validate match
    await wrapper.get('input[name="match"]').setValue('test');
    expect(wrapper.vm.formData.match).toBe('test');

    // validate download_chat
    await wrapper.get('input[name="download_chat"]').setValue();
    expect(wrapper.vm.formData.download_chat).toBe(true);

    // validate live_chat
    await wrapper.get('input[name="live_chat"]').setValue();
    expect(wrapper.vm.formData.live_chat).toBe(true);

    // validate burn_chat
    await wrapper.get('input[name="burn_chat"]').setValue();
    expect(wrapper.vm.formData.burn_chat).toBe(true);

    // validate no_capture
    await wrapper.get('input[name="no_capture"]').setValue();
    expect(wrapper.vm.formData.no_capture).toBe(true);

    // submit
    await wrapper.find('form').trigger('submit');
    // await wrapper.find('button[type="submit"]').trigger('click');

    // check if put was called
    expect(wrapper.vm.$http.put).toHaveBeenCalled();
    expect(wrapper.vm.$http.put).toHaveBeenCalledWith('/api/v0/channels/test123', wrapper.vm.formData);
    // expect(wrapper.vm.resetForm).toHaveBeenCalled();
    expect(wrapper.vm.store.fetchAndUpdateStreamerList).toHaveBeenCalled();

});