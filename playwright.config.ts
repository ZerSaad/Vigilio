import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'tests/browser', timeout:60000, fullyParallel:false, workers:1,
  use:{baseURL:'http://127.0.0.1:5173',channel:'msedge',headless:true,viewport:{width:1440,height:1000},launchOptions:{args:['--autoplay-policy=no-user-gesture-required','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'] }},
  webServer:{command:'npm.cmd run dev',url:'http://127.0.0.1:5173',reuseExistingServer:true,timeout:30000},
});
