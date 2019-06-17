<!--TODO: Show online members somewhere-->
<!--TODO: Voice chat-->

<template>
    <div class="home">
        <audio v-for="state in privateIdStates" :srcObject.prop="state.stream" :key="listKey" :volume="state.volume" :muted="state.mute" autoplay></audio>

        <md-app md-mode="fixed" :md-scrollbar="false">
            <md-app-toolbar class="md-primary">
                <md-button class="md-icon-button" @click="menuVisible = !menuVisible">
                    <md-icon>menu</md-icon>
                </md-button>
                <span class="md-title">Peercord</span>
            </md-app-toolbar>

            <md-app-drawer :md-active.sync="menuVisible">
                <server-browser :server="$route.query.server"
                                :room="$route.query.room"
                                v-on:connect="connected"
                                v-on:disconnect="disconnected"></server-browser>
            </md-app-drawer>

            <md-app-content class="main-content">
                <vue-simple-context-menu
                        :elementId="'myUniqueId'"
                        :options="contextOptions"
                        :ref="'vueSimpleContextMenu'"
                        @option-clicked="optionClicked">
                </vue-simple-context-menu>

                <md-list :key="listKey" class="md-accent" v-if="peerMesh !== null">
                    <md-subheader>Online users</md-subheader>
                    <md-list-item v-for="state in syncedIdStates"
                                  @contextmenu.prevent.stop="handleClick($event, state)">
                        <md-icon>account_circle</md-icon>
                        <span class="md-list-item-text">{{state.user}}</span>
                    </md-list-item>
                </md-list>
                <md-empty-state
                        v-if="this.peerMesh === null"
                        md-icon="devices_other"
                        md-label="Connect to a server to begin"
                        md-description="Add a server on the menu to the left to start, then click the blue arrow next to a room to join that room.">
                </md-empty-state>
                <md-content v-else class="chat-box">
                    <h3 @click="promptActive=!promptActive">Your name: {{syncedState.user}}</h3>
                    <md-dialog-prompt
                            :md-active.sync="promptActive"
                            v-model="syncedState.user"
                            md-title="What's your name?"
                            md-input-placeholder="Type your new username..."
                            md-confirm-text="Done"/>
                    <md-list class="messages-list" v-if="messages.length > 0" ref="messagesList" :key="listKey">
                        <md-list-item v-for="message in messages" class="message-item">
                            <div class="md-list-item-text message"
                                 :me="message.from === 'me'">
                            <span :style="`color: ${message.color}`"
                                  v-if="message.show">{{syncedIdStates[message.from].user}}</span>
                                <span>{{message.text}}</span>
                            </div>
                        </md-list-item>
                    </md-list>
                    <md-field>
                        <label>Type a message</label>
                        <md-input @keypress.enter="sendMessage(message);message=''" v-model="message"></md-input>
                    </md-field>
                </md-content>
            </md-app-content>
        </md-app>
    </div>
</template>

