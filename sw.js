/* 貓咪夢工廠 Service Worker：App Shell + 離線可玩。
 * 同源資源採網路優先、離線退回快取。 */
const PREFIX='catmaker'; // 跟同網域的 meowdoku 分開，免得互刪快取
const SHELL=`${PREFIX}-shell-v61`;
const APP_SHELL=[
  './',
  './index.html',
  './style.css',
  './js/main.js',
  './js/ui.js',
  './js/pet.js',
  './js/room.js',
  './js/academy.js',
  './js/shop.js',
  './js/quiz.js',
  './js/life.js',
  './js/trip.js',
  './js/story.js',
  './js/avatar.js',
  './icons/avatar/acc_backpack.png',
  './icons/avatar/acc_backpack_front.png',
  './icons/avatar/acc_badge.png',
  './icons/avatar/acc_glasses.png',
  './icons/avatar/acc_headphone.png',
  './icons/avatar/acc_scarf.png',
  './icons/avatar/base_g4.png',
  './icons/avatar/base_g5.png',
  './icons/avatar/base_g6.png',
  './icons/avatar/base_g7.png',
  './icons/avatar/base_g8.png',
  './icons/avatar/base_g9.png',
  './icons/avatar/bottom_jeans.png',
  './icons/avatar/bottom_pleat.png',
  './icons/avatar/bottom_shorts.png',
  './icons/avatar/bottom_skirt.png',
  './icons/avatar/bottom_sport.png',
  './icons/avatar/hair_bob.png',
  './icons/avatar/hair_bowl.png',
  './icons/avatar/hair_curly.png',
  './icons/avatar/hair_pony.png',
  './icons/avatar/hair_short.png',
  './icons/avatar/hair_straight.png',
  './icons/avatar/hair_twin.png',
  './icons/avatar/hairback_bob.png',
  './icons/avatar/hairback_bowl.png',
  './icons/avatar/hairback_curly.png',
  './icons/avatar/hairback_pony.png',
  './icons/avatar/hairback_short.png',
  './icons/avatar/hairback_straight.png',
  './icons/avatar/hairback_twin.png',
  './icons/avatar/hat_beanie.png',
  './icons/avatar/hat_beret.png',
  './icons/avatar/hat_bow.png',
  './icons/avatar/hat_cap.png',
  './icons/avatar/hat_straw.png',
  './icons/avatar/shoes_boots.png',
  './icons/avatar/shoes_loafer.png',
  './icons/avatar/shoes_rainboot.png',
  './icons/avatar/shoes_sandal.png',
  './icons/avatar/shoes_sneaker.png',
  './icons/avatar/top_hoodie.png',
  './icons/avatar/top_sailor.png',
  './icons/avatar/top_shirt.png',
  './icons/avatar/top_sweater.png',
  './icons/avatar/top_tshirt.png',
  './icons/avatar/top_vest.png',
  './quizzes/index.json',
  './quizzes/chinese.json',
  './quizzes/math.json',
  './quizzes/science.json',
  './quizzes/social.json',
  './quizzes/english.json',
  './audio.js',
  './manifest.webmanifest',
  './icons/cats.webp',
  './icons/cats_transparent.webp',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/room/litter_box.webp',
  './icons/room/teaser_wand.webp',
  './icons/room/poop_clump.webp',
  './icons/room/cat_idle.webp',
  './icons/room/cat_pet.webp',
  './icons/room/cat_play.webp',
  './icons/room/cat_sleep.webp',
  './icons/room/orange_idle.webp',
  './icons/room/orange_pet.webp',
  './icons/room/orange_play.webp',
  './icons/room/orange_sleep.webp',
  './icons/room/black_idle.webp',
  './icons/room/black_pet.webp',
  './icons/room/black_play.webp',
  './icons/room/black_sleep.webp',
  './icons/room/calico_idle.webp',
  './icons/room/calico_pet.webp',
  './icons/room/calico_play.webp',
  './icons/room/calico_sleep.webp',
  './icons/room/cat_walk.webp',
  './icons/room/cat_run.webp',
  './icons/room/cat_jump.webp',
  './icons/room/cat_lick.webp',
  './icons/room/cat_wash.webp',
  './icons/room/cat_stretch.webp',
  './icons/room/cat_tail.webp',
  './icons/room/cat_yawn.webp',
  './icons/room/cat_scratch.webp',
  './icons/room/cat_eat.webp',
  './icons/room/orange_walk.webp',
  './icons/room/orange_run.webp',
  './icons/room/orange_jump.webp',
  './icons/room/orange_lick.webp',
  './icons/room/orange_wash.webp',
  './icons/room/orange_stretch.webp',
  './icons/room/orange_tail.webp',
  './icons/room/orange_yawn.webp',
  './icons/room/orange_scratch.webp',
  './icons/room/orange_eat.webp',
  './icons/room/black_walk.webp',
  './icons/room/black_run.webp',
  './icons/room/black_jump.webp',
  './icons/room/black_lick.webp',
  './icons/room/black_wash.webp',
  './icons/room/black_stretch.webp',
  './icons/room/black_tail.webp',
  './icons/room/black_yawn.webp',
  './icons/room/black_scratch.webp',
  './icons/room/black_eat.webp',
  './icons/room/calico_walk.webp',
  './icons/room/calico_run.webp',
  './icons/room/calico_jump.webp',
  './icons/room/calico_lick.webp',
  './icons/room/calico_wash.webp',
  './icons/room/calico_stretch.webp',
  './icons/room/calico_tail.webp',
  './icons/room/calico_yawn.webp',
  './icons/room/calico_scratch.webp',
  './icons/room/calico_eat.webp',
  './icons/scenes/park.webp',
  './icons/scenes/cafe.webp',
  './icons/scenes/street.webp',
  './icons/scenes/cinema.webp',
  './icons/scenes/beach.webp',
  './icons/scenes/onsen.webp',
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(SHELL)
      // 逐檔快取：單一檔案 404 不會讓整個 install 失敗（addAll 為全有或全無）
      .then(cache=>Promise.allSettled(APP_SHELL.map(url=>cache.add(url))))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keep=new Set([SHELL]);
    for(const key of await caches.keys()){
      if(key.startsWith(`${PREFIX}-`)&&!keep.has(key))await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  event.respondWith((async()=>{
    try{
      const fresh=await fetch(request);
      if(fresh.ok){
        const copy=fresh.clone();
        event.waitUntil(caches.open(SHELL).then(cache=>cache.put(request,copy)).catch(()=>{}));
      }
      return fresh;
    }catch{
      const cached=await caches.match(request,{ignoreSearch:true});
      if(cached)return cached;
      if(request.mode==='navigate')return(await caches.match('./index.html'))||Response.error();
      return Response.error();
    }
  })());
});
