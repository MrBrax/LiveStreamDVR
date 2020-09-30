"use strict";
let api_base = `${window.base_path}/api/v0`;
let current_username = "";
let scrollTop = 0;
let refresh_number = 0;
let log_name = "";
let previousData = {};
let fluffInterval;
let config = {
    useSpeech: false,
    singlePage: true
};
let nongames = ['Just Chatting', 'IRL', 'Travel', 'Art'];
let streamerPronounciation = {
    pokelawls: 'pookelawls',
    xQcOW: 'eckscueseeow'
};
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
function showStreamer(username) {
    console.debug(`Show streamer: ${username}`);
    current_username = username;
    const boxes = document.querySelectorAll("div.streamer-box");
    for (const box of boxes) {
        box.style.display = username == box.dataset.streamer ? "block" : "none";
    }
    const menu_streamer_buttons = document.querySelectorAll("div.top-menu-item.streamer");
    for (const button of menu_streamer_buttons) {
        // let link = button.querySelector("a");
        let btn_user = button.dataset.streamer;
        button === null || button === void 0 ? void 0 : button.classList.toggle("active", btn_user == username);
    }
}
function formatDuration(sec_num) {
    var date = new Date(0);
    date.setSeconds(sec_num);
    return date.toISOString().substr(11, 8);
}
function fluffTick() {
    if (!previousData) {
        return;
    }
    for (let username in previousData) {
        if (!previousData[username].is_live) {
            continue;
        }
        let div = document.getElementById("duration_" + username);
        if (div) {
            let ts = previousData[username].current_vod.started_at.date;
            let date = new Date(ts + "+00:00");
            let now = new Date();
            // console.log("fluff", date, now);
            let diff = Math.abs(Math.round((date.getTime() - now.getTime()) / 1000));
            div.innerHTML = formatDuration(diff); // todo: format
        }
    }
}
function saveConfig() {
    localStorage.setItem("twitchautomator_config", JSON.stringify(config));
    console.log("Saving config");
}
async function renderLog(date) {
    let div_log = document.querySelector("div.log_viewer");
    if (div_log) {
        let body_content_response = await fetch(`${api_base}/render/log/${date}`);
        let body_content_data = await body_content_response.text();
        div_log.outerHTML = body_content_data;
        setTimeout(() => {
            div_log = document.querySelector("div.log_viewer");
            if (!div_log)
                return;
            div_log.scrollTop = div_log.scrollHeight;
        }, 100);
    }
}
let observer;
function setupObserver() {
    // simple function to use for callback in the intersection observer
    const changeNav = (entries, observer) => {
        entries.forEach((entry) => {
            var _a;
            // verify the element is intersecting
            if (entry.isIntersecting && entry.intersectionRatio >= 0.75) {
                // console.log("intersect", entry);
                // remove old active class
                (_a = document.querySelector('.is-active')) === null || _a === void 0 ? void 0 : _a.classList.remove('is-active');
                // get id of the intersecting section
                let target = entry.target;
                let basename = target.dataset.basename;
                // console.log(target, basename);
                // find matching link & add appropriate class
                let menuItem = document.querySelector(`div.streamer-jumpto a[data-basename="${basename}"]`);
                // console.log(menuItem);
                if (menuItem) {
                    let newLink = menuItem.classList.add('is-active');
                }
            }
        });
    };
    // init the observer
    const options = {
        threshold: 0.75
    };
    if (observer)
        observer.disconnect();
    observer = new IntersectionObserver(changeNav, options);
    // target the elements to be observed
    const jumpto_sections = document.querySelectorAll('.video');
    jumpto_sections.forEach((section) => {
        // console.log(section);
        observer.observe(section);
    });
}
document.addEventListener("DOMContentLoaded", () => {
    let isDashboard = window.location.pathname == window.base_path + "/dashboard";
    let delay = 120;
    let timeout_store = 0;
    let config_string = localStorage.getItem("twitchautomator_config");
    config = config_string ? JSON.parse(config_string) : {};
    async function updateStreamers() {
        console.log(`Fetching streamer list (${delay})...`);
        setStatus('Fetching...', true);
        let any_live = false;
        scrollTop = window.pageYOffset;
        let list_response = await fetch(`${api_base}/list`);
        setStatus('Parsing...', true);
        let data = await list_response.json();
        setStatus('Applying...', true);
        if (data.data) {
            for (let streamer of data.data.streamerList) {
                let username = streamer.display_name;
                /*
                let menu = document.querySelector(`.top-menu-item.streamer[data-streamer='${username}']`);
                if( menu ){

                    let subtitle    = menu.querySelector(".subtitle");
                    let vodcount    = menu.querySelector(".vodcount");
                    let link        = menu.querySelector("a");

                    if( subtitle && vodcount && link ){

                        vodcount.innerHTML = streamer.vods_list.length;
                        if( streamer.is_live ){
                            any_live = true;
                            menu.classList.add('live');
                            let tmp = nongames.indexOf(streamer.current_game.game_name) !== -1 ? `<strong>${streamer.current_game.game_name}</strong>` : `Playing <strong>${streamer.current_game.game_name}</strong>`;
                            if(streamer.current_vod){
                                link.href = `#vod_${streamer.current_vod.basename}`;
                                tmp += ` for ${streamer.current_vod.duration_live}`;
                            }
                            subtitle.innerHTML = tmp;
                        }else{
                            subtitle.innerHTML = 'Offline';
                            menu.classList.remove('live');
                            link.href = `#streamer_${username}`;
                        }

                    }

                }
                */
                // update div
                let streamer_div = document.querySelector(`.streamer-box[data-streamer='${username}']`);
                if (streamer_div) {
                    setStatus(`Render ${username}...`, true);
                    let body_content_response = await fetch(`${api_base}/render/streamer/${username}`);
                    let body_content_data = await body_content_response.text();
                    streamer_div.outerHTML = body_content_data;
                    // streamer_div.style.display = username == current_username ? "block" : "none";
                }
                let old_data = previousData[username];
                setStatus(`Check notifications for ${username}...`, true);
                if (old_data && Notification.permission === "granted") {
                    let opt = {
                        icon: streamer.channel_data.profile_image_url,
                        image: streamer.channel_data.profile_image_url,
                        body: streamer.current_game ? streamer.current_game.game_name : "No game",
                    };
                    let text = "";
                    if (!old_data.is_live && streamer.is_live) {
                        text = `${username} is live!`;
                    }
                    if ((!old_data.current_game && streamer.current_game) || (old_data.current_game && streamer.current_game && old_data.current_game.game_name !== streamer.current_game.game_name)) {
                        if (streamer.current_game.favourite) {
                            text = `${username} is now playing one of your favourite games: ${streamer.current_game.game_name}!`;
                        }
                        else {
                            text = `${username} is now playing ${streamer.current_game.game_name}!`;
                        }
                    }
                    if (old_data.is_live && !streamer.is_live) {
                        text = `${username} has gone offline!`;
                    }
                    if (text !== "") {
                        console.log(`Notify: ${text}`);
                        if (Notification.permission === "granted") {
                            let n = new Notification(text, opt);
                        }
                        if (config.useSpeech) {
                            let speakText = text;
                            if (streamerPronounciation[username]) {
                                console.debug(`Using pronounciation for ${username}`);
                                speakText.replace(username, streamerPronounciation[username]);
                            }
                            let utterance = new SpeechSynthesisUtterance(speakText);
                            window.speechSynthesis.speak(utterance);
                        }
                    }
                }
                previousData[username] = streamer;
            }
            setStatus(`Render log viewer...`, true);
            await renderLog(log_name);
            if (any_live) {
                delay = 120;
            }
            else {
                delay += 10;
            }
            if (current_username && !config.singlePage)
                showStreamer(current_username);
            refresh_number++;
            console.debug(`Set next timeout to (${delay})...`);
            setStatus(`Done #${refresh_number}. Waiting ${delay} seconds.`, false);
            timeout_store = setTimeout(updateStreamers, delay * 1000);
        }
        let menu_div = document.querySelector(`.side-menu`);
        let menu_response = await fetch(`${api_base}/render/menu`);
        let menu_data = await menu_response.text();
        if (menu_div)
            menu_div.outerHTML = menu_data;
        window.scrollTo(0, scrollTop);
        setupObserver();
    }
    window.forceRefresh = () => {
        clearTimeout(timeout_store);
        updateStreamers();
    };
    if (isDashboard) {
        setStatus(`Refreshing in ${delay} seconds...`, false);
        timeout_store = setTimeout(updateStreamers, delay * 1000);
        fluffInterval = setInterval(fluffTick, 1000);
    }
    // speech settings
    // (<any>window).useSpeech = config.useSpeech;
    let opt_speech = document.getElementById("useSpeechOption");
    if (opt_speech) {
        opt_speech.checked = config.useSpeech;
        opt_speech.addEventListener("change", () => {
            config.useSpeech = opt_speech.checked;
            saveConfig();
            alert("Speech " + (config.useSpeech ? "enabled" : "disabled"));
        });
    }
    // single page
    let opt_spa = document.getElementById("singlePageOption");
    if (opt_spa) {
        opt_spa.checked = config.singlePage;
        opt_spa.addEventListener("change", () => {
            config.singlePage = opt_spa.checked;
            saveConfig();
            alert("Single page " + (config.singlePage ? "enabled" : "disabled"));
            location.reload();
        });
    }
    // show and hide streamers
    if (!config.singlePage) {
        const menu_streamer_buttons = document.querySelectorAll("div.top-menu-item.streamer");
        if (menu_streamer_buttons) {
            menu_streamer_buttons.forEach(element => {
                let link = element.querySelector("a");
                if (!link)
                    return;
                link.addEventListener("click", (event) => {
                    let username = element.dataset.streamer;
                    if (username) {
                        showStreamer(username);
                        // current_username = username;
                    }
                    event.preventDefault();
                    return false;
                });
            });
        }
        // show first streamer
        let f = document.querySelector("div.streamer-box");
        if (f && f.dataset.streamer)
            showStreamer(f.dataset.streamer);
    }
    // clickable section headers
    const sections = document.querySelectorAll(`section`);
    if (sections) {
        for (const section of sections) {
            const title = section.querySelector("div.section-title");
            const content = section.querySelector("div.section-content");
            title === null || title === void 0 ? void 0 : title.addEventListener("click", event => {
                console.debug("toggle section");
                if (content)
                    content.style.display = (content.style.display == "block" || !content.style.display) ? "none" : "block";
            });
        }
        // default to hidden, good?
        let logs = document.querySelector(`section[data-section="logs"] div.section-content`);
        if (logs) {
            logs.style.display = "none";
        }
        else {
            console.debug("no logs found");
        }
    }
    // compressor
    /*
    const compressors = <NodeListOf<HTMLElement>>document.querySelectorAll(`div.compressor`);
    if(compressors){
        for( const compressor of compressors ){
            const toCompress = <HTMLElement>document.querySelector( <string>compressor.dataset.for );
            
            compressor.addEventListener("click", event => {
                console.debug("toggle section");
                if(toCompress){
                    toCompress.isCompressed = true;
                    let isCompressed = toCompress.isCompressed;
                    toCompress.style.display = ( toCompress.style.display == "block" || !toCompress.style.display ) ? "none" : "block";
                }
            });
        }

        // default to hidden, good?
        let logs = <HTMLElement>document.querySelector(`section[data-section="logs"] div.section-content`);
        if(logs){
            logs.style.display = "none";
        }else{
            console.debug("no logs found");
        }
    }
    */
    setupObserver();
    // single page
    const log_select = document.getElementById("log_select");
    if (log_select) {
        log_select.addEventListener("change", (e) => {
            log_name = log_select.value.substring(0, 10);
            renderLog(log_name);
        });
    }
});
//# sourceMappingURL=main.js.map