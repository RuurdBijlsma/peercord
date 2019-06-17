import Vue from 'vue'
import App from './App.vue'
import './registerServiceWorker'
import VueMaterial from 'vue-material'
import 'vue-material/dist/vue-material.min.css'
import 'vue-material/dist/theme/default.css'
import 'vue-simple-context-menu/dist/vue-simple-context-menu.css'
import VueSimpleContextMenu from 'vue-simple-context-menu'
import router from './router'

Vue.config.productionTip = false;

Vue.component('vue-simple-context-menu', VueSimpleContextMenu);
Vue.use(VueMaterial);

new Vue({
  router,
  render: h => h(App)
}).$mount('#app');
