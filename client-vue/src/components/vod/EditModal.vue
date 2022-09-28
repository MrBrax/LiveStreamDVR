<template>
    <div class="field">
        <label
            class="label"
            for="absolute-season"
        >{{ $t('vod.edit.absolute-season') }}</label>
        <div class="control">
            <input
                id="absolute-season"
                v-model.number="editVodSettings.absolute_season"
                class="input"
                type="number"
            >
        </div>
    </div>
    <div class="field">
        <label
            class="label"
            for="stream-number"
        >{{ $t('vod.edit.stream-number') }}</label>
        <div class="control">
            <input
                id="stream-number"
                v-model.number="editVodSettings.stream_number"
                class="input"
                type="number"
            >
        </div>
    </div>
    <div class="field">
        <label
            class="label"
            for="comment"
        >{{ $t('vod.edit.comment') }}</label>
        <div class="control">
            <textarea
                id="comment"
                v-model="editVodSettings.comment"
                class="input textarea"
            />
        </div>
    </div>
    <div class="field">
        <label
            class="label"
            for="segments"
        >{{ $t('vod.edit.segments') }}</label>
        <div class="control">
            <textarea
                id="segments"
                v-model="editVodSettings.segments"
                class="input textarea"
            />
        </div>
    </div>
    <div class="field">
        <div class="control">
            <label class="checkbox">
                <input
                    v-model="editVodSettings.prevent_deletion"
                    type="checkbox"
                >
                {{ $t('vod.edit.prevent-deletion') }}
            </label>
        </div>
    </div>
    <div class="field">
        <div class="control">
            <label class="checkbox">
                <input
                    v-model="editVodSettings.cloud_storage"
                    type="checkbox"
                >
                {{ $t('vod.edit.cloud-storage') }}
            </label>
        </div>
    </div>
    <div class="field">
        <button
            class="button is-confirm"
            @click="doEditVod"
        >
            <span class="icon"><fa icon="save" /></span>
            <span>{{ $t("buttons.save") }}</span>
        </button>
    </div>
</template>

<script lang="ts" setup>
import { useStore, VODTypes } from '@/store';
import { ApiResponse } from '@common/Api/Api';
import axios from 'axios';
import { onMounted, ref } from 'vue';

const store = useStore();

const props = defineProps<{
    vod: VODTypes;
}>();

const emit = defineEmits<{
    (event: 'close'): void;
}>();

const editVodSettings = ref({
    absolute_season: 0,
    stream_number: 0,
    comment: "",
    prevent_deletion: false,
    segments: "",
    cloud_storage: false,
});

function doEditVod() {
    if (!props.vod) return;
    axios.post(`/api/v0/vod/${props.vod.uuid}`, editVodSettings.value).then((response) => {
        const json: ApiResponse = response.data;
        if (json.message) alert(json.message);
        console.log(json);
        if (props.vod) store.fetchAndUpdateVod(props.vod.uuid);
        // if (this.editVodMenu) this.editVodMenu.show = false;
        emit('close');
    }).catch((err) => {
        console.error("form error", err.response);
        if (err.response.data && err.response.data.message) alert(err.response.data.message);
    });

}

onMounted(() => {
    editVodSettings.value = {
        absolute_season: props.vod.stream_absolute_season ?? 0,
        stream_number: props.vod.stream_number ?? 0,
        comment: props.vod.comment ?? "",
        prevent_deletion: props.vod.prevent_deletion ?? false,
        segments: props.vod.segments.map((s) => s.basename).join("\n"),
        cloud_storage: props.vod.cloud_storage ?? false,
    };
});

</script>