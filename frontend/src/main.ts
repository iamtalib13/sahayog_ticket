import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import Home from './pages/Home.vue'
import './style.css'

const router = createRouter({
  history: createWebHistory('/account_service'),
  routes: [{ path: '/', component: Home }],
})

createApp(App).use(router).mount('#app')
