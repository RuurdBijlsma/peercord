<!--TODO: Show online members somewhere-->
<!--TODO: Voice chat-->

<template>
    <div class="home">
        <server-browser class="browser"
                        :active="showServerBrowser || innerWidth > 750"
                        :server="$route.query.server"
                        :room="$route.query.room"
                        v-on:connect="connected"
                        v-on:disconnect="disconnected"></server-browser>
        <md-button v-if="innerWidth <= 750"
                   class="md-fab md-mini browser-fab"
                   :active="showServerBrowser || innerWidth > 750"
                   @click="showServerBrowser = !showServerBrowser">
            <md-icon>menu</md-icon>
        </md-button>
        <div class="overlay" v-if="showServerBrowser && innerWidth <= 750" @click="showServerBrowser=false"></div>
        <md-content class="main-content">
            <md-empty-state
                    v-if="this.peerMesh === null"
                    md-icon="devices_other"
                    md-label="Connect to a server to begin"
                    md-description="Add a server on the menu to the left to start, then click the blue arrow next to a room to join that room.">
            </md-empty-state>
            <md-content v-else class="chat-box">
                <h3 @click="promptActive=!promptActive">Your name: {{state.user}}</h3>
                <md-dialog-prompt
                        :md-active.sync="promptActive"
                        v-model="state.user"
                        md-title="What's your name?"
                        md-input-placeholder="Type your new username..."
                        md-confirm-text="Done"/>
                <md-list class="messages-list" v-if="messages.length > 0" ref="messagesList" :key="listKey">
                    <md-list-item v-for="message in messages" class="message-item">
                        <div class="md-list-item-text message"
                             :me="message.from === 'me'">
                            <span :style="`color: ${message.color}`"
                                  v-if="message.show">{{idStates[message.from].user}}</span>
                            <span>{{message.text}}</span>
                        </div>
                    </md-list-item>
                </md-list>
                <md-field>
                    <label>Type a message</label>
                    <md-input @keypress.enter="sendMessage(message);message=''" v-model="message"></md-input>
                </md-field>
            </md-content>
        </md-content>
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
                colorHash: new ColorHash(),
                innerWidth: window.innerWidth,
                listKey: 0,
                promptActive: false,
                showServerBrowser: true,
                message: '',
                messages: [],
                peerMesh: null,
                idStates: {},
                state: {
                    user: rug.generate()
                }
            }
        },
        async mounted() {
            if (localStorage.getItem('userName') !== null)
                this.state.user = localStorage.userName;
            this.idStates['me'] = this.state;
            window.addEventListener('resize', () => this.innerWidth = innerWidth);
        },
        methods: {
            sendMessage(message) {
                if (!this.peerMesh) return;

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
            connected(peerMesh) {
                this.showServerBrowser = false;
                this.peerMesh = peerMesh;

                this.$router.replace({
                    query: {
                        room: peerMesh.room,
                        server: peerMesh.url
                    }
                });

                console.log("Connected", peerMesh);
                this.broadcast('initialState', this.state);

                peerMesh.on('connect', id => {
                    console.log("New connection");
                });

                peerMesh.on('data', (id, data) => {
                    let dataObj = JSON.parse(data.toString());
                    switch (dataObj.event) {
                        case 'initialState':
                            console.log('initialState, replying with my state', id, dataObj.value);
                            this.idStates[id] = dataObj.value;
                            console.log("FORCING UPDATE");
                            this.forceListUpdate();
                            this.send(id, 'state', this.state);
                            break;
                        case 'state':
                            console.log('updating state', id, dataObj.value);
                            this.idStates[id] = dataObj.value;
                            console.log("FORCING UPDATE");
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
                    console.log({stream, id});
                });
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
            state: {
                handler() {
                    localStorage.userName = this.state.user;
                    this.forceListUpdate();
                    this.broadcast('state', this.state);
                },
                deep: true
            }
        },
    }
</script>

<style scoped>

    .messages-list {
        overflow-y: auto;
    }

    .message[me] * {
        text-align: right !important;
    }

    .home {
        display: flex;
        height: 100vh;
    }

    .browser-fab {
        position: fixed;
        transition: transform 0.2s;
    }

    .browser-fab[active] {
        transform: translateX(400px);
    }

    .browser {
        position: fixed;
        width: 400px;
        transform: translateX(-400px);
        height: 100%;
        z-index: 2;
        box-shadow: 0 0 15px 0 rgba(0, 0, 0, 0.1);
        transition: transform 0.2s, box-shadow 0.2s;
    }

    .browser[active] {
        transform: translateX(0px);
    }

    .overlay {
        position: fixed;
        width: 100%;
        height: 100%;
        z-index: 1;
        background-color: rgba(0, 0, 0, 0.3);
    }

    .main-content {
        position: fixed;
        width: 100%;
        height: 100%;
        padding: 15px;
        padding-bottom: 0px;
        /*box-shadow: inset 0 0 0 5000000px rgba(0, 0, 0, 0.03);*/
        transition: left 0.2s;
    }

    .chat-box {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        height: 100%;
    }

    @media only screen and (min-width: 750px) {
        .main-content {
            left: 400px;
            width: calc(100% - 400px);
        }
    }

</style>
