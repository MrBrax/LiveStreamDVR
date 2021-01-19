<template>
    <form method="POST" @submit="submitForm">

        <div class="field">
            <label class="label">VOD URL</label>
            <div class="control">
                <input class="input input-required" type="text" name="url" value="" />
            </div>
        </div>

        <div class="field">
            <label class="label">Quality</label>
            <div class="control">
                <select class="input input-required" name="quality">
                    <option v-for="quality in twitchQuality" :key="quality">{{ quality }}</option>
                </select>
            </div>
        </div>

        <div class="field">
            <div class="control">
                <button class="button is-confirm" type="submit"><span class="icon"><i class="fa fa-download"></i></span> Execute</button>
            </div>
        </div>

    </form>
</template>

<script>
export default {

}
</script>

<style>

</style>