<script>
    import ServerBrowser from "@/components/ServerBrowser";
    import rug from 'random-username-generator';
    import ColorHash from 'color-hash';


    export default {
        name: 'home',
        components: {ServerBrowser},
        data() {
            return {
                menuVisible: false,
                colorHash: new ColorHash(),
                innerWidth: window.innerWidth,
                listKey: 0,
                promptActive: false,
                showServerBrowser: true,
                message: '',
                messages: [],
                peerMesh: null,
                privateIdStates: {},
                syncedIdStates: {},
                contextOptions: [{name: 'Mute'}, {name: 'Adjust volume'}],
                syncedState: {
                    user: rug.generate()
                },
            }
        },
        async mounted() {
            if (localStorage.getItem('userName') !== null)
                this.syncedState.user = localStorage.userName;
            this.syncedIdStates['me'] = this.syncedState;
            window.addEventListener('resize', () => this.innerWidth = innerWidth);
        },
        methods: {
            handleClick(event, item) {
                this.$refs.vueSimpleContextMenu.showMenu(event, item)
            },
            optionClicked(event) {
                window.alert(JSON.stringify(event))
            },
            sendMessage(message) {
                if (!this.peerMesh) return;
                this.message = '';

                this.showMessage('me', message);
                this.peerMesh.broadcast(JSON.stringify({
                    event: 'message',
                    value: message
                }));
            },
            showMessage(sender, message) {
                let msgObject = {text: message, from: sender, color: this.colorHash.hex(sender), show: true};
                let lastChat = this.messages[this.messages.length - 1];

                if (lastChat && lastChat.from === sender)
                    msgObject.show = false;

                this.messages.push(msgObject);
                console.log(msgObject);

                setTimeout(() => {
                    let items = document.querySelectorAll('.message-item');
                    let lastChat = items[items.length - 1];
                    if (lastChat)
                        lastChat.scrollIntoView();
                });
            },
            async getMicrophone() {
                return await navigator.mediaDevices.getUserMedia({audio: true, video: false});
            },
            async connected(peerMesh) {

                this.showServerBrowser = false;
                this.peerMesh = peerMesh;

                this.$router.replace({
                    query: {
                        room: peerMesh.room,
                        server: peerMesh.url
                    }
                });

                console.log("Connected", peerMesh);
                this.broadcast('initialState', this.syncedState);

                peerMesh.on('connect', id => {
                    console.log("New connection");
                });

                peerMesh.on('disconnect', id => {
                    delete this.syncedIdStates[id];
                    delete this.privateIdStates[id];
                    this.forceListUpdate();
                });

                peerMesh.on('data', (id, data) => {
                    let dataObj = JSON.parse(data.toString());
                    switch (dataObj.event) {
                        case 'initialState':
                            console.log('initialState, replying with my syncedState', id, dataObj.value);
                            this.syncedIdStates[id] = dataObj.value;
                            this.forceListUpdate();
                            this.send(id, 'syncedState', this.syncedState);
                            break;
                        case 'syncedState':
                            console.log('updating syncedState', id, dataObj.value);
                            this.syncedIdStates[id] = dataObj.value;
                            this.forceListUpdate();
                            break;
                        case 'message':
                            console.log('receiving message', id, dataObj.value);
                            this.showMessage(id, dataObj.value);
                            break;
                        default:
                            console.log("Unknown event", dataObj);
                            break;
                    }
                });
                peerMesh.on('stream', (id, stream) => {
                    if (!this.privateIdStates[id])
                        this.privateIdStates[id] = {};
                    let state = this.privateIdStates[id];
                    state.stream = stream;
                    // state.volume = 1;
                    // state.mute = false;
                    console.log(state);
                    this.forceListUpdate();
                });

                peerMesh.broadcastStream(await this.getMicrophone());
            },
            forceListUpdate() {
                this.listKey++;
                setTimeout(() => {
                    let items = document.querySelectorAll('.message-item');
                    let lastChat = items[items.length - 1];
                    if (lastChat)
                        lastChat.scrollIntoView();
                });
            },
            disconnected(peerMesh) {
                this.$router.replace({});
                this.peerMesh = null;
                console.log("Disconnected", peerMesh);
                this.syncedIdStates = {me: this.syncedState};
            },
            send(id, event, value) {
                if (this.peerMesh && this.peerMesh.peers.hasOwnProperty(id)) {
                    this.peerMesh.peers[id].send(JSON.stringify({
                        event: event,
                        value: value
                    }))
                }
            },
            broadcast(event, value) {
                if (this.peerMesh) {
                    this.peerMesh.broadcast(JSON.stringify({
                        event: event,
                        value: value
                    }))
                }
            },
        },
        watch: {
            syncedState: {
                handler() {
                    localStorage.userName = this.syncedState.user;
                    this.forceListUpdate();
                    this.broadcast('syncedState', this.syncedState);
                },
                deep: true
            }
        },
        beforeDestroy() {
            for (let state in this.privateIdStates)
                if (this.privateIdStates.hasOwnProperty(state))
                    cancelAnimationFrame(this.privateIdStates[state].interval);
        },
    }
</script>

<style scoped>
    .md-app {
        height: 100vh;
    }

    .md-drawer {
        max-width: calc(100% - 125px);
    }

    .main-content {
        display: flex;
        padding: 0px;
    }

    .chat-box {
        height: 100%;
        width: 100%;
    }

    .messages-list {
        overflow-y: auto;
    }

    .message[me] * {
        text-align: right !important;
    }

    .home {
        height: 100%;
    }

    .chat-box {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        height: 100%;
    }

</style>
