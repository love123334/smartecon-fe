import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from '@/App.vue'
import router from '@/router'
import '@/assets/main.css'
import '@/assets/marketplace.css'
import '@/assets/animations.css'
import '@/assets/motion-surfaces.css'
/* dss-dashboard.css loaded on DSS routes only — see router */

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
