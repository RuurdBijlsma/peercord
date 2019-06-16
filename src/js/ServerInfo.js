export default class ServerInfo {
    constructor(ip, online = false, rooms = [], loading = true, room='') {
        this.ip = ip;
        this.online = online;
        this.rooms = rooms;
        this.loading = loading;
        this.room = room;
    }
}
