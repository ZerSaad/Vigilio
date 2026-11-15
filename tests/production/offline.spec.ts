import { expect, test } from '@playwright/test';
test('production runs camera inference offline and handles background interruption',async({page,context})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.reload();
  expect(await page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);await page.reload();
  await expect(page.getByRole('heading',{name:'Surveillance',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Démarrer la session'}).click();
  await expect(page.getByRole('heading',{name:'Surveillance indisponible'}).or(page.getByRole('alert'))).toBeVisible({timeout:40000});
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Terminer',exact:true})).toBeVisible();
  await page.evaluate(()=>window.dispatchEvent(new Event('veille:background')));
  await expect(page.getByRole('heading',{name:'Prêt à démarrer'})).toBeVisible();
  await page.getByRole('navigation',{name:'Navigation principale'}).getByRole('button',{name:'Historique'}).click();
  await expect(page.getByText('Caméra · Interrompue',{exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});

