import { test,expect,type Page } from "@playwright/test";
import sharp from "sharp";
async function login(page:Page,role:string){await page.goto('/auth/login');await page.getByLabel('Email',{exact:true}).fill(`${role}@holyhub.test`);await page.getByLabel('Password',{exact:true}).fill('HolyHub-demo-2026!');await page.getByRole('button',{name:'Log in',exact:true}).click();await expect(page).toHaveURL(/\/account$/);}
const png=()=>sharp({create:{width:300,height:300,channels:3,background:'#96b5cd'}}).png().toBuffer();

test('empty catalogue welcomes the first applicant and preserves approval before publishing',async({page,request,browser})=>{
 const reset=await request.post('http://127.0.0.1:54331/__test/reset?empty=1');expect(reset.ok()).toBe(true);
 await page.goto('/');await expect(page.locator('.product-card')).toHaveCount(0);await expect(page.getByRole('heading',{name:'Be among our first brands.'})).toBeVisible();
 expect((await request.get('/api/health')).status()).toBe(503);
 await page.goto('/auth/signup?next=/account/business');
 await page.getByLabel('Name',{exact:true}).fill('New founder');await page.getByLabel('Email',{exact:true}).fill('newfounder@holyhub.test');
 await page.getByLabel('Password',{exact:true}).fill('HolyHub-demo-2026!');await page.getByLabel('Confirm password',{exact:true}).fill('HolyHub-demo-2026!');
 await page.getByRole('button',{name:'Create account',exact:true}).click();await expect(page.getByText('Check your email to confirm your account',{exact:false})).toBeVisible();
 // The local adapter does not send email; real SMTP confirmation is a separate launch gate.
 await login(page,'newfounder');await page.goto('/account/business');
 await page.getByLabel('Business or brand name').fill('First founder studio');await page.getByLabel('Category',{exact:true}).selectOption('Art & Creators');
 await page.getByLabel('Location',{exact:true}).fill('London');await page.getByLabel('Short introduction').fill('Original artwork inspired by faith.');
 await page.getByLabel('Your story & what you offer').fill('Our Christian-owned studio makes original artwork for people to enjoy at home.');
 await page.getByLabel('Website or social profile').fill('https://example.com/founder');await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Submit for review'}).click();await expect(page.getByText('In review',{exact:true})).toBeVisible();
 await page.getByRole('link',{name:'Manage products'}).click();await page.goto('/seller/products/new');
 await page.getByLabel('Product name').fill('First founder print');await page.getByLabel('Description',{exact:true}).fill('An original faith-inspired print from our new studio.');
 await page.getByLabel('Category',{exact:true}).selectOption('Art & Prints');await page.getByLabel('Price (£)').fill('12.00');await page.getByLabel('Stock available').fill('5');
 await page.getByLabel('Delivery or fulfilment information').fill('Contact our studio directly for delivery details.');
 await page.getByRole('button',{name:'Save draft & add photos'}).click();await expect(page.getByText('draft product',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Publish product',exact:true}).click();await expect(page.getByText('Your lister application must be approved before publishing',{exact:false})).toBeVisible();
 const visitor=await browser.newPage();await visitor.goto('http://127.0.0.1:3102/products');await expect(visitor.getByRole('heading',{name:'First founder print'})).toHaveCount(0);await visitor.close();
});
test.beforeEach(async({request})=>{const response=await request.post('http://127.0.0.1:54331/__test/reset');expect(response.ok()).toBe(true);});

test('responsive discovery, real image access, filters and unpaid multi-seller basket',async({page,request})=>{
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});await page.goto('/');await expect(page.getByText('Connect. Discover. Grow.',{exact:true}).first()).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.goto('/products');await expect(page.getByText('4 products to discover')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await expect.poll(()=>page.locator('.product-image').first().evaluate((i:HTMLImageElement)=>i.complete&&i.naturalWidth>0)).toBe(true);
 await page.screenshot({path:'test-results/marketplace-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/marketplace-mobile.png',fullPage:true});
 await page.getByLabel('Search products').fill('Hope');await page.getByRole('button',{name:'Find products'}).click();await expect(page.getByText('1 product to discover')).toBeVisible();
 await login(page,'customer');
 for(const name of ['Hope art print','Everyday tote']){await page.goto('/products');await page.getByRole('heading',{name,exact:true}).getByRole('link').click();await page.getByRole('button',{name:'Add to basket'}).click();await expect(page.getByText('Basket updated.',{exact:true})).toBeVisible();}
 await expect(page.getByText('£40.00',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Review order'}).click();await expect(page).toHaveURL(/\/checkout\//);await expect(page.getByRole('button',{name:/payment coming soon/})).toBeDisabled();
 expect((await request.post('/api/checkout')).status()).toBe(503);expect((await request.post('/api/stripe/webhook',{data:'{}'})).status()).toBe(503);
});

test('seller saves, uploads, publishes, edits and archives a product',async({page,browser})=>{
 await login(page,'seller');await page.goto('/seller/products/new');
 await page.getByLabel('Product name').fill('New faith journal');await page.getByLabel('Description',{exact:true}).fill('A thoughtful new journal for prayer, reflection and everyday gratitude.');await page.getByLabel('Category',{exact:true}).selectOption('Books & Stationery');await page.getByLabel('Price (£)',{exact:true}).fill('12.50');await page.getByLabel('Stock available').fill('12');await page.getByLabel('Delivery or fulfilment information').fill('Delivery details are confirmed before purchasing.');await page.getByRole('button',{name:'Save draft & add photos'}).click();await expect(page).toHaveURL(/\/seller\/products\/[a-f0-9-]+/);
 const productUrl=page.url().split('?')[0];
 await page.getByLabel('Add a photo').setInputFiles({name:'too-large.png',mimeType:'image/png',buffer:Buffer.alloc(4_000_001)});expect(await page.getByLabel('Add a photo').evaluate((el:HTMLInputElement)=>el.validationMessage)).toContain('4 MB');
 await page.getByLabel('Add a photo').setInputFiles({name:'journal.png',mimeType:'image/png',buffer:await png()});await page.getByRole('button',{name:'Upload photo',exact:true}).click();await expect(page.getByText('Image uploaded.',{exact:true})).toBeVisible();await page.getByLabel('Add a photo').setInputFiles({name:'journal-second.png',mimeType:'image/png',buffer:await png()});await page.getByRole('button',{name:'Upload photo',exact:true}).click();await expect(page.locator('.photo-grid img')).toHaveCount(2);await page.getByRole('button',{name:'Publish product'}).click();await expect(page.getByRole('link',{name:'View product'})).toBeVisible();
 const context=await browser.newContext(),visitor=await context.newPage();await visitor.goto('http://127.0.0.1:3102/products?q=New');await expect(visitor.getByRole('heading',{name:'New faith journal',exact:true})).toBeVisible();await visitor.getByRole('heading',{name:'New faith journal',exact:true}).getByRole('link').click();await expect(visitor.getByRole('link',{name:'Visit the brand’s website',exact:false})).toHaveAttribute('href','https://example.com/');await visitor.getByRole('button',{name:'View photo 2 of 2'}).click();await expect(visitor.getByRole('button',{name:'View photo 2 of 2'})).toHaveAttribute('aria-pressed','true');await expect(visitor.getByText('Photo 2 of 2',{exact:true})).toBeVisible();await visitor.getByRole('button',{name:'View photo 1 of 2'}).focus();await visitor.keyboard.press('Enter');await expect(visitor.getByText('Photo 1 of 2',{exact:true})).toBeVisible();
 await page.getByLabel('Price (£)',{exact:true}).fill('13.50');await page.getByRole('button',{name:'Save product',exact:true}).click();await expect(page.getByLabel('Price (£)',{exact:true})).toHaveValue('13.50');
 await page.goto(productUrl);await page.getByRole('button',{name:'Archive product'}).click();await expect(page.getByText('archived product',{exact:true})).toBeVisible();await visitor.reload();await expect(visitor.getByRole('heading',{name:'New faith journal',exact:true})).toHaveCount(0);await context.close();
});

test('customer evidence, seller response, human decision and appeal work together',async({page,browser})=>{
 await login(page,'customer');await page.goto('/orders');await page.locator('.record-row').first().click();await page.getByRole('article').filter({has:page.getByRole('heading',{name:'Hope art print'})}).getByRole('link',{name:'Request a refund'}).click();
 await page.getByLabel('What is the issue?').selectOption('damaged');await page.getByLabel('Tell us what happened').fill('The print arrived torn across the centre and is not usable.');await page.getByLabel('Have you contacted the seller?').selectOption('yes');await page.getByLabel('What outcome are you asking for?').fill('Please refund the damaged print.');await page.getByRole('button',{name:'Send refund request'}).click();await expect(page).toHaveURL(/\/refunds\/[a-f0-9-]+/);const caseUrl=page.url().split('?')[0];
 await page.getByLabel('Add evidence').setInputFiles({name:'evidence.png',mimeType:'image/png',buffer:await png()});await page.getByRole('button',{name:'Upload evidence'}).click();await expect(page.getByRole('link',{name:'Evidence 1'})).toBeVisible();const evidenceUrl=await page.getByRole('link',{name:'Evidence 1'}).getAttribute('href');
 const sellerContext=await browser.newContext({baseURL:'http://127.0.0.1:3102'}),seller=await sellerContext.newPage();await login(seller,'seller');await seller.goto(caseUrl);await seller.getByLabel('Explain your position and evidence').fill('We have reviewed the image and agree that the print arrived damaged.');await seller.getByRole('button',{name:'Submit response for review'}).click();await expect(seller.getByText(/^under review$/i)).toBeVisible();
 const adminContext=await browser.newContext({baseURL:'http://127.0.0.1:3102'}),admin=await adminContext.newPage();await login(admin,'admin');await admin.goto(caseUrl);await admin.getByLabel('Decision',{exact:true}).selectOption('partially_approved');await admin.getByLabel('Approved amount').fill('9.00');await admin.getByLabel('Reasons for the decision').fill('The submitted evidence supports a partial refund for the damaged print.');await admin.getByRole('button',{name:'Record decision'}).click();await expect(admin.getByText('Decision recorded. No money has been sent;', {exact:false})).toBeVisible();
 await page.reload();await page.getByLabel('Explain your appeal').fill('The whole print is damaged and a partial refund does not resolve this.');await page.getByRole('button',{name:'Submit appeal',exact:true}).click();await expect(page.getByText(/^appealed$/i)).toBeVisible();
 const visitor=await browser.newContext();expect((await visitor.request.get(`http://127.0.0.1:3102${evidenceUrl}`)).status()).toBe(401);await visitor.close();await sellerContext.close();await adminContext.close();
});

test('admin tools render and permission controls cannot be bypassed',async({page,browser})=>{
 await login(page,'admin');for(const url of ['/admin','/admin/marketplace','/admin/marketplace?view=users','/admin/marketplace?view=sellers','/admin/marketplace?view=orders','/admin/settings','/admin/refunds','/admin/audit','/notifications']){await page.goto(url);await expect(page.getByRole('heading',{level:1})).toBeVisible();await expect(page.getByRole('heading',{name:'We couldn’t load this just now.'})).toHaveCount(0);}
 await page.goto('/admin/marketplace');const product=page.getByRole('article').filter({has:page.getByRole('heading',{name:'Hope art print',exact:true})});await product.getByRole('button',{name:'Hide unsafe product'}).click();await expect(page.getByText('Change saved and recorded', {exact:false})).toBeVisible();
 const context=await browser.newContext({baseURL:'http://127.0.0.1:3102'}),customer=await context.newPage();await login(customer,'customer');await customer.goto('/admin/settings');await expect(customer).toHaveURL(/\/account\?error=/);await customer.goto('/products?q=Hope');await expect(customer.getByRole('heading',{name:'Hope art print',exact:true})).toHaveCount(0);await context.close();
});
test('Deepgrids Sans really renders and current account navigation is clear',async({page})=>{
 await page.goto('/');
 await page.evaluate(()=>document.fonts.ready);
 const session=await page.context().newCDPSession(page);
 await session.send('DOM.enable');await session.send('CSS.enable');
 const {root}=await session.send('DOM.getDocument');
 const {nodeId}=await session.send('DOM.querySelector',{nodeId:root.nodeId,selector:'h1'});
 const {fonts}=await session.send('CSS.getPlatformFontsForNode',{nodeId});
 expect(fonts.some((font:{familyName:string;isCustomFont:boolean;glyphCount:number})=>font.familyName==='Deepgrids Sans'&&font.isCustomFont&&font.glyphCount>0)).toBe(true);
 await session.detach();
 await login(page,'seller');await page.goto('/seller/products/new');
 await expect(page.getByRole('navigation',{name:'seller navigation'}).getByRole('link',{name:'Products',exact:true})).toHaveAttribute('aria-current','page');
 await expect(page.locator('.market-nav [aria-current="page"]')).toHaveCount(1);
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.getByLabel('Product name').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
 }
 await page.goto('/seller/finances');
 await expect(page.getByRole('button',{name:'Connect Stripe — coming soon'})).toBeDisabled();
 expect(await page.getByRole('button',{name:'Connect Stripe — coming soon'}).evaluate(el=>getComputedStyle(el).cursor)).toBe('not-allowed');
});
