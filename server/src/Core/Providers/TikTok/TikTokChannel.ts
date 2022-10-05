import { BaseChannel } from "../Base/BaseChannel";

export class TikTokChannel extends BaseChannel {
    
    provider = "tiktok";

    static async getUserDataById(id: string) {
        return await this.getUserDataProxy("id", id);
    }

    static async getUserDataByUserName(username: string) {
        return await this.getUserDataProxy("username", username);
    }

    static async getUserDataProxy(method: "id" | "username", identifier: string, force = false) {
        
        
    }

}