// import { Store } from '@/store';
import { ComponentCustomProperties } from 'vue'
import { ApiConfig, ApiStreamer } from './twitchautomator';
import { Store } from 'vuex';

declare module '@vue/runtime-core' {

    interface State {
        streamerList: ApiStreamer[];
        config: ApiConfig;
        version: string;
        clientConfig: {
            useSpeech: boolean;
            singlePage: boolean;
            enableNotifications: boolean;
            animationsEnabled: boolean;
            tooltipStatic: boolean;
            useRelativeTime: boolean;
        }
    }
      
    interface ComponentCustomProperties {
        $store: Store<State>;
    }

}
