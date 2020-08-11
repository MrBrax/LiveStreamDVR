document.addEventListener("DOMContentLoaded", () => {

    console.log("Loaded");

    let api_base = window.base_path + "/api";

    function updateStreamers(){

        fetch( api_base + "/list").then(response => response.json()).then(data => {
            if( data.data ){
                for( let streamer of data.data.streamerList ){
                    console.log( streamer );
                    let menu = document.querySelector(".top-menu-item.streamer[data-streamer='" + streamer.username + "']");
                    let subtitle = menu.querySelector(".subtitle");
                    let vodcount = menu.querySelector(".vodcount");
                    vodcount.innerHTML = streamer.vods_list.length;
                    if( streamer.is_live ){
                        menu.classList.add('live');
                        // subtitle.innerHTML = 'Live';
                        subtitle.innerHTML = 'Playing <strong>' + streamer.current_game.game_name + '</strong>';
                    }else{
                        subtitle.innerHTML = 'Offline';
                        menu.classList.remove('live');
                    }
                }
            }
        });

    }

    // updateStreamers();

    setInterval(updateStreamers, 60 * 1000);

});

console.log("Hello");