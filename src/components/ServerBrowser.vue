<template>
    <div class="server-browser">
            <md-list class="server-list">

                <md-list-item>
                    <div class="md-list-item-text">
                        <md-field>
                            <label>Add new server</label>
                            <md-input v-model="serverIp"></md-input>
                        </md-field>
                    </div>

                    <md-button type="submit" class="md-icon-button md-list-action"
                               @click="addServer(serverIp); serverIp=''">
                        <md-icon>add</md-icon>
                    </md-button>
                </md-list-item>

                <md-list-item v-for="server in servers" :key="server.ip" :md-expand="server.online"
                              :md-expanded="server.online">
                    <md-icon :title="`Checking connection to ${server.ip}`" v-if="server.loading" class="rotate">
                        cached
                    </md-icon>
                    <md-icon :title="`${server.ip} is online`" v-else-if="server.online"
                             :class="server.ip === connectedServer.ip?'md-primary' : ''">rss_feed
                    </md-icon>
                    <md-icon :title="`${server.ip} is offline`" v-else>error_outline</md-icon>

                    <div class="md-list-item-text" :title="server.ip">
                        {{server.ip}}
                    </div>
                    <md-button class="md-icon-button md-list-action"
                               :title="`Remove ${server.ip} from list`"
                               v-if="server.ip!==connectedServer.ip"
                               @click="removeServer(server.ip)">
                        <md-icon>delete</md-icon>
                    </md-button>

                    <md-list slot="md-expand">
                        <md-list-item class="md-inset">
                            <div class="md-list-item-text">
                                <md-field>
                                    <label>Create room</label>
                                    <md-input v-model="roomName" required></md-input>
                                    <span class="md-error">Room cannot be empty</span>
                                </md-field>
                            </div>

                            <md-button
                                    :title="`Connect to ${server.ip}#${roomName}`"
                                    class="md-icon-button md-list-action md-primary"
                                    @click="connectServer(server, roomName); roomName=''">
                                <md-icon>keyboard_arrow_right</md-icon>
                            </md-button>
                        </md-list-item>

                        <md-list-item class="md-inset" v-for="room in server.rooms" :key="room.name">
                            <div class="md-list-item-text" :title="`${server.ip}#${room.name}`">
                                <span>{{room.name}}</span>
                                <span v-if="server.online">Users online: {{room.userCount}}</span>
                            </div>
                            <md-button class="md-icon-button md-list-action"
                                       :title="`Disconnect from ${server.ip}#${room.name}`"
                                       v-if="room.name === server.room && server.ip === connectedServer.ip"
                                       @click="disconnectServer(server.ip)">
                                <md-icon>stop</md-icon>
                            </md-button>
                            <md-button class="md-icon-button md-list-action md-primary"
                                       :title="`Connect to ${server.ip}#${room.name}`"
                                       v-else
                                       @click="connectServer(server, room.name)">
                                <md-icon>keyboard_arrow_right</md-icon>
                            </md-button>
                        </md-list-item>
                    </md-list>

                </md-list-item>
            </md-list>
    </div>
</template>

<script>
    import SimplePeerMesh from '../js/SimplePeerMesh';
    import ServerInfo from '../js/ServerInfo';

    export default {
        name: 'server-browser',
        components: {},
        props: ['room', 'server'],
        data() {
            return {
                serverIp: 'https://ruurd.dev:5858',
                roomName: '',
                connectedServer: new ServerInfo('-1'),
                serverUserCountUpdater: false,
                servers: [],
                meshNetwork: null,
            }
        },
        async mounted() {
            if (localStorage.getItem('servers') !== null)
                JSON.parse(localStorage.servers).forEach(ip => {
                    let info = new ServerInfo(ip);
                    this.servers.push(info);
                    this.updateServerInfo(ip, info)
                });

            if (this.servers.find(s => s.ip === this.serverIp))
                this.serverIp = '';

            this.serverUserCountUpdater = setInterval(async () => {
                this.servers.forEach(s => this.updateServerInfo(s.ip, s));
            }, 2000);

            if (this.server) {
                console.log('this.server', this.server);
                if (!this.servers.find(s => s.ip === this.server))
                    await this.addServer(this.server);
                // this.servers.push(await this.updateServerInfo(this.server));

                if (this.room) {
                    console.log('this.room', this.room);
                    this.connectServer(this.servers.find(s => s.ip === this.server), this.room);
                }
            }
        },
        methods: {
            async connectServer(server, room) {
                if (this.meshNetwork) {
                    this.disconnectServer(this.meshNetwork.url);
                }

                this.meshNetwork = new SimplePeerMesh();
                this.meshNetwork.printDebug = false;

                await this.meshNetwork.connect(server.ip, true);
                this.updateServerInfo(server.ip, server);
                await this.meshNetwork.join(room);

                server.room = room;
                this.connectedServer = server;

                this.$route.params.server = server.ip;
                this.$route.params.room = room;

                this.$emit('connect', this.meshNetwork);
            },
            async updateServerInfo(ip, refObj = false) {
                let rooms = await SimplePeerMesh.getServerRooms(ip);
                let online = rooms !== null;
                // console.log('Updating server user count', ip, rooms);
                rooms = rooms || [];
                if (refObj !== false) {
                    refObj.online = online;
                    refObj.rooms = rooms;
                    refObj.loading = false
                }
                return new ServerInfo(ip, online, rooms, false);
            },
            async disconnectServer(ip) {
                if (ip === this.meshNetwork.url) {
                    this.meshNetwork.destroy();
                    this.$emit('disconnect', this.meshNetwork);
                    this.meshNetwork = null;
                    this.updateServerInfo(this.connectedServer.ip, this.connectedServer);
                    this.connectedServer = new ServerInfo('-1');
                } else {
                    console.warn("cannot disconnect from this server, you're not connected to it");
                }
            },
            removeServer(ip) {
                if (this.servers.find(s => s.ip === ip)) {
                    this.servers.splice(this.servers.findIndex(s => s.ip === ip), 1);
                    localStorage.servers = JSON.stringify(this.servers.map(s => s.ip));
                }
            },
            async addServer(ip) {
                console.log("adding server", ip);
                if (this.servers.find(s => s.ip === ip))
                    return;
                let serverInfo = new ServerInfo(ip);
                this.servers.push(serverInfo);
                localStorage.servers = JSON.stringify(this.servers.map(s => s.ip));
                await this.updateServerInfo(ip, serverInfo);
                console.log("Server info: ", serverInfo);
            },
        },
        beforeDestroy() {
            clearInterval(this.serverUserCountUpdater);
            if(this.meshNetwork)
                this.meshNetwork.destroy();
        },
    }
</script>

<style scoped>
    .server-browser {
        overflow-y: auto;
    }

    .server-list {
        padding: 15px;
        height: 100%;
        overflow-y: auto;
    }

    .server-list li:first-child {
        margin-bottom: 20px;
    }

    @keyframes spin {
        0% {
            transform: rotate(0deg);
        }
        100% {
            transform: rotate(360deg);
        }
    }

    .rotate {
        animation: spin 1s infinite linear reverse;
    }

    .md-card-media.md-ratio-16-9 img {
        filter: blur(2px) !important;
    }
</style>
