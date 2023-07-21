<template>
    <div class="tips">
        <article>
            <h1>Tips and other stuff</h1>
            <p>
                This page contains some tips and other stuff that might be useful to you.
            </p>
        </article>
        <article>
            <h2>How to access subscription-only streams</h2>
            <p>
                If you want to access subscription-only streams, you need supply your session token.<br>
                You can follow this guide to get the ascii string: <a
                    href="https://streamlink.github.io/cli/plugins/twitch.html"
                    target="_blank"
                >https://streamlink.github.io/cli/plugins/twitch.html</a>
                <br><br>
                Store the string in the <code class="code-small">/config/twitch_oauth.txt</code> file and let the recording begin. There is no need to restart the application to update the token.<br>
                I have never tested this myself, so I don't know if it works or not. It will probably fail after a while when the token expires.
            </p>
        </article>
        <article>
            <h2>I don't want my server to be exposed to the internet</h2>
            <p>
                You can either set a password in the config or set the reverse proxy to only serve these routes:
                <ul>
                    <li>/api/v0/hook</li>
                    <li>/api/v0/hook/twitch</li>
                    <li>/api/v0/hook/youtube</li>
                </ul>
            </p>
        </article>
        <article>
            <h2>How authentication and single-page apps work</h2>
            <p>
                This application is a single-page app, which means that it only loads the index.html file once and then uses JavaScript to navigate between pages. This is done to make the application feel more like a native application.<br>
                This also means that the application doesn't reload the index.html file when you navigate to a different page.<br>The server doesn't know what page you are on because of this, and therefore it doesn't know if you are authenticated or not.<br>
                This is why you need to use the built in authentication system which will only require authentication on required endpoints.
                <br><br>
                By default, any visitor can access the application and view all your content and change settings.
            </p>
        </article>
        <article>
            <h2>Why do I need a public facing web server?</h2>
            <p>
                To get stream notifications, the remote server needs to be able to access your local server.<br>
                This is done by using a public facing reverse proxy (because the need for HTTPS) and a port forward.<br>
                The current implementation of remote websockets by the provider is very limited, so this is the only way to get it to work.
            </p>
        </article>
        <article>
            <h2>Can I modify/move the files inside storage?</h2>
            <p>
                <em>In most cases, this is a bad idea.</em><br>
                Do not remove the main JSON files while the application is running unless you know that the file watcher is working.
                It will remove the VOD from the memory database and nothing bad will happen.
                However, if it doesn't work then the memory will be out of sync with the database/disk, causing the cleanup function and other functions to misbehave.
                The best way of moving files is to copy the files via the filesystem and then deleting the VOD via the dashboard.
            </p>
        </article>
        <article>
            <h2>How to be a pro</h2>
            <p title="this has been a feature since september 2022">
                Enter the konami code to unlock the pro mode.
            </p>
        </article>
        <footer>⚜</footer>
    </div>
</template>

<style lang="scss" scoped>
.tips {
    padding: 2em;
    line-height: 1.4em;
    // letter-spacing: 0.01em;
    max-width: 800px;
    margin: 2em auto;
    text-align: justify;
    font-size: 14px;
    background-color: var(--body-background);
    border-radius: 1em;
    box-shadow: 0 0 20px 0 rgba(0, 0, 0, 0.03);
}
article:not(:last-child) {
    margin-bottom: 2em;
}

h1, h2, h3 {
    margin: 0;
    padding: 0;
}

// fancy heading symbol
h2::before {
    content: "※";
    margin-right: 0.25em;
    color: #006aff;
}

p {
    padding: 0;
    margin: 0.8em 0.2em;
}

footer {
    margin-top: 2em;
    padding-bottom: 1em;
    text-align: center;
    font-size: 2em;
    color: #3684f1;
}

</style>