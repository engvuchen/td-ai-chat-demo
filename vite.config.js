
  import { defineConfig } from 'vite';
  import vue from '@vitejs/plugin-vue';
  import vueJsx from '@vitejs/plugin-vue-jsx';

  export default defineConfig({
    plugins: [vue(), vueJsx()],
    server: {
      port: 3005,
      host: '0.0.0.0',
      proxy: {
        '/v1': {
          target: 'https://api.hunyuan.cloud.tencent.com',
          changeOrigin: true,
        },
      },
    },
  });
