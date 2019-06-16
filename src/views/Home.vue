<template>
    <div class="home">
        <server-browser class="browser"
                        :server="$route.query.server"
                        :room="$route.query.room"
                        v-on:connect="connected"
                        v-on:disconnect="disconnected"></server-browser>
        <md-content class="main-content">
            <h3>Your name: {{userName}}</h3>
            <md-list class="messages-list" v-if="messages.length > 0">
                <md-list-item v-for="message in messages" class="message-item">
                    <div class="md-list-item-text">
                        <span>{{message.from}}</span>
                        <span>{{message.text}}</span>
                    </div>
                </md-list-item>
            </md-list>
            <md-field>
                <label>Type a message</label>
                <md-input @keypress.enter="sendMessage(message);message=''" v-model="message"></md-input>
            </md-field>
        </md-content>
    </div>
</template>

<script>
    import ServerBrowser from "@/components/ServerBrowser";
    import rug from 'random-username-generator';

    export default {
        name: 'home',
        components: {ServerBrowser},
        data() {
            return {
                message: '',
                messages: [],
                peerMesh: null,
                userName: rug.generate(),
            }
        },
        async mounted() {
            if (localStorage.getItem('userName') !== null) {
                this.userName = localStorage.userName;
            }
        },
        methods: {
            sendMessage(message) {
                if (!this.peerMesh) return;

                let msgObject = {from: this.userName, text: message};
                this.showMessage(msgObject);
                this.peerMesh.broadcast(JSON.stringify(msgObject));
            },
            showMessage(message) {
                this.messages.push(message);
                setTimeout(() => {
                    let items = document.querySelectorAll('.message-item');
                    items[items.length - 1].scrollIntoView();
                });
            },
            connected(peerMesh) {
                this.peerMesh = peerMesh;

                this.$router.replace({
                    query: {
                        room: peerMesh.room,
                        server: peerMesh.url
                    }
                });

                console.log("Connected", peerMesh);

                peerMesh.on('data', (id, data) => {
                    let msgObject = JSON.parse(data.toString());
                    this.showMessage(msgObject);
                });
                peerMesh.on('stream', (id, stream) => {
                    console.log({stream, id});
                });
            },
            disconnected(peerMesh) {
                this.$router.replace({});
                console.log("Disconnected", peerMesh);
            },
        },
    }
</script>

<style scoped>
    .messages-list {
        overflow-y: auto;
    }

    .home {
        display: flex;
        height: 100vh;
    }

    .browser {
        width: 400px;
    }

    .main-content {
        padding: 15px;
        flex-grow: 4;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }
</style>
