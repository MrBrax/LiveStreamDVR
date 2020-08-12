function formatBytes(bytes, precision = 2) { 
    let units = ['B', 'KB', 'MB', 'GB', 'TB']; 

    bytes = Math.max(bytes, 0); 
    pow = Math.floor((bytes ? Math.log(bytes) : 0) / Math.log(1024)); 
    pow = Math.min(pow, units.length - 1); 

    // Uncomment one of the following alternatives
    bytes /= Math.pow(1024, pow);
    // bytes /= (1 << (10 * pow)); 

    return Math.round(bytes, precision) + ' ' + units[pow]; 
} 

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

                    let streamer_div = document.querySelector(".streamer-box[data-streamer='" + streamer.username + "']");
                    let streamer_vods_quality = streamer_div.querySelector(".streamer-vods-quality");
                    let streamer_vods_amount = streamer_div.querySelector(".streamer-vods-amount");
                    let streamer_vods_size = streamer_div.querySelector(".streamer-vods-size");
                    streamer_vods_quality.innerHTML = streamer.quality;
                    streamer_vods_amount.innerHTML = streamer.vods_raw.length + " vods";
                    streamer_vods_size.innerHTML = formatBytes(streamer.vods_size, 2);

                    vodcount.innerHTML = streamer.vods_list.length;
                    if( streamer.is_live ){
                        any_live = true;
                        menu.classList.add('live');
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