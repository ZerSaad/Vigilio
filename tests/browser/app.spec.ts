import { expect, test } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
test('simulation: calibration, alarm, recovery and persisted history',async({page})=>{
  await page.addInitScript(()=>{
    (window as unknown as {toneCount:number}).toneCount=0;
    const original=AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator=function(){(window as unknown as {toneCount:number}).toneCount++;return original.call(this);};
  });
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Surveillance',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Essayer la simulation'}).click();
  await expect(page.getByRole('heading',{name:'Surveillance normale'})).toBeVisible({timeout:12000});
  await page.getByRole('button',{name:'Clignements',exact:true}).click();
  await page.waitForTimeout(1000);
  await expect(page.getByRole('heading',{name:'Pause nécessaire'})).toHaveCount(0);
  await page.getByRole('button',{name:'Yeux fermés',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Pause nécessaire'})).toBeVisible({timeout:5000});
  expect(await page.evaluate(()=>(window as unknown as {toneCount:number}).toneCount)).toBeGreaterThanOrEqual(1);
  await page.getByRole('button',{name:'Yeux ouverts',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Surveillance normale'})).toBeVisible({timeout:4000});
  const count=await page.evaluate(()=>(window as unknown as {toneCount:number}).toneCount);
  await page.waitForTimeout(1600);
  expect(await page.evaluate(()=>(window as unknown as {toneCount:number}).toneCount)).toBe(count);
  await page.getByRole('button',{name:'Visage absent',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Surveillance indisponible'})).toBeVisible();
  await page.getByRole('button',{name:'Terminer',exact:true}).click();
  await page.getByRole('navigation',{name:'Navigation principale'}).getByRole('button',{name:'Historique'}).click();
  await expect(page.getByText('1 alerte',{exact:true})).toBeVisible();
  const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'CSV',exact:true}).click();
  const file=await downloadEvent;expect(readFileSync((await file.path())!,'utf8')).toContain('simulation');
  await page.reload();
  await page.getByRole('navigation',{name:'Navigation principale'}).getByRole('button',{name:'Historique'}).click();
  await expect(page.getByText('1 alerte',{exact:true})).toBeVisible();
  await page.screenshot({path:'test-results/history-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Effacer l’historique'}).click();
  await page.getByRole('button',{name:'Annuler',exact:true}).click();
  await expect(page.getByText('1 alerte',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Effacer l’historique'}).click();
  await page.getByRole('button',{name:'Effacer les sessions',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Aucune session enregistrée'})).toBeVisible();
  expect(errors).toEqual([]);
});
test('real face: local inference calibrates eyes from the official portrait fixture',async({page})=>{
  test.skip(!existsSync('tests/fixtures/portrait.jpg'),'Run node scripts/fetch-test-fixture.mjs to download the official test image.');
  await page.route('**/test-portrait.jpg',route=>route.fulfill({body:readFileSync('tests/fixtures/portrait.jpg'),contentType:'image/jpeg'}));
  await page.addInitScript(()=>{
    navigator.mediaDevices.getUserMedia=async()=>{
      const image=new Image();image.src='/test-portrait.jpg';await image.decode();
      const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;
      const ctx=canvas.getContext('2d')!;
      // A webcam-like head-and-shoulders crop, rather than the full-body portrait.
      const draw=()=>{ctx.fillStyle='#f5f5f5';ctx.fillRect(0,0,640,480);ctx.drawImage(image,image.width*0.22,0,image.width*0.56,image.height*0.45,80,0,480,480);};
      draw();const interval=setInterval(draw,60);const stream=canvas.captureStream(15);
      stream.getVideoTracks()[0].addEventListener('ended',()=>clearInterval(interval));return stream;
    };
  });
  await page.goto('/');await page.getByRole('button',{name:'Démarrer la session'}).click();
  await expect(page.getByRole('heading',{name:'Surveillance normale'}).or(page.getByRole('alert'))).toBeVisible({timeout:35000});
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Surveillance normale'})).toBeVisible();
  await page.locator('.analysis-details > summary').click();
  await expect(page.locator('.analysis-metrics > div').filter({hasText:'Abaissement de la tête'}).locator('dd')).toContainText('°');
  await page.screenshot({path:'test-results/real-face.png',fullPage:true});
  await page.getByRole('button',{name:'Terminer',exact:true}).click();
});
test('camera: actual local model loads and missing face is unavailable',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Démarrer la session'}).click();
  await expect(page.getByRole('button',{name:'Terminer',exact:true}).or(page.getByRole('alert'))).toBeVisible({timeout:45000});
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Surveillance indisponible'})).toBeVisible({timeout:15000});
  await page.screenshot({path:'test-results/camera-model.png',fullPage:true});
  await page.getByRole('button',{name:'Terminer',exact:true}).click();
});
test('head drop and repeated yawns trigger progressive audio and vibration',async({page})=>{
  await page.addInitScript(()=>{
    const target=window as unknown as {vibrationPatterns:unknown[]};target.vibrationPatterns=[];
    Object.defineProperty(navigator,'vibrate',{configurable:true,value:(pattern:unknown)=>{target.vibrationPatterns.push(pattern);return true;}});
  });
  await page.goto('/');await page.getByRole('button',{name:'Essayer la simulation'}).click();
  await expect(page.getByRole('heading',{name:'Surveillance normale'})).toBeVisible({timeout:12000});
  await page.getByRole('button',{name:'Tête abaissée',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Pause nécessaire'})).toBeVisible({timeout:5000});
  await expect(page.locator('.status-copy')).toContainText('Tête abaissée');
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {vibrationPatterns:unknown[]}).vibrationPatterns.some(p=>JSON.stringify(p)==='[80,120,80]')),{timeout:6000}).toBe(true);
  await page.getByRole('button',{name:'Yeux ouverts',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Surveillance normale'})).toBeVisible({timeout:4000});
  await page.getByRole('button',{name:'Bâillements répétés',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Vigilance requise'})).toBeVisible({timeout:12000});
  await expect(page.locator('.status-copy')).toContainText('Bâillements répétés');
  await page.getByRole('button',{name:'Terminer',exact:true}).click();
});
test('layouts, settings persistence and history deletion',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Signal des yeux',exact:true})).toHaveCount(0);
  await page.locator('.analysis-details > summary').click();
  await expect(page.getByRole('heading',{name:'Signal des yeux',exact:true})).toBeVisible();
  await page.locator('.analysis-details > summary').click();
  for(const width of [320,390,768,1024,1440]){
    await page.setViewportSize({width,height:1000});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    if(width===390||width===1440)await page.screenshot({path:`test-results/home-${width}.png`,fullPage:true});
  }
  await page.emulateMedia({colorScheme:'dark'});
  await expect(page.getByRole('button',{name:'Démarrer la session'})).toHaveCSS('background-color','rgb(179, 211, 196)');
  await expect(page.getByRole('navigation',{name:'Navigation principale'}).getByRole('button',{name:'Surveillance'})).toHaveCSS('color','rgb(179, 211, 196)');
  await page.screenshot({path:'test-results/home-dark.png',fullPage:true});
  await page.emulateMedia({colorScheme:'light'});
  await page.getByRole('navigation',{name:'Navigation principale'}).getByRole('button',{name:'Réglages'}).click();
  await page.screenshot({path:'test-results/settings-desktop.png',fullPage:true});
  await page.getByRole('slider',{name:'Durée de fermeture avant alerte'}).fill('2.5');
  await page.reload();
  await page.getByRole('navigation',{name:'Navigation principale'}).getByRole('button',{name:'Réglages'}).click();
  await expect(page.getByRole('slider',{name:'Durée de fermeture avant alerte'})).toHaveValue('2.5');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'test-results/settings-mobile.png',fullPage:true});
  await page.getByRole('navigation',{name:'Navigation mobile'}).getByRole('button',{name:'Historique'}).click();
  await expect(page.getByRole('heading',{name:'Historique',exact:true})).toBeVisible();
});
test('sunglasses keep posture and yawning active, darkness disables all channels',async({page})=>{
  await page.goto('/');await page.getByRole('switch',{name:'Lunettes de soleil',exact:true}).check();
  await page.getByRole('button',{name:'Essayer la simulation'}).click();
  await expect(page.getByRole('heading',{name:'Surveillance limitée',exact:true})).toBeVisible({timeout:12000});
  await expect(page.locator('.visibility-banner')).toContainText('Lunettes de soleil signalées');
  await page.getByRole('button',{name:'Tête abaissée',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Pause nécessaire'})).toBeVisible({timeout:5000});
  await page.getByRole('button',{name:'Yeux ouverts',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Surveillance limitée',exact:true})).toBeVisible({timeout:4000});
  await page.getByRole('button',{name:'Bâillements répétés',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Vigilance requise'})).toBeVisible({timeout:8000});
  await expect(page.locator('.status-copy')).toContainText('au moins 2');
  await page.getByRole('button',{name:'Obscurité',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Surveillance indisponible',exact:true})).toBeVisible();
  await expect(page.locator('.visibility-banner')).toContainText('Luminosité trop faible');
  await page.getByRole('button',{name:'Terminer',exact:true}).click();
});
test('dim real portrait is brightened for inference and preview with limited surveillance',async({page})=>{
  test.skip(!existsSync('tests/fixtures/portrait.jpg'),'Official portrait fixture unavailable.');
  await page.route('**/test-portrait.jpg',route=>route.fulfill({body:readFileSync('tests/fixtures/portrait.jpg'),contentType:'image/jpeg'}));
  await page.addInitScript(()=>{
    navigator.mediaDevices.getUserMedia=async()=>{
      const image=new Image();image.src='/test-portrait.jpg';await image.decode();
      const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;const ctx=canvas.getContext('2d')!;
      const draw=()=>{
        ctx.globalCompositeOperation='source-over';ctx.fillStyle='#f5f5f5';ctx.fillRect(0,0,640,480);
        ctx.drawImage(image,image.width*0.22,0,image.width*0.56,image.height*0.45,80,0,480,480);
        ctx.globalCompositeOperation='multiply';ctx.fillStyle='rgb(64,64,64)';ctx.fillRect(0,0,640,480);ctx.globalCompositeOperation='source-over';
      };
      draw();const interval=setInterval(draw,80),stream=canvas.captureStream(12);
      stream.getVideoTracks()[0].addEventListener('ended',()=>clearInterval(interval));return stream;
    };
  });
  await page.goto('/');await page.getByRole('button',{name:'Démarrer la session'}).click();
  await expect(page.getByRole('heading',{name:'Surveillance limitée',exact:true}).or(page.getByRole('alert'))).toBeVisible({timeout:35000});
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.visibility-banner')).toContainText('Faible luminosité');
  await page.locator('.analysis-details > summary').click();
  await expect(page.locator('.analysis-metrics > div').filter({hasText:'Abaissement de la tête'}).locator('dd')).toContainText('°');
  await expect(page.getByText('Correction gamma et contraste active.',{exact:true})).toBeVisible();
  const brightened=await page.evaluate(()=>{
    const video=document.querySelector('video')!,preview=document.querySelector('.camera-view > canvas') as HTMLCanvasElement;
    const raw=document.createElement('canvas');raw.width=preview.width;raw.height=preview.height;raw.getContext('2d')!.drawImage(video,0,0,raw.width,raw.height);
    const mean=(canvas:HTMLCanvasElement)=>{const pixels=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;let sum=0,count=0;for(let i=0;i<pixels.length;i+=64){sum+=pixels[i]+pixels[i+1]+pixels[i+2];count++;}return sum/count;};
    return mean(preview)>mean(raw)*1.3;
  });
  expect(brightened).toBe(true);
  await page.screenshot({path:'test-results/low-light.png',fullPage:true});
  await page.getByRole('button',{name:'Terminer',exact:true}).click();
});
test('mouth-cover guidance stays yellow and does not suppress an eye-closure alarm',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Essayer la simulation'}).click();
  await expect(page.getByRole('heading',{name:'Surveillance normale'})).toBeVisible({timeout:12000});
  await page.getByRole('button',{name:'Main devant la bouche',exact:true}).click();
  await expect(page.locator('.mouth-warning')).toContainText('baissez votre main');
  await expect(page.locator('.mouth-warning')).toHaveCSS('background-color','rgb(252, 245, 232)');
  await expect(page.getByRole('heading',{name:'Surveillance limitée',exact:true})).toBeVisible();
  await page.locator('.analysis-details > summary').click();
  await expect(page.locator('.analysis-metrics > div').filter({hasText:'Ouverture des yeux'}).locator('dd')).toContainText('0.29');
  await expect(page.locator('.analysis-metrics > div').filter({hasText:'Bâillements possibles'}).locator('dd')).toHaveText('0');
  await page.getByRole('button',{name:'Main + yeux fermés',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Pause nécessaire'})).toBeVisible({timeout:5000});
  await expect(page.locator('.status-copy')).toContainText('Yeux fermés');
  await page.getByRole('button',{name:'Terminer',exact:true}).click();
});
test('mobile visual alert follows the audio delay, respects reduced motion and can be dismissed',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  await page.getByRole('button',{name:'Essayer la simulation'}).click();
  await expect(page.getByRole('heading',{name:'Surveillance normale'})).toBeVisible({timeout:12000});
  await page.getByRole('button',{name:'Yeux fermés',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Pause nécessaire'})).toBeVisible({timeout:5000});
  const dialog=page.getByRole('dialog',{name:'Arrêtez-vous en sécurité'});
  await expect(dialog).toHaveCount(0);
  await expect(dialog).toBeVisible({timeout:6000});
  const bounds=await dialog.boundingBox();
  expect(bounds?.x).toBe(0);expect(bounds?.y).toBe(0);expect(bounds?.width).toBe(390);expect(bounds?.height).toBe(844);
  await expect(dialog).toHaveCSS('animation-duration','4s');
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(dialog).toHaveCSS('animation-name','none');
  await page.screenshot({path:'test-results/visual-alert-mobile.png',fullPage:false});
  await page.getByRole('button',{name:'Masquer l’alerte visuelle'}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Pause nécessaire'})).toBeVisible();
  await page.getByRole('button',{name:'Yeux ouverts',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Surveillance normale'})).toBeVisible({timeout:4000});
  await page.getByRole('button',{name:'Yeux fermés',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Pause nécessaire'})).toBeVisible({timeout:5000});
  await page.getByRole('button',{name:'Yeux ouverts',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Surveillance normale'})).toBeVisible({timeout:4000});
  await page.waitForTimeout(4500);await expect(dialog).toHaveCount(0);
  await page.getByRole('button',{name:'Terminer',exact:true}).click();
});

