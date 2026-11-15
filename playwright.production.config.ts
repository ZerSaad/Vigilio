import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'tests/production', timeout:60000, workers:1,
  use:{baseURL:'http://127.0.0.1:5174',channel:'msedge',headless:true,launchOptions:{args:['--autoplay-policy=no-user-gesture-required','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']}},
  webServer:{command:'npm.cmd run preview -- --port 5174',url:'http://127.0.0.1:5174',reuseExistingServer:false,timeout:30000},
});
