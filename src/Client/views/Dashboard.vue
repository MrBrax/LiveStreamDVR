<template>
    <div class="dashboard">
        <strong>Free size:</strong> {{ $root.free_size }}.
    </div>
</template>

<script>

export default {
    name: 'Dashboard',
    mounted(){
        console.log( this.data );
        console.log( this.free_size );
        console.log( this.$route );
    },
}
</script>
