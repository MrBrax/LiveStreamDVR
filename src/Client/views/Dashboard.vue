<template>
  <div>Dashboard</div>
</template>

<script>

export default {
    name: 'Dashboard',
    components: {
    
    },
    created(){

        let server_url = 'http://localhost:8080/api';

        fetch( server_url + "/list").then(response => response.json()).then(data => {
            console.log(data);
        });
      
    }
}
</script>
