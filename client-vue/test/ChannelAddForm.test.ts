import { mount } from '@vue/test-utils'
import ChannelAddForm from '../src/components/forms/ChannelAddForm.vue'
import { assert, describe, expect, it, test, vitest } from 'vitest'

import axios from "axios";
import VueAxios from "vue-axios";
import { VideoQualityArray } from '@common/Defs';

// mock $http on vue

test('ChannelAddForm', async () => {
    expect(ChannelAddForm).toBeTruthy();

    const wrapper = mount(ChannelAddForm, {
        global: {
            mocks: {
                $http: {
                    post: vitest.fn((url, data) => {
                        console.log('mock $http.post', url, data);
                        return new Promise((resolve, reject) => {
                            resolve({
                                data: {
                                    status: "OK",
                                    message: "Channel added successfully"
                                }
                            });
                        });
                    }),
                }
            }
        },
    });

    // mock resetForm on vue
    wrapper.vm.resetForm = vitest.fn(() => {
        return;
    });

    // vitest.mock(wrapper.vm.$http, 'post', (url, data) => {

    expect(wrapper.text()).toContain('Channel login, lowercase.');

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

    // validate login
    await wrapper.get('input[name="login"]').setValue('testABC');
    expect(wrapper.get<HTMLInputElement>('input[name="login"]').element.checkValidity()).toBe(false);

    await wrapper.get('input[name="login"]').setValue('test abc');
    expect(wrapper.get<HTMLInputElement>('input[name="login"]').element.checkValidity()).toBe(false);

    await wrapper.get('input[name="login"]').setValue('test');
    expect(wrapper.vm.formData.login).toBe('test');
    expect(wrapper.get<HTMLInputElement>('input[name="login"]').element.checkValidity()).toBe(true);


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

    // check if post was called
    expect(wrapper.vm.$http.post).toHaveBeenCalled();
    expect(wrapper.vm.$http.post).toHaveBeenCalledWith('/api/v0/channels', wrapper.vm.formData);
    expect(wrapper.vm.resetForm).toHaveBeenCalled();

});