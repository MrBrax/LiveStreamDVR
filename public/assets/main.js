"use strict";
function formatBytes(bytes, precision = 2) {
    let units = ['B', 'KB', 'MB', 'GB', 'TB'];
    bytes = Math.max(bytes, 0);
    let pow = Math.floor((bytes ? Math.log(bytes) : 0) / Math.log(1024));
    pow = Math.min(pow, units.length - 1);
    // Uncomment one of the following alternatives
    bytes /= Math.pow(1024, pow);
    // bytes /= (1 << (10 * pow)); 
    return `${Math.round(bytes)} ${units[pow]}`;
}
function notifyMe() {
    // Let's check if the browser supports notifications
    if (!("Notification" in window)) {
        alert("This browser does not support desktop notification");
    }
    // Let's check whether notification permissions have already been granted
    else if (Notification.permission === "granted") {
        // If it's okay let's create a notification
        var notification = new Notification("Granted, will now notify of stream activity!");
    }
    // Otherwise, we need to ask the user for permission
    else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(function (permission) {
            // If the user accepts, let's create a notification
            if (permission === "granted") {
                var notification = new Notification("Will now notify of stream activity!");
            }
        });
    }
    // At last, if the user has denied notifications, and you 
    // want to be respectful there is no need to bother them any more.
}
function setStatus(text, active = false) {
    let js_status = document.getElementById("js-status");
    if (!js_status)
        return false;
    console.debug("Set status", text, active);
    js_status.classList.toggle('active', active);
    js_status.innerHTML = text;
}
document.addEventListener("DOMContentLoaded", () => {
    let api_base = `${window.base_path}/api/v0`;
    let delay = 120;
    let previousData = {};
    let timeout_store = 0;
    let refresh_number = 0;
    async function updateStreamers() {
        console.log(`Fetching streamer list (${delay})...`);
        setStatus('Fetching...', true);
        let any_live = false;
        let response = await fetch(`${api_base}/list`);
        setStatus('Parsing...', true);
        let data = await response.json();
        setStatus('Applying...', true);
        if (data.data) {
            for (let streamer of data.data.streamerList) {
                // console.log( streamer );
                let menu = document.querySelector(`.top-menu-item.streamer[data-streamer='${streamer.username}']`);
                if (menu) {
                    let subtitle = menu.querySelector(".subtitle");
                    let vodcount = menu.querySelector(".vodcount");
                    let link = menu.querySelector("a");
                    if (subtitle && vodcount && link) {
                        vodcount.innerHTML = streamer.vods_list.length;
                        if (streamer.is_live) {
                            any_live = true;
                            menu.classList.add('live');
                            subtitle.innerHTML = `Playing <strong>${streamer.current_game.game_name}</strong>`;
                            if (streamer.current_vod)
                                link.href = `#vod_${streamer.current_vod.basename}`;
                        }
                        else {
                            subtitle.innerHTML = 'Offline';
                            menu.classList.remove('live');
                            link.href = `#streamer_${streamer.username}`;
                        }
                    }
                }
                let streamer_div = document.querySelector(`.streamer-box[data-streamer='${streamer.username}']`);
                if (streamer_div) {
                    setStatus(`Render ${streamer.username}...`, true);
                    let body_content_response = await fetch(`${api_base}/render/streamer/${streamer.username}`);
                    let body_content_data = await body_content_response.text();
                    streamer_div.outerHTML = body_content_data;
                }
                let old_data = previousData[streamer.username];
                setStatus(`Check notifications for ${streamer.username}...`, true);
                if (old_data && Notification.permission === "granted") {
                    let opt = {
                        icon: streamer.channel_data.profile_image_url,
                        image: streamer.channel_data.profile_image_url,
                        body: streamer.current_game ? streamer.current_game.game_name : "No game",
                    };
                    let text = "";
                    if (!old_data.is_live && streamer.is_live) {
                        text = `${streamer.username} is live!`;
                    }
                    if ((!old_data.current_game && streamer.current_game) || (old_data.current_game && streamer.current_game && old_data.current_game.game_name !== streamer.current_game.game_name)) {
                        if (streamer.current_game.favourite) {
                            text = `${streamer.username} is now playing one of your favourite games: ${streamer.current_game.game_name}!`;
                        }
                        else {
                            text = `${streamer.username} is now playing ${streamer.current_game.game_name}!`;
                        }
                    }
                    if (old_data.is_live && !streamer.is_live) {
                        text = `${streamer.username} has gone offline!`;
                    }
                    if (text !== "") {
                        console.log(`Notify: ${text}`);
                        if (Notification.permission === "granted") {
                            let n = new Notification(text, opt);
                        }
                        if (window.useSpeech) {
                            let utterance = new SpeechSynthesisUtterance(text);
                            speechSynthesis.speak(utterance);
                        }
                    }
                }
                previousData[streamer.username] = streamer;
            }
            let div_log = document.querySelector("div.log_viewer");
            if (div_log) {
                setStatus(`Render log viewer...`, true);
                let body_content_response = await fetch(`${api_base}/render/log/`);
                let body_content_data = await body_content_response.text();
                div_log.outerHTML = body_content_data;
                setTimeout(() => {
                    div_log = document.querySelector("div.log_viewer");
                    if (!div_log)
                        return;
                    div_log.scrollTop = div_log.scrollHeight;
                }, 100);
            }
            if (any_live) {
                delay = 120;
            }
            else {
                delay += 10;
            }
            refresh_number++;
            console.log(`Set next timeout to (${delay})...`);
            setStatus(`Done #${refresh_number}. Waiting ${delay} seconds.`, false);
            timeout_store = setTimeout(updateStreamers, delay * 1000);
        }
    }
    window.forceRefresh = () => {
        clearTimeout(timeout_store);
        updateStreamers();
    };
    setStatus(`Refreshing in ${delay} seconds...`, false);
    window.useSpeech = localStorage.getItem("useSpeech") == "1";
    let opt = document.getElementById("useSpeechOption");
    if (opt) {
        opt.checked = localStorage.getItem("useSpeech") == "1";
        opt.addEventListener("change", () => {
            localStorage.setItem("useSpeech", opt.checked ? "1" : "0");
            alert("Speech " + (opt.checked ? "enabled" : "disabled"));
        });
    }
    timeout_store = setTimeout(updateStreamers, delay * 1000);
});
console.log("Hello");
//# sourceMappingURL=main.js.map