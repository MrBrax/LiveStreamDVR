# YouTube API setup

Create an app on [Google Developers Console](https://console.cloud.google.com) and enable the *YouTube Data API v3*.

Open the API overview.

In *Credentials*, click *Create Credentials* and select *OAuth client ID*.

* **Application type:** Web application
* **Authorized JavaScript origins:** App URL (ex. `https://livestreamdvr.example.com`)
* **Authorized redirect URI:** App URL with callback (ex. `https://livestreamdvr.example.com/api/v0/youtube/callback`)

Enter the *Client ID* and *Client Secret* gotten from the Google Developers Console into the *Client ID* and *Client Secret* fields in the settings page.

I'm not sure how a published app works, but an unpublished one can still be used.

Go to the *OAuth Consent Screen* and add yourself as a *Test User*.