document.addEventListener("DOMContentLoaded", () => {

    let api_base = window.base_path + "/api";

    let delay = 120;

    function updateStreamers(){

        console.log(`Fetching streamer list (${delay})...`);

        let any_live = false;

        fetch( api_base + "/list").then(response => response.json()).then(data => {
            if( data.data ){
                for( let streamer of data.data.streamerList ){
                    // console.log( streamer );
                    let menu = document.querySelector(".top-menu-item.streamer[data-streamer='" + streamer.username + "']");
                    let subtitle = menu.querySelector(".subtitle");
                    let vodcount = menu.querySelector(".vodcount");
                    vodcount.innerHTML = streamer.vods_list.length;
                    if( streamer.is_live ){
                        any_live = true;
                        menu.classList.add('live');
                        // subtitle.innerHTML = 'Live';
                        subtitle.innerHTML = 'Playing <strong>' + streamer.current_game.game_name + '</strong>';
                    }else{
                        subtitle.innerHTML = 'Offline';
                        menu.classList.remove('live');
                    }
                }
                if(any_live){
                    delay = 120;
                }else{
                    delay += 10
                }
                setTimeout(updateStreamers, delay * 1000);
            }
        });

        

    }

    updateStreamers();

    

});

console.log("Hello");