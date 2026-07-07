/* KMTY Orchid — i18n (EN / 中文 / RU / VI) + map labels, pins and base cards.
   Owns all SVG map text (the template runtime cannot render text inside <svg>). */
(function () {
'use strict';

/* ============================================================ dictionary */
var ACC = {
  h1: '<span style="color:#E7B7CF;font-weight:460;font-style:italic;">',
  t: '<span style="color:#ff9fcb;font-style:italic;">',
  st: '<span style="color:#2F5D3A;font-style:italic;">',
  v: '<span data-colorword style="color:#E38BB0;transition:color .5s ease;font-style:italic;">',
  sh: '<span style="color:#B0552F;font-style:italic;">',
  c: '<span style="color:#E7B7CF;font-style:italic;">',
  s: '</span>',
  b: '<strong style="font-weight:600;color:#F7F3EA;">', bs: '</strong>',
  i: '<span style="font-style:italic;">', is: '</span>'
};
var SEP = ' <span style="color:#C86B3E;">/</span> ';

var I18N = {
/* ------------------------------------------------------------ ENGLISH */
en: {
  'nav.s1':'01 Story','nav.s2':'02 Grow','nav.s3':'03 Products','nav.s4':'04 Ship','nav.cta':'Request catalog',
  'm.story':'Our story','m.grow':'How we grow','m.products':'Products','m.ship':'How it ships','m.cta':'Request catalog →',
  'hero.kicker':'Kunming Tong Yi · Est. 2000',
  'hero.h1':'Orchids in every color imaginable — ' + ACC.h1 + 'and a few you can’t.' + ACC.s,
  'hero.lede':'China’s largest exporter of flowering Phalaenopsis, grown from flask to bloom in the Yunnan highlands — home of the hand-marbled Art Orchid, found nowhere else on earth.',
  'hero.cta1':'Read our story','hero.cta2':'See the products',
  'hero.s1':'flowering-orchid exporter, China','hero.s2':'of national export share','hero.s3':'product lines · seedling→cut','hero.s4':'growing in Yunnan since',
  'hero.mkts':'Export markets',
  'mkt.kr':'South Korea','mkt.vn':'Vietnam','mkt.ph':'Philippines','mkt.th':'Thailand','mkt.sg':'Singapore','mkt.bn':'Brunei','mkt.db':'Dubai','mkt.om':'Oman','mkt.hk':'Hong Kong',
  'ticker':'SEEDLINGS'+SEP+'POT FLOWER'+SEP+'CUT FLOWER'+SEP+'VIRUS-FREE PROPAGATION'+SEP+'EUROPEAN-CERTIFIED GREENHOUSES'+SEP+'THE ART ORCHID'+SEP+'KOREA · VIETNAM · PHILIPPINES · THAILAND · SINGAPORE · DUBAI · OMAN · BRUNEI · HONG KONG'+SEP,
  't.eyebrow':'Yunnan · 25°N plateau','t.h2':'Grown where the ' + ACC.t + 'clouds' + ACC.s + ' rest','t.zhsub':'Where the clouds rest, orchids grow',
  't.para':'Monsoon air climbs into mountain here — a cool, luminous plateau where mist feeds the canopy the year round. Kunming’s naturally wide day-to-night temperature swings and the stronger ultraviolet light of high altitude make this the finest natural environment on earth for flowering orchids — ' + ACC.i + 'Phalaenopsis' + ACC.is + ' answer with firmer spikes and deeper colour, on a fraction of the energy a lowland glasshouse burns.',
  't.st1':'Elevation','t.st2':'Mean temp','t.st3':'Day–night swing','t.st4':'Sunlight','t.st5':'Growing window',
  't.adv1.t':'A wide day–night swing','t.adv1.b':'Warm days build sugars, cold mountain nights lock them in — the natural trigger for firmer spikes and deeper, longer-holding colour.',
  't.adv2.t':'Stronger high-altitude sun','t.adv2.b':'Thin plateau air lets more ultraviolet through, deepening petal pigment and toughening every plant — richer blooms that travel and last.',
  't.lg1':'Yunnan','t.lg2':'Bordering regions','t.lg3':'Growing bases',
  'map.kunming.name':'Kunming · Songming HQ','map.kunming.sub':'3 growing bases · flask to bloom',
  'map.wenshan.name':'Wenshan base','map.wenshan.sub':'Seedling nursery',
  'map.hq':'HQ','map.base':'Base',
  'st.eyebrow':'01 / Our story',
  'st.h2':'A Taiwanese-founded orchid house in the Yunnan highlands, breeding and raising Phalaenopsis from tissue-culture flask to blooming plant — ' + ACC.st + 'all in one place.' + ACC.s,
  'st.p1':'Since 2000, Kunming Tong Yi Biotechnology has specialised in Phalaenopsis breeding, superior-variety propagation, seedlings and industrial-scale flowering plants — from our bases at the Xiaojie Flower Park in Songming County, Yunnan.',
  'st.p2':'Since 2020, customs data has ranked us China’s largest exporter of flowering Phalaenopsis, holding more than half the national export share — with a portfolio of invention patents and New Plant Variety rights behind every plant.',
  'st.b1':'exporter of flowering<br>Phalaenopsis in China','st.b2':'national export<br>share, since 2020','st.b3':'years of breeding<br>&amp; cultivation','st.b4':'export markets across<br>Asia &amp; the Gulf',
  'st.f0':'FIG. 01 — The Kunming Tong Yi family, Spring Festival at Songming HQ','st.f1':'FIG. 02 — Automated growing house, Songming','st.f2':'FIG. 03 — Mixed varieties, fresh off the bench','st.f3':'FIG. 04 — Reefer loading, Kunming HQ',
  'g.eyebrow':'02 / How we grow','g.h2':'Eighteen months, ' + ACC.st + 'four seasons of care.' + ACC.s,
  'g.note':'One plant’s whole journey, laid out below — follow the stem from flask to bloom.',
  'g.s1.chip':'Months 0–5','g.s1.word':'one','g.s1.title':'Flask &amp; seedling','g.s1.body':'Only healthy, virus-free specimens enter propagation — every mother plant is screened with PCR and ELISA before a single flask is poured.','g.s1.fact':'Lab-certified virus-free stock','g.s1.note':'— sown in glass, in sterile air: a whole greenhouse inside a bottle.',
  'g.s2.chip':'Months 5–11','g.s2.word':'two','g.s2.title':'Vegetative growth','g.s2.body':'Seedlings spend at least four to six climate-controlled months per growth interval, with light, humidity and irrigation tuned by sensor data around the clock.','g.s2.fact':'4–6 months per interval, automated','g.s2.note':'— warm days and misted dawns; the leaves thicken season by season.',
  'g.s3.chip':'Months 11–16','g.s3.word':'three','g.s3.title':'Spike &amp; cold room','g.s3.body':'A five-to-six-month cold treatment triggers strong, uniform spikes — the long Yunnan autumn does naturally what other growers force.','g.s3.fact':'5–6 month cold treatment','g.s3.note':'— the mountain autumn is our cold room, with the doors left open.',
  'g.s4.chip':'Months 16–18','g.s4.word':'four','g.s4.title':'Bloom &amp; grade','g.s4.body':'Plants bloom on the bench and are hand-graded — flower count, spike length, stem, leaf and root health — before a single one is boxed.','g.s4.fact':'Graded by five criteria','g.s4.note':'— five checks by hand before any plant earns its box.',
  'gr.eyebrow':'Export quality standard','gr.h3':'Graded like gemstones.','gr.side':'All four grades, side by side',
  'gr.c1.name':'Special','gr.c1.badge':'export favourite',
  'gr.c2.name':'A 级 <i style="font-style:italic;font-weight:400;">Grade A</i>',
  'gr.c3.name':'B 级 <i style="font-style:italic;font-weight:400;">Grade B</i>',
  'gr.c4.name':'C 级 <i style="font-style:italic;font-weight:400;">Grade C</i>',
  'gr.row.f':'flowers &amp; buds','gr.row.s':'spike',
  'gr.stem.a':'Stem intact, never pruned','gr.leaf.a':'Leaf without spots, cracks or cuts','gr.roots.a':'Roots healthy — no rot',
  'gr.c3.stem':'Stem clean; pruning allowed','gr.c3.leaf':'Minor leaf wounds allowed','gr.c3.roots':'1–2 roots degraded, rest healthy',
  'gr.c4.stem':'Stem spots or scars allowed','gr.c4.leaf':'Leaf spots or cracks allowed','gr.c4.roots':'Few active roots',
  'gr.note':'Grading runs top-down — a plant must meet <em>every</em> criterion of a grade to earn it. Nine flowers on a pruned spike is a B, not an A. Your invoice always states exactly what’s in the box.',
  'g.co2':'≈1,900 m elevation','g.co3':'17°C average','g.co4':'2,446 sun-hours/yr',
  'pano.lb':'ONE BENCH OF MANY — SONGMING, FEBRUARY',
  'p.eyebrow':'03 / Products','p.h2':'All your purchasing needs met.','p.note':'One nursery, the whole life-cycle — from flask-grown seedling to fresh-cut stem.',
  'p.c1.tag':'01 · Seedlings','p.c1.title':'Seedlings','p.c1.body':'Virus-free young plants, propagated from PCR- and ELISA-screened stock and grown to your finishing schedule.',
  'p.c2.tag':'02 · Pot flower','p.c2.title':'Pot Flower','p.c2.body':'Finished, blooming plants — hand-graded Special to C and ready to retail or gift straight from the box.',
  'p.c3.tag':'03 · Cut flower','p.c3.title':'Cut Flower','p.c3.body':'Fresh-cut spikes, sleeved in foam and packed cold for florists, events and wholesale arrangers.',
  'p.slb':'Available sizes','p.slb3':'Per stem',
  'p.sz.spiking':'3.5″ spiking','p.sz.flowering':'3.8″ flowering','p.sz.large':'Large flower','p.sz.small':'Small flower','p.sz.stems':'5–10 flowers / stem','p.sz.reefer':'Reefer cold-chain',
  'p.sz.spk28':'2.8″ spiking','p.sz.spk30':'3.0″ spiking','p.sz.flw28':'2.8″ flowering','p.sz.flw30':'3.0″ flowering','p.sz.flw35':'3.5″ flowering',
  'v.eyebrow':'The collection','v.h2':'Hundreds of varieties, ' + ACC.v + 'and counting.' + ACC.s,
  'v.lede':'Six core colours are only the beginning. Across pot and cut flower we keep hundreds of varieties in production at once — snow whites and blush pinks, wine-reds and golds, speckled picotees and one-of-a-kind marbled novelties — with new crosses spiking every season. Every bloom below has flowered on our own benches.',
  'v.b1.n':'Snow','v.b1.z':'WHITE','v.b2.n':'Ivory','v.b2.z':'CREAM','v.b3.n':'Buttercream','v.b3.z':'SOFT YELLOW','v.b4.n':'Blush','v.b4.z':'PALE PINK',
  'v.b5.n':'Pink','v.b5.z':'PINK','v.b6.n':'Peach','v.b6.z':'CORAL-PINK','v.b7.n':'Coral','v.b7.z':'CORAL','v.b8.n':'Rose Bicolor','v.b8.z':'TWO-TONE',
  'v.b9.n':'Bicolor','v.b9.z':'TWO-TONE','v.b10.n':'Fuchsia','v.b10.z':'MAGENTA','v.b11.n':'Magenta','v.b11.z':'VIVID','v.b12.n':'Orchid Purple','v.b12.z':'PURPLE-RED',
  'v.b13.n':'Lavender','v.b13.z':'LILAC','v.b14.n':'Amethyst','v.b14.z':'DEEP LILAC','v.b15.n':'Velvet Burgundy','v.b15.z':'WINE-RED','v.b16.n':'Gold','v.b16.z':'YELLOW',
  'v.b17.n':'Starlight','v.b17.z':'SPECKLED','v.b18.n':'Picotee','v.b18.z':'EDGED',
  'v.f1':'6 core colours','v.f2':'dozens of patterns','v.f3':'200+ varieties in production','v.f4':'new crosses each season','v.link':'Tell us the colour, we’ll match it →',
  'a.eyebrow':'Signature series · 星空','a.h2':'The Constellation',
  'a.lede':'A whole night sky scattered across living petals — marbled greens, ambers and violets that never fall the same way twice. The ‘星空 · Constellation’ series was developed ' + ACC.b + 'completely in-house' + ACC.bs + ' at our Songming greenhouses and is ' + ACC.b + 'patent-pending' + ACC.bs + ' — every plant a numbered one-of-one you can order here, and nowhere else.',
  'a.t1':'星空 · CONSTELLATION','a.t2':'PATENT PENDING','a.t3':'BRED IN-HOUSE','a.t4':'ONE OF ONE','a.plants':'The plants',
  'a.c1.n':'Citrus Marble','a.c1.t':'Potted · 星空','a.c1.b':'Orange and green poured across white — the newest plant off the Constellation bench, grown and finished in-house.',
  'a.c2.n':'Saffron &amp; Sky','a.c2.t':'Contemporary Zen','a.c2.b':'Warm amber marbled through soft blue — a calm, sunlit statement.',
  'a.c3.n':'Porcelain Indigo','a.c3.t':'Modern Botanical','a.c3.b':'Cobalt swirls on bright white, like brushed ink on porcelain.',
  'a.c4.n':'Rose Jade','a.c4.t':'Artisan Botanical','a.c4.b':'Blush pink and jade green folded together, no two petals alike.',
  'a.c5.n':'Chartreuse Mist','a.c5.t':'Botanical Minimalist','a.c5.b':'Pale lime drifting over cream — quiet, contemporary, refined.',
  'a.c6.n':'Peach Sorbet','a.c6.t':'Pastel Minimalism','a.c6.b':'Soft peach and butter-yellow bleeding into blush pink — a warm, gentle marble finished in-house.',
  'a.c7.n':'Aurora','a.c7.t':'Ethereal Botanical','a.c7.b':'Iridescent ribbons of mint, lilac and coral shifting across every petal — no two lit the same way.',
  'a.g.t':'Your palette,<br>your pattern','a.g.link':'Commission a series →','a.drag':'◄ drag to browse ►',
  'sh.eyebrow':'04 / How it ships','sh.h2':'Packed by hand, ' + ACC.sh + 'shipped cold.' + ACC.s,
  'sh.para':'Every spike is sleeved in foam, every bloom bedded in batting, every carton loaded into a reefer at the door. From our bench to yours — Beijing or Bangkok — the cold chain never breaks.',
  'sh.hd':'Shipping spec','sh.r1.n':'3.8″ Flowering','sh.r2.n':'Large Flower','sh.r3.n':'Small Flower','sh.r4.n':'Seedlings',
  'sh.r1.c':'cup 3.8″ · 9.7 cm','sh.r2.c':'cup 4.7″ · 12 cm','sh.r3.c':'cup 3.5″ · 9 cm','sh.r4.c':'packed by cup size',
  'sh.ppc':'plants / carton',
  'sh.r1.d1':'master 120×52×49 cm · 0.306 m³','sh.r1.d2':'2 inner trays × 20 · 118×49.5×22 cm · 0.129 m³',
  'sh.r2.d1':'master 110×45×60 cm · 0.297 m³','sh.r2.d2':'3 inner trays × 20 · 108×43×18 cm · 0.084 m³',
  'sh.r3.d1':'master 83×43×61 cm · 0.218 m³','sh.r3.d2':'3 inner trays × 24 · 81×41×19 cm · 0.063 m³',
  'sh.r4.c1':'1.7″ / 2.0″ cup — 280','sh.r4.c2':'2.5″ / 2.8″ cup — 120','sh.r4.c3':'3.5″ cup — 42','sh.r4.c4':'3.5″ spiking — 32','sh.r4.d1':'uniform carton 61×49×30 cm · 0.090 m³',
  'sh.fine':'Dimensions are empty-carton outer sizes (cm); packed cartons bulge ≈1–2 cm per side. Volumes are freight-estimate values.',
  'sh.ch1':'All major Chinese cities','sh.ch2':'10+ countries','sh.ch3':'Longer shelf-life vs market',
  'c.kick':'Wholesale · Export · Commissions','c.h2':'Let’s grow something<br>' + ACC.c + 'beautiful' + ACC.s + ' together.',
  'c.sub':'Request the current wholesale catalog — varieties, grades, carton counts and lead times for your market.',
  'c.ph':'Your work email','c.addr':'Xiaojie, Songming County, Kunming','c.langs':'EN · 中文 · РУ · VI',
  'f.about':'Kunming Tong Yi Biotechnology Co., Ltd. Premium Phalaenopsis, grown in Yunnan since 2000.',
  'f.secs':'Sections','f.lang':'Language',
  'f.c1':'© 2000–2026 Kunming Tong Yi Biotechnology','f.c2':'China’s Nº 1 flowering-Phalaenopsis exporter',
  '_rail':['Our story','How we grow','Products','Art Orchid','How it ships'],
  '_veilOn':'Reveal full photo','_veilOff':'Restore cut-out',
  '_geo':{myanmar:'MYANMAR',laos:'LAOS',vietnam:'VIETNAM',sichuan:'SICHUAN',guizhou:'GUIZHOU',guangxi:'GUANGXI',yunnanBig:'云南',yunnanSub:'YUNNAN'}
},
/* ------------------------------------------------------------ 中文 */
zh: {
  'nav.s1':'01 关于我们','nav.s2':'02 种植','nav.s3':'03 产品','nav.s4':'04 发货','nav.cta':'索取产品目录',
  'm.story':'关于我们','m.grow':'如何种植','m.products':'产品系列','m.ship':'如何发货','m.cta':'索取产品目录 →',
  'hero.kicker':'昆明统一生物 · 创立于 2000 年',
  'hero.h1':'色彩万千的蝴蝶兰 — ' + ACC.h1 + '还有你想象不到的那几种。' + ACC.s,
  'hero.lede':'中国最大的开花蝴蝶兰出口商。从组培瓶到盛放，全程在云南高原完成 — 这里也是独一无二的手工大理石纹「艺术兰」的故乡。',
  'hero.cta1':'阅读我们的故事','hero.cta2':'查看产品',
  'hero.s1':'中国开花蝴蝶兰出口商','hero.s2':'全国出口份额占比','hero.s3':'产品线 · 从种苗到切花','hero.s4':'年起扎根云南',
  'hero.mkts':'出口市场',
  'mkt.kr':'韩国','mkt.vn':'越南','mkt.ph':'菲律宾','mkt.th':'泰国','mkt.sg':'新加坡','mkt.bn':'文莱','mkt.db':'迪拜','mkt.om':'阿曼','mkt.hk':'香港',
  'ticker':'种苗'+SEP+'盆花'+SEP+'切花'+SEP+'无病毒组培'+SEP+'欧标温室'+SEP+'艺术兰'+SEP+'韩国 · 越南 · 菲律宾 · 泰国 · 新加坡 · 迪拜 · 阿曼 · 文莱 · 香港'+SEP,
  't.eyebrow':'云南 · 北纬25°高原 · 云贵高原','t.h2':ACC.t + '云栖之地' + ACC.s + '，兰生其间','t.zhsub':'四季如春，云雾滋养',
  't.para':'季风气流在此爬升入山 — 凉爽而明亮的高原上，云雾终年滋养林冠。昆明天然的昼夜温差与高原更强的紫外线，造就了开花兰花最理想的自然环境 — ' + ACC.i + '蝴蝶兰' + ACC.is + '以更挺的花梗、更艳的花色作答，而温控能耗仅为低地温室的一小部分。',
  't.st1':'海拔','t.st2':'年均温','t.st3':'昼夜温差','t.st4':'年日照','t.st5':'无霜期',
  't.adv1.t':'显著的昼夜温差','t.adv1.b':'白昼积累糖分，高原冷夜将其锁住 —— 花梗更挺、花色更浓且更持久的天然开关。',
  't.adv2.t':'更强的高原紫外线','t.adv2.b':'稀薄的高原空气透入更多紫外线，加深花瓣色素，也让植株更健壮 —— 花色更浓、更耐运输。',
  't.lg1':'云南','t.lg2':'毗邻地区','t.lg3':'种植基地',
  'map.kunming.name':'昆明 · 嵩明总部','map.kunming.sub':'3 个种植基地 · 从组培到开花',
  'map.wenshan.name':'文山基地','map.wenshan.sub':'种苗基地',
  'map.hq':'总部','map.base':'基地',
  'st.eyebrow':'01 / 关于我们',
  'st.h2':'一家台商创办的兰花企业，扎根云南高原，从组培瓶到开花成株全程自育自养 — ' + ACC.st + '一站式完成。' + ACC.s,
  'st.p1':'自 2000 年起，昆明统一生物科技专注于蝴蝶兰育种、优良品种繁育、种苗与规模化开花植株生产 — 基地位于云南嵩明小街花卉园区。',
  'st.p2':'自 2020 年起，海关数据显示我们是中国最大的开花蝴蝶兰出口商，占全国出口份额一半以上 — 每一株植物背后都有发明专利与植物新品种权作支撑。',
  'st.b1':'中国开花蝴蝶兰<br>出口商','st.b2':'全国出口份额<br>（2020 年至今）','st.b3':'年育种与<br>栽培经验','st.b4':'出口市场遍及<br>亚洲与海湾',
  'st.f0':'图 01 — 昆明统一大家庭，新春合影于嵩明总部','st.f1':'图 02 — 自动化温室，嵩明','st.f2':'图 03 — 刚下苗床的混色品种','st.f3':'图 04 — 冷链装柜，昆明总部',
  'g.eyebrow':'02 / 如何种植','g.h2':'十八个月，' + ACC.st + '四季呵护。' + ACC.s,
  'g.note':'一株蝴蝶兰的完整旅程就铺陈在下面 — 顺着茎，从组培瓶读到开花。',
  'g.s1.chip':'第 0–5 月','g.s1.word':'一','g.s1.title':'组培与种苗','g.s1.body':'只有健康无病毒的植株才能进入繁育 — 每一株母本都经 PCR 与 ELISA 检测后，才会灌注第一瓶组培苗。','g.s1.fact':'实验室认证无病毒种源','g.s1.note':'— 播种于玻璃瓶中的无菌空气里：一瓶就是一座温室。',
  'g.s2.chip':'第 5–11 月','g.s2.word':'二','g.s2.title':'营养生长','g.s2.body':'种苗每个生长阶段至少经历四至六个月的气候调控，光照、湿度与灌溉全天候由传感数据调节。','g.s2.fact':'每阶段 4–6 个月 · 自动化管理','g.s2.note':'— 白日温暖、清晨喷雾，叶片一季季厚实起来。',
  'g.s3.chip':'第 11–16 月','g.s3.word':'三','g.s3.title':'抽梗与低温','g.s3.body':'五至六个月的低温处理催发粗壮而整齐的花梗 — 云南漫长的高原之秋，天然完成了别处需要人工强制的事。','g.s3.fact':'5–6 个月低温处理','g.s3.note':'— 高原之秋就是我们的冷室，而且大门敞开。',
  'g.s4.chip':'第 16–18 月','g.s4.word':'四','g.s4.title':'开花与分级','g.s4.body':'植株在苗床上开花，随后逐株手工分级 — 花朵数、花梗长度、茎、叶与根系健康 — 之后才装箱。','g.s4.fact':'五项标准逐株分级','g.s4.note':'— 每一株都经五道手工检查，才配得上它的箱子。',
  'gr.eyebrow':'出口品质标准 · 蝴蝶兰分级标准','gr.h3':'像宝石一样分级。','gr.side':'四个等级一览',
  'gr.c1.name':'特级 <i style="font-style:italic;font-weight:400;">Special</i>','gr.c1.badge':'出口首选',
  'gr.c2.name':'A 级','gr.c3.name':'B 级','gr.c4.name':'C 级',
  'gr.row.f':'花朵与花苞','gr.row.s':'花梗',
  'gr.stem.a':'花梗完整，从未修剪','gr.leaf.a':'叶片无斑点、裂纹或伤口','gr.roots.a':'根系健康 — 无腐烂',
  'gr.c3.stem':'花梗干净；允许修剪','gr.c3.leaf':'允许轻微叶伤','gr.c3.roots':'1–2 条根退化，其余健康',
  'gr.c4.stem':'花梗允许斑点或疤痕','gr.c4.leaf':'叶片允许斑点或裂纹','gr.c4.roots':'活根较少',
  'gr.note':'分级自上而下 — 植株须满足该等级的<em>每一项</em>标准才能获评。修剪过花梗的九朵花是 B 级，不是 A 级。发票上写的，永远与箱子里的一致。',
  'g.co2':'海拔约 1,900 米','g.co3':'年均 17°C','g.co4':'年日照 2,446 小时',
  'pano.lb':'万千苗床之一 — 嵩明，二月',
  'p.eyebrow':'03 / 产品系列','p.h2':'满足您的一切采购需求。','p.note':'一座苗圃，覆盖全生命周期 — 从组培种苗到新鲜切花。',
  'p.c1.tag':'01 · 种苗','p.c1.title':'种苗','p.c1.body':'无病毒幼苗，源自经 PCR 与 ELISA 检测的种源，可按您的成品排期培育。',
  'p.c2.tag':'02 · 盆花','p.c2.title':'盆花','p.c2.body':'成品开花植株 — 手工分级（特级至 C 级），开箱即可零售或馈赠。',
  'p.c3.tag':'03 · 切花','p.c3.title':'切花','p.c3.body':'新鲜剪切的花梗，泡棉套袋、全程冷链，适合花店、活动与批发插花。',
  'p.slb':'可选规格','p.slb3':'单枝规格',
  'p.sz.spiking':'3.5″ 抽梗苗','p.sz.flowering':'3.8″ 开花株','p.sz.large':'大花','p.sz.small':'小花','p.sz.stems':'每枝 5–10 朵','p.sz.reefer':'冷链运输',
  'p.sz.spk28':'2.8″ 抽梗苗','p.sz.spk30':'3.0″ 抽梗苗','p.sz.flw28':'2.8″ 开花株','p.sz.flw30':'3.0″ 开花株','p.sz.flw35':'3.5″ 开花株',
  'v.eyebrow':'花色图鉴','v.h2':'数百个品种，' + ACC.v + '仍在增加。' + ACC.s,
  'v.lede':'六大主色只是起点。在盆花与切花两条线中，我们同时保有数百个品种在产 — 雪白与绯粉、酒红与金黄、星点镶边与独一无二的大理石纹新贵 — 每季都有新杂交上梗。下方每一朵，都在我们自己的苗床上开过花。',
  'v.b1.n':'雪白','v.b1.z':'白','v.b2.n':'象牙','v.b2.z':'米白','v.b3.n':'奶油黄','v.b3.z':'浅黄','v.b4.n':'绯粉','v.b4.z':'浅粉',
  'v.b5.n':'粉红','v.b5.z':'粉','v.b6.n':'蜜桃','v.b6.z':'珊瑚粉','v.b7.n':'珊瑚','v.b7.z':'珊瑚','v.b8.n':'双色玫瑰','v.b8.z':'双色粉',
  'v.b9.n':'双色','v.b9.z':'双色','v.b10.n':'桃红','v.b10.z':'洋红','v.b11.n':'洋红','v.b11.z':'艳色','v.b12.n':'紫红','v.b12.z':'紫红',
  'v.b13.n':'淡紫','v.b13.z':'丁香紫','v.b14.n':'紫晶','v.b14.z':'深紫','v.b15.n':'酒红丝绒','v.b15.z':'酒红','v.b16.n':'金黄','v.b16.z':'黄',
  'v.b17.n':'星点','v.b17.z':'斑点','v.b18.n':'镶边','v.b18.z':'描边',
  'v.f1':'6 大主色','v.f2':'数十种花纹','v.f3':'200+ 品种在产','v.f4':'每季新杂交','v.link':'告诉我们颜色，我们来匹配 →',
  'a.eyebrow':'招牌系列 · 星空','a.h2':'星空系列',
  'a.lede':'整片夜空散落在鲜活的花瓣上 — 大理石纹的绿、琥珀与紫罗兰，每一次晕染都不重样。「星空」系列由我们嵩明温室' + ACC.b + '全自主研发' + ACC.bs + '，' + ACC.b + '专利申请中' + ACC.bs + ' — 每株编号、独一无二，只在这里可以订购。',
  'a.t1':'星空 · CONSTELLATION','a.t2':'专利申请中','a.t3':'自主培育','a.t4':'独一无二','a.plants':'同系列植株',
  'a.c1.n':'柑香石纹','a.c1.t':'盆栽 · 星空','a.c1.b':'橙与绿泼洒在白瓣之上 — 星空苗床上最新的一株，全程自育自成。',
  'a.c2.n':'藏红花与天空','a.c2.t':'当代禅意','a.c2.b':'暖琥珀晕入柔蓝 — 一件安静而向阳的作品。',
  'a.c3.n':'青花靛蓝','a.c3.t':'现代植物风','a.c3.b':'钴蓝在纯白上流转，如瓷上走笔的墨。',
  'a.c4.n':'玫瑰翡翠','a.c4.t':'匠心植物风','a.c4.b':'绯粉与翠绿彼此交叠，没有两瓣是相同的。',
  'a.c5.n':'黄绿雾霭','a.c5.t':'极简植物风','a.c5.b':'浅青柠漫过奶油底色 — 安静、当代、克制。',
  'a.c6.n':'蜜桃冰沙','a.c6.t':'柔彩极简','a.c6.b':'柔和的蜜桃与奶油黄晕入粉色 — 温润的大理石纹，全程自有培育。',
  'a.c7.n':'极光','a.c7.t':'空灵植境','a.c7.b':'薄荷、丁香紫与珊瑚色的虹彩在花瓣间流转 — 每一朵的光泽都独一无二。',
  'a.g.t':'你的配色，<br>你的纹样','a.g.link':'定制一个系列 →','a.drag':'◄ 拖动浏览 ►',
  'sh.eyebrow':'04 / 如何发货','sh.h2':'手工包装，' + ACC.sh + '全程冷链。' + ACC.s,
  'sh.para':'每一枝花梗套上泡棉，每一朵花垫入衬棉，每一箱货物在门口装入冷藏柜。从我们的苗床到您的手中 — 无论北京还是曼谷 — 冷链从不间断。',
  'sh.hd':'发货规格','sh.r1.n':'3.8″ 开花株','sh.r2.n':'大花','sh.r3.n':'小花','sh.r4.n':'种苗',
  'sh.r1.c':'杯径 3.8″ · 9.7 cm','sh.r2.c':'杯径 4.7″ · 12 cm','sh.r3.c':'杯径 3.5″ · 9 cm','sh.r4.c':'按杯径装箱',
  'sh.ppc':'株 / 箱',
  'sh.r1.d1':'外箱 120×52×49 cm · 0.306 m³','sh.r1.d2':'2 层内托 × 20 · 118×49.5×22 cm · 0.129 m³',
  'sh.r2.d1':'外箱 110×45×60 cm · 0.297 m³','sh.r2.d2':'3 层内托 × 20 · 108×43×18 cm · 0.084 m³',
  'sh.r3.d1':'外箱 83×43×61 cm · 0.218 m³','sh.r3.d2':'3 层内托 × 24 · 81×41×19 cm · 0.063 m³',
  'sh.r4.c1':'1.7″ / 2.0″ 杯 — 280','sh.r4.c2':'2.5″ / 2.8″ 杯 — 120','sh.r4.c3':'3.5″ 杯 — 42','sh.r4.c4':'3.5″ 抽梗 — 32','sh.r4.d1':'统一纸箱 61×49×30 cm · 0.090 m³',
  'sh.fine':'尺寸为空箱外径（cm）；装箱后每边约外扩 1–2 cm。体积为运费估算值。',
  'sh.ch1':'覆盖全国主要城市','sh.ch2':'10+ 个国家','sh.ch3':'货架期长于市场平均',
  'c.kick':'批发 · 出口 · 定制','c.h2':'让我们一起，种出<br>' + ACC.c + '美好' + ACC.s + '。',
  'c.sub':'索取最新批发目录 — 品种、等级、装箱数与您所在市场的交期。',
  'c.ph':'您的工作邮箱','c.addr':'云南省昆明市嵩明县小街','c.langs':'EN · 中文 · РУ · VI',
  'f.about':'昆明统一生物科技有限公司。优质蝴蝶兰，自 2000 年扎根云南。',
  'f.secs':'栏目','f.lang':'语言',
  'f.c1':'© 2000–2026 昆明统一生物科技有限公司','f.c2':'中国第一开花蝴蝶兰出口商',
  '_rail':['关于我们','如何种植','产品系列','艺术兰','如何发货'],
  '_veilOn':'显示完整照片 · 全图','_veilOff':'恢复镂空 · 剪影',
  '_geo':{myanmar:'缅甸',laos:'老挝',vietnam:'越南',sichuan:'四川',guizhou:'贵州',guangxi:'广西',yunnanBig:'云南',yunnanSub:'YUNNAN'}
},
/* ------------------------------------------------------------ РУССКИЙ */
ru: {
  'nav.s1':'01 История','nav.s2':'02 Выращивание','nav.s3':'03 Продукция','nav.s4':'04 Доставка','nav.cta':'Запросить каталог',
  'm.story':'Наша история','m.grow':'Как мы выращиваем','m.products':'Продукция','m.ship':'Как мы отгружаем','m.cta':'Запросить каталог →',
  'hero.kicker':'Куньмин Тун И · осн. в 2000 г.',
  'hero.h1':'Орхидеи всех мыслимых цветов — ' + ACC.h1 + 'и нескольких немыслимых.' + ACC.s,
  'hero.lede':'Крупнейший в Китае экспортёр цветущих фаленопсисов. Выращены от колбы до цветения на высокогорье Юньнани — родине мраморной «Арт-орхидеи», которой нет больше нигде на свете.',
  'hero.cta1':'Наша история','hero.cta2':'Смотреть продукцию',
  'hero.s1':'экспортёр цветущих орхидей в Китае','hero.s2':'национального экспорта','hero.s3':'линейки · от сеянца до среза','hero.s4':'год — растим в Юньнани с',
  'hero.mkts':'Рынки экспорта',
  'mkt.kr':'Южная Корея','mkt.vn':'Вьетнам','mkt.ph':'Филиппины','mkt.th':'Таиланд','mkt.sg':'Сингапур','mkt.bn':'Бруней','mkt.db':'Дубай','mkt.om':'Оман','mkt.hk':'Гонконг',
  'ticker':'СЕЯНЦЫ'+SEP+'ГОРШЕЧНЫЕ'+SEP+'СРЕЗКА'+SEP+'БЕЗВИРУСНОЕ РАЗМНОЖЕНИЕ'+SEP+'ТЕПЛИЦЫ ЕВРОПЕЙСКОГО СТАНДАРТА'+SEP+'АРТ-ОРХИДЕЯ'+SEP+'КОРЕЯ · ВЬЕТНАМ · ФИЛИППИНЫ · ТАИЛАНД · СИНГАПУР · ДУБАЙ · ОМАН · БРУНЕЙ · ГОНКОНГ'+SEP,
  't.eyebrow':'Юньнань · плато 25° с.ш.','t.h2':'Выращены там, где отдыхают ' + ACC.t + 'облака' + ACC.s,'t.zhsub':'Где облака — там растут орхидеи',
  't.para':'Муссонный воздух поднимается здесь в горы — на прохладное светлое плато, где туман круглый год питает лес. Естественно широкие суточные перепады температур Куньмина и более сильный высокогорный ультрафиолет создают лучшую на земле природную среду для цветущих орхидей — ' + ACC.i + 'фаленопсис' + ACC.is + ' отвечает крепкими цветоносами и глубоким цветом при доле энергии равнинной теплицы.',
  't.st1':'Высота','t.st2':'Средняя t°','t.st3':'Суточный перепад','t.st4':'Солнце в год','t.st5':'Вегетационный период',
  't.adv1.t':'Большой перепад день–ночь','t.adv1.b':'Тёплый день копит сахара, холодная горная ночь их закрепляет — залог крепких цветоносов и глубокого, стойкого цвета.',
  't.adv2.t':'Сильное высокогорное солнце','t.adv2.b':'Разрежённый воздух пропускает больше ультрафиолета — насыщеннее пигмент лепестков и крепче растение.',
  't.lg1':'Юньнань','t.lg2':'Соседние регионы','t.lg3':'Плантации',
  'map.kunming.name':'Куньмин · база Сунмин','map.kunming.sub':'3 плантации · от колбы до цветения',
  'map.wenshan.name':'База Вэньшань','map.wenshan.sub':'Питомник сеянцев',
  'map.hq':'Штаб','map.base':'База',
  'st.eyebrow':'01 / Наша история',
  'st.h2':'Основанный тайваньцами орхидейный дом на высокогорье Юньнани: селекция и выращивание фаленопсиса от колбы до цветущего растения — ' + ACC.st + 'всё в одном месте.' + ACC.s,
  'st.p1':'С 2000 года Kunming Tong Yi Biotechnology специализируется на селекции фаленопсисов, размножении лучших сортов, сеянцах и промышленном производстве цветущих растений — на базах цветочного парка Сяоцзе в уезде Сунмин, Юньнань.',
  'st.p2':'С 2020 года, по таможенным данным, мы — крупнейший экспортёр цветущих фаленопсисов Китая с более чем половиной национального экспорта. За каждым растением — портфель патентов и прав на новые сорта.',
  'st.b1':'экспортёр цветущих<br>фаленопсисов в Китае','st.b2':'национального экспорта<br>с 2020 года','st.b3':'лет селекции<br>и выращивания','st.b4':'рынков в Азии<br>и Заливе',
  'st.f0':'ФОТО 01 — Команда Kunming Tong Yi, Праздник весны у штаб-квартиры в Сунмине','st.f1':'ФОТО 02 — Автоматизированная теплица, Сунмин','st.f2':'ФОТО 03 — Смесь сортов, только со стеллажа','st.f3':'ФОТО 04 — Погрузка рефконтейнера, Куньмин',
  'g.eyebrow':'02 / Как мы выращиваем','g.h2':'Восемнадцать месяцев, ' + ACC.st + 'четыре сезона заботы.' + ACC.s,
  'g.note':'Весь путь одного растения — ниже. Следуйте по стеблю: от колбы до цветения.',
  'g.s1.chip':'Месяцы 0–5','g.s1.word':'один','g.s1.title':'Колба и сеянец','g.s1.body':'В размножение идут только здоровые безвирусные растения — каждое маточное проверяется методами ПЦР и ИФА, прежде чем будет налита первая колба.','g.s1.fact':'Безвирусный материал с лабораторным сертификатом','g.s1.note':'— посеяно в стекле, в стерильном воздухе: целая теплица в бутылке.',
  'g.s2.chip':'Месяцы 5–11','g.s2.word':'два','g.s2.title':'Вегетативный рост','g.s2.body':'Каждый этап роста — не менее четырёх–шести месяцев климат-контроля: свет, влажность и полив круглосуточно настраиваются по данным датчиков.','g.s2.fact':'4–6 месяцев на этап, автоматика','g.s2.note':'— тёплые дни и туманные рассветы; листья плотнеют сезон за сезоном.',
  'g.s3.chip':'Месяцы 11–16','g.s3.word':'три','g.s3.title':'Цветонос и холод','g.s3.body':'Пяти–шестимесячная холодовая обработка даёт сильные ровные цветоносы — долгая юньнаньская осень делает сама то, к чему другие принуждают.','g.s3.fact':'5–6 месяцев холодовой обработки','g.s3.note':'— горная осень и есть наша холодильная камера, только с открытыми дверями.',
  'g.s4.chip':'Месяцы 16–18','g.s4.word':'четыре','g.s4.title':'Цветение и сортировка','g.s4.body':'Растения зацветают на стеллаже и сортируются вручную — число цветков, длина цветоноса, стебель, лист и корни — и только потом упаковываются.','g.s4.fact':'Оценка по пяти критериям','g.s4.note':'— пять ручных проверок, прежде чем растение заслужит свою коробку.',
  'gr.eyebrow':'Экспортный стандарт качества','gr.h3':'Сортируем, как драгоценные камни.','gr.side':'Все четыре класса рядом',
  'gr.c1.name':'Высший','gr.c1.badge':'выбор экспорта',
  'gr.c2.name':'Класс A','gr.c3.name':'Класс B','gr.c4.name':'Класс C',
  'gr.row.f':'цветков и бутонов','gr.row.s':'цветонос',
  'gr.stem.a':'Цветонос цел, не обрезался','gr.leaf.a':'Лист без пятен, трещин и порезов','gr.roots.a':'Корни здоровы — без гнили',
  'gr.c3.stem':'Цветонос чистый; обрезка допустима','gr.c3.leaf':'Допустимы лёгкие повреждения листа','gr.c3.roots':'1–2 корня ослаблены, остальные здоровы',
  'gr.c4.stem':'Допустимы пятна и рубцы на цветоносе','gr.c4.leaf':'Допустимы пятна и трещины листа','gr.c4.roots':'Мало активных корней',
  'gr.note':'Сортировка идёт сверху вниз — растение должно отвечать <em>каждому</em> критерию класса. Девять цветков на обрезанном цветоносе — это B, а не A. В инвойсе всегда ровно то, что в коробке.',
  'g.co2':'≈1 900 м над уровнем моря','g.co3':'в среднем 17°C','g.co4':'2 446 солнечных часов/год',
  'pano.lb':'ОДИН СТЕЛЛАЖ ИЗ МНОГИХ — СУНМИН, ФЕВРАЛЬ',
  'p.eyebrow':'03 / Продукция','p.h2':'Закрываем все ваши потребности в закупках.','p.note':'Один питомник — весь жизненный цикл: от сеянца из колбы до свежего среза.',
  'p.c1.tag':'01 · Сеянцы','p.c1.title':'Сеянцы','p.c1.body':'Безвирусные молодые растения из проверенного ПЦР и ИФА материала, доращиваемые под ваш график.',
  'p.c2.tag':'02 · Горшечные','p.c2.title':'Горшечные','p.c2.body':'Готовые цветущие растения — ручная сортировка от высшего класса до C, из коробки сразу в продажу или в подарок.',
  'p.c3.tag':'03 · Срезка','p.c3.title':'Срезка','p.c3.body':'Свежесрезанные цветоносы в поролоновых чехлах, упакованные в холоде — для флористов, событий и оптовиков.',
  'p.slb':'Доступные размеры','p.slb3':'На стебель',
  'p.sz.spiking':'3.5″ с цветоносом','p.sz.flowering':'3.8″ цветущие','p.sz.large':'Крупный цветок','p.sz.small':'Мелкий цветок','p.sz.stems':'5–10 цветков / стебель','p.sz.reefer':'Рефрижераторная цепь',
  'p.sz.spk28':'2.8″ с цветоносом','p.sz.spk30':'3.0″ с цветоносом','p.sz.flw28':'2.8″ цветущие','p.sz.flw30':'3.0″ цветущие','p.sz.flw35':'3.5″ цветущие',
  'v.eyebrow':'Коллекция','v.h2':'Сотни сортов — ' + ACC.v + 'и это не предел.' + ACC.s,
  'v.lede':'Шесть базовых цветов — только начало. В горшечной и срезочной линиях у нас одновременно сотни сортов в производстве: снежно-белые и румяно-розовые, винно-красные и золотые, крапчатые пикоти и единственные в своём роде мраморные новинки — и каждый сезон зацветают новые гибриды. Каждый цветок ниже распустился на наших собственных стеллажах.',
  'v.b1.n':'Снег','v.b1.z':'БЕЛЫЙ','v.b2.n':'Слоновая кость','v.b2.z':'КРЕМОВЫЙ','v.b3.n':'Сливочный','v.b3.z':'СВЕТЛО-ЖЁЛТЫЙ','v.b4.n':'Румянец','v.b4.z':'БЛЕДНО-РОЗОВЫЙ',
  'v.b5.n':'Розовый','v.b5.z':'РОЗОВЫЙ','v.b6.n':'Персик','v.b6.z':'КОРАЛЛОВО-РОЗОВЫЙ','v.b7.n':'Коралл','v.b7.z':'КОРАЛЛОВЫЙ','v.b8.n':'Роза биколор','v.b8.z':'ДВУХТОННЫЙ',
  'v.b9.n':'Биколор','v.b9.z':'ДВУХТОННЫЙ','v.b10.n':'Фуксия','v.b10.z':'МАДЖЕНТА','v.b11.n':'Маджента','v.b11.z':'ЯРКИЙ','v.b12.n':'Пурпур','v.b12.z':'ПУРПУРНО-КРАСНЫЙ',
  'v.b13.n':'Лаванда','v.b13.z':'СИРЕНЕВЫЙ','v.b14.n':'Аметист','v.b14.z':'ТЁМНО-СИРЕНЕВЫЙ','v.b15.n':'Бархатный бордо','v.b15.z':'ВИННО-КРАСНЫЙ','v.b16.n':'Золото','v.b16.z':'ЖЁЛТЫЙ',
  'v.b17.n':'Звёздный','v.b17.z':'КРАПЧАТЫЙ','v.b18.n':'Пикоти','v.b18.z':'С КАЙМОЙ',
  'v.f1':'6 базовых цветов','v.f2':'десятки узоров','v.f3':'200+ сортов в производстве','v.f4':'новые гибриды каждый сезон','v.link':'Назовите цвет — мы подберём →',
  'a.eyebrow':'Фирменная серия · 星空','a.h2':'Созвездие',
  'a.lede':'Целое ночное небо, рассыпанное по живым лепесткам — мраморные зелёные, янтарные и фиолетовые разводы, которые никогда не ложатся одинаково. Серия «星空 · Созвездие» выведена ' + ACC.b + 'полностью у нас' + ACC.bs + ' в теплицах Сунмина, ' + ACC.b + 'патент оформляется' + ACC.bs + ' — каждое растение пронумеровано и уникально; заказать его можно только здесь.',
  'a.t1':'星空 · СОЗВЕЗДИЕ','a.t2':'ПАТЕНТ ОФОРМЛЯЕТСЯ','a.t3':'СОБСТВЕННАЯ СЕЛЕКЦИЯ','a.t4':'ЕДИНСТВЕННЫЙ ЭКЗЕМПЛЯР','a.plants':'Растения серии',
  'a.c1.n':'Цитрусовый мрамор','a.c1.t':'Горшечная · 星空','a.c1.b':'Оранжевый и зелёный, разлитые по белому — новейшее растение со стеллажей «Созвездия», выращено и завершено у нас.',
  'a.c2.n':'Шафран и небо','a.c2.t':'Современный дзен','a.c2.b':'Тёплый янтарь, вплетённый в мягкую синеву — спокойное, солнечное высказывание.',
  'a.c3.n':'Фарфоровый индиго','a.c3.t':'Современная ботаника','a.c3.b':'Кобальтовые разводы по яркому белому — как тушь по фарфору.',
  'a.c4.n':'Розовый нефрит','a.c4.t':'Артизанская ботаника','a.c4.b':'Румяный розовый и нефритовая зелень сложены вместе — нет двух одинаковых лепестков.',
  'a.c5.n':'Шартрёзная дымка','a.c5.t':'Ботанический минимализм','a.c5.b':'Бледный лайм, плывущий по сливочному — тихо, современно, тонко.',
  'a.c6.n':'Персиковый сорбет','a.c6.t':'Пастельный минимализм','a.c6.b':'Мягкий персик и сливочно-жёлтый, перетекающие в румяный розовый — тёплый мрамор, выведенный у нас.',
  'a.c7.n':'Аврора','a.c7.t':'Эфирная ботаника','a.c7.b':'Переливы мяты, сирени и коралла скользят по каждому лепестку — двух одинаковых не найти.',
  'a.g.t':'Ваша палитра,<br>ваш узор','a.g.link':'Заказать серию →','a.drag':'◄ листайте перетаскиванием ►',
  'sh.eyebrow':'04 / Как мы отгружаем','sh.h2':'Упаковано вручную, ' + ACC.sh + 'отгружено в холоде.' + ACC.s,
  'sh.para':'Каждый цветонос — в поролоновом чехле, каждый цветок — в ватной подложке, каждая коробка грузится в рефконтейнер прямо у дверей. От нашего стеллажа до вашего — Пекин это или Бангкок — холодовая цепь не прерывается.',
  'sh.hd':'Спецификация отгрузки','sh.r1.n':'3.8″ цветущие','sh.r2.n':'Крупный цветок','sh.r3.n':'Мелкий цветок','sh.r4.n':'Сеянцы',
  'sh.r1.c':'горшок 3.8″ · 9,7 см','sh.r2.c':'горшок 4.7″ · 12 см','sh.r3.c':'горшок 3.5″ · 9 см','sh.r4.c':'упаковка по размеру горшка',
  'sh.ppc':'растений / коробка',
  'sh.r1.d1':'мастер-короб 120×52×49 см · 0,306 м³','sh.r1.d2':'2 лотка × 20 · 118×49,5×22 см · 0,129 м³',
  'sh.r2.d1':'мастер-короб 110×45×60 см · 0,297 м³','sh.r2.d2':'3 лотка × 20 · 108×43×18 см · 0,084 м³',
  'sh.r3.d1':'мастер-короб 83×43×61 см · 0,218 м³','sh.r3.d2':'3 лотка × 24 · 81×41×19 см · 0,063 м³',
  'sh.r4.c1':'горшок 1.7″ / 2.0″ — 280','sh.r4.c2':'горшок 2.5″ / 2.8″ — 120','sh.r4.c3':'горшок 3.5″ — 42','sh.r4.c4':'3.5″ с цветоносом — 32','sh.r4.d1':'единый короб 61×49×30 см · 0,090 м³',
  'sh.fine':'Размеры — внешние, по пустой коробке (см); упакованные коробки расширяются на ≈1–2 см с каждой стороны. Объёмы — оценка для фрахта.',
  'sh.ch1':'Все крупные города Китая','sh.ch2':'10+ стран','sh.ch3':'Дольше стоит, чем рыночный стандарт',
  'c.kick':'Опт · Экспорт · Заказные серии','c.h2':'Давайте вырастим<br>' + ACC.c + 'красоту' + ACC.s + ' вместе.',
  'c.sub':'Запросите актуальный оптовый каталог — сорта, классы, вместимость коробок и сроки поставки для вашего рынка.',
  'c.ph':'Ваш рабочий e-mail','c.addr':'Сяоцзе, уезд Сунмин, Куньмин','c.langs':'EN · 中文 · РУ · VI',
  'f.about':'Kunming Tong Yi Biotechnology Co., Ltd. Премиальные фаленопсисы, выращиваемые в Юньнани с 2000 года.',
  'f.secs':'Разделы','f.lang':'Язык',
  'f.c1':'© 2000–2026 Kunming Tong Yi Biotechnology','f.c2':'Экспортёр №1 цветущих фаленопсисов Китая',
  '_rail':['Наша история','Как мы выращиваем','Продукция','Арт-орхидея','Как мы отгружаем'],
  '_veilOn':'Показать всё фото','_veilOff':'Вернуть силуэт',
  '_geo':{myanmar:'МЬЯНМА',laos:'ЛАОС',vietnam:'ВЬЕТНАМ',sichuan:'СЫЧУАНЬ',guizhou:'ГУЙЧЖОУ',guangxi:'ГУАНСИ',yunnanBig:'云南',yunnanSub:'ЮНЬНАНЬ'}
},
/* ------------------------------------------------------------ TIẾNG VIỆT */
vi: {
  'nav.s1':'01 Câu chuyện','nav.s2':'02 Canh tác','nav.s3':'03 Sản phẩm','nav.s4':'04 Vận chuyển','nav.cta':'Nhận catalogue',
  'm.story':'Câu chuyện của chúng tôi','m.grow':'Cách chúng tôi trồng','m.products':'Sản phẩm','m.ship':'Cách giao hàng','m.cta':'Nhận catalogue →',
  'hero.kicker':'Kunming Tong Yi · thành lập 2000',
  'hero.h1':'Hồ điệp đủ mọi sắc màu bạn hình dung được — ' + ACC.h1 + 'và vài sắc bạn chưa từng.' + ACC.s,
  'hero.lede':'Nhà xuất khẩu hồ điệp đang nở lớn nhất Trung Quốc, trồng từ chai mô đến hoa nở trên cao nguyên Vân Nam — quê hương của Art Orchid vân cẩm thạch thủ công, không nơi nào khác có.',
  'hero.cta1':'Đọc câu chuyện','hero.cta2':'Xem sản phẩm',
  'hero.s1':'xuất khẩu hồ điệp nở hoa, Trung Quốc','hero.s2':'thị phần xuất khẩu cả nước','hero.s3':'dòng sản phẩm · cây giống→cắt cành','hero.s4':'năm bén rễ Vân Nam từ',
  'hero.mkts':'Thị trường xuất khẩu',
  'mkt.kr':'Hàn Quốc','mkt.vn':'Việt Nam','mkt.ph':'Philippines','mkt.th':'Thái Lan','mkt.sg':'Singapore','mkt.bn':'Brunei','mkt.db':'Dubai','mkt.om':'Oman','mkt.hk':'Hồng Kông',
  'ticker':'CÂY GIỐNG'+SEP+'HOA CHẬU'+SEP+'HOA CẮT CÀNH'+SEP+'NHÂN GIỐNG SẠCH VIRUS'+SEP+'NHÀ KÍNH CHUẨN CHÂU ÂU'+SEP+'ART ORCHID'+SEP+'HÀN QUỐC · VIỆT NAM · PHILIPPINES · THÁI LAN · SINGAPORE · DUBAI · OMAN · BRUNEI · HỒNG KÔNG'+SEP,
  't.eyebrow':'Vân Nam · cao nguyên 25°B','t.h2':'Trồng nơi ' + ACC.t + 'mây ngủ' + ACC.s + ' lại','t.zhsub':'Nơi mây dừng chân, lan đơm hoa',
  't.para':'Gió mùa leo núi đổ về đây — một cao nguyên mát và ngập sáng, nơi sương nuôi tán rừng quanh năm. Biên độ nhiệt ngày–đêm tự nhiên của Côn Minh cùng tia cực tím mạnh hơn của cao nguyên tạo nên môi trường tự nhiên tốt nhất cho lan nở hoa — ' + ACC.i + 'hồ điệp' + ACC.is + ' đáp lại bằng vòi hoa cứng cáp, sắc hoa đậm đà, với chỉ một phần năng lượng nhà kính đồng bằng phải đốt.',
  't.st1':'Độ cao','t.st2':'Nhiệt độ TB','t.st3':'Biên độ ngày–đêm','t.st4':'Nắng mỗi năm','t.st5':'Mùa sinh trưởng',
  't.adv1.t':'Chênh lệch ngày–đêm lớn','t.adv1.b':'Ngày ấm tích đường, đêm núi lạnh giữ lại — chìa khóa tự nhiên cho cần hoa cứng cáp và màu đậm, bền hơn.',
  't.adv2.t':'Nắng cao nguyên mạnh hơn','t.adv2.b':'Không khí loãng cho nhiều tia cực tím hơn, làm đậm sắc tố cánh hoa và cây cứng cáp hơn.',
  't.lg1':'Vân Nam','t.lg2':'Vùng giáp ranh','t.lg3':'Cơ sở canh tác',
  'map.kunming.name':'Côn Minh · Tùng Minh (HQ)','map.kunming.sub':'3 cơ sở · từ chai mô đến hoa nở',
  'map.wenshan.name':'Cơ sở Văn Sơn','map.wenshan.sub':'Vườn ươm cây giống',
  'map.hq':'Trụ sở','map.base':'Cơ sở',
  'st.eyebrow':'01 / Câu chuyện của chúng tôi',
  'st.h2':'Một nhà lan do người Đài Loan sáng lập trên cao nguyên Vân Nam, lai tạo và nuôi hồ điệp từ chai cấy mô đến cây nở hoa — ' + ACC.st + 'trọn vẹn tại một nơi.' + ACC.s,
  'st.p1':'Từ năm 2000, Kunming Tong Yi Biotechnology chuyên lai tạo hồ điệp, nhân giống ưu tú, cây giống và sản xuất cây nở hoa quy mô công nghiệp — tại khu hoa viên Tiểu Nhai, huyện Tùng Minh, Vân Nam.',
  'st.p2':'Từ năm 2020, dữ liệu hải quan xếp chúng tôi là nhà xuất khẩu hồ điệp nở hoa lớn nhất Trung Quốc, giữ hơn một nửa thị phần cả nước — với danh mục bằng sáng chế và quyền giống cây trồng mới sau mỗi cây.',
  'st.b1':'xuất khẩu hồ điệp<br>nở hoa tại Trung Quốc','st.b2':'thị phần xuất khẩu<br>từ 2020','st.b3':'năm lai tạo<br>và canh tác','st.b4':'thị trường khắp<br>châu Á &amp; vùng Vịnh',
  'st.f0':'HÌNH 01 — Đại gia đình Kunming Tong Yi, Tết tại trụ sở Tùng Minh','st.f1':'HÌNH 02 — Nhà kính tự động, Tùng Minh','st.f2':'HÌNH 03 — Các giống hỗn hợp vừa rời giàn','st.f3':'HÌNH 04 — Đóng container lạnh, Côn Minh',
  'g.eyebrow':'02 / Cách chúng tôi trồng','g.h2':'Mười tám tháng, ' + ACC.st + 'bốn mùa chăm chút.' + ACC.s,
  'g.note':'Trọn hành trình của một cây lan trải ra bên dưới — men theo thân, từ chai mô đến hoa nở.',
  'g.s1.chip':'Tháng 0–5','g.s1.word':'một','g.s1.title':'Chai mô &amp; cây giống','g.s1.body':'Chỉ những cá thể khỏe, sạch virus mới được nhân giống — mỗi cây mẹ đều qua sàng lọc PCR và ELISA trước khi rót chai mô đầu tiên.','g.s1.fact':'Nguồn giống sạch virus có chứng nhận','g.s1.note':'— gieo trong thủy tinh, giữa không khí vô trùng: cả một nhà kính trong chiếc chai.',
  'g.s2.chip':'Tháng 5–11','g.s2.word':'hai','g.s2.title':'Sinh trưởng','g.s2.body':'Cây giống trải qua ít nhất bốn đến sáu tháng điều hòa khí hậu cho mỗi giai đoạn, với ánh sáng, độ ẩm và tưới tiêu được cảm biến điều chỉnh suốt ngày đêm.','g.s2.fact':'4–6 tháng mỗi giai đoạn, tự động hóa','g.s2.note':'— ngày ấm, sương sớm; lá dày lên theo từng mùa.',
  'g.s3.chip':'Tháng 11–16','g.s3.word':'ba','g.s3.title':'Ra vòi &amp; phòng lạnh','g.s3.body':'Đợt xử lý lạnh năm–sáu tháng kích vòi hoa khỏe và đều — mùa thu dài của Vân Nam tự làm điều mà nơi khác phải ép buộc.','g.s3.fact':'Xử lý lạnh 5–6 tháng','g.s3.note':'— mùa thu trên núi chính là phòng lạnh của chúng tôi, với cánh cửa để ngỏ.',
  'g.s4.chip':'Tháng 16–18','g.s4.word':'bốn','g.s4.title':'Nở hoa &amp; phân loại','g.s4.body':'Cây nở hoa trên giàn và được phân loại thủ công — số hoa, chiều dài vòi, thân, lá và bộ rễ — trước khi bất kỳ cây nào vào thùng.','g.s4.fact':'Phân loại theo năm tiêu chí','g.s4.note':'— năm lần kiểm tra bằng tay trước khi mỗi cây xứng với chiếc thùng của nó.',
  'gr.eyebrow':'Tiêu chuẩn chất lượng xuất khẩu','gr.h3':'Phân loại như đá quý.','gr.side':'Bốn hạng, xem cùng lúc',
  'gr.c1.name':'Đặc hạng','gr.c1.badge':'ưu tiên xuất khẩu',
  'gr.c2.name':'Hạng A','gr.c3.name':'Hạng B','gr.c4.name':'Hạng C',
  'gr.row.f':'hoa &amp; nụ','gr.row.s':'vòi hoa',
  'gr.stem.a':'Vòi nguyên vẹn, chưa từng cắt tỉa','gr.leaf.a':'Lá không đốm, không nứt, không vết cắt','gr.roots.a':'Rễ khỏe — không thối',
  'gr.c3.stem':'Vòi sạch; cho phép cắt tỉa','gr.c3.leaf':'Cho phép vết thương nhẹ trên lá','gr.c3.roots':'1–2 rễ suy, còn lại khỏe',
  'gr.c4.stem':'Cho phép đốm hoặc sẹo trên vòi','gr.c4.leaf':'Cho phép đốm hoặc nứt lá','gr.c4.roots':'Ít rễ hoạt động',
  'gr.note':'Phân loại từ trên xuống — cây phải đạt <em>mọi</em> tiêu chí của một hạng mới được xếp hạng đó. Chín bông trên vòi đã tỉa là hạng B, không phải A. Hóa đơn luôn ghi đúng những gì trong thùng.',
  'g.co2':'≈1.900 m độ cao','g.co3':'trung bình 17°C','g.co4':'2.446 giờ nắng/năm',
  'pano.lb':'MỘT GIÀN TRONG MUÔN GIÀN — TÙNG MINH, THÁNG HAI',
  'p.eyebrow':'03 / Sản phẩm','p.h2':'Đáp ứng mọi nhu cầu mua hàng của bạn.','p.note':'Một vườn ươm, trọn vòng đời — từ cây giống chai mô đến cành cắt tươi.',
  'p.c1.tag':'01 · Cây giống','p.c1.title':'Cây giống','p.c1.body':'Cây non sạch virus, nhân từ nguồn đã sàng lọc PCR và ELISA, nuôi theo lịch hoàn thiện của bạn.',
  'p.c2.tag':'02 · Hoa chậu','p.c2.title':'Hoa chậu','p.c2.body':'Cây nở hoa hoàn thiện — phân loại thủ công từ Đặc hạng đến C, mở thùng là bán lẻ hoặc làm quà được ngay.',
  'p.c3.tag':'03 · Cắt cành','p.c3.title':'Hoa cắt cành','p.c3.body':'Vòi hoa cắt tươi, bọc xốp và đóng lạnh — cho tiệm hoa, sự kiện và nhà bán buôn.',
  'p.slb':'Kích cỡ hiện có','p.slb3':'Mỗi cành',
  'p.sz.spiking':'3.5″ đang ra vòi','p.sz.flowering':'3.8″ đang nở','p.sz.large':'Hoa lớn','p.sz.small':'Hoa nhỏ','p.sz.stems':'5–10 bông / cành','p.sz.reefer':'Chuỗi lạnh reefer',
  'p.sz.spk28':'2.8″ đang ra vòi','p.sz.spk30':'3.0″ đang ra vòi','p.sz.flw28':'2.8″ đang nở','p.sz.flw30':'3.0″ đang nở','p.sz.flw35':'3.5″ đang nở',
  'v.eyebrow':'Bộ sưu tập','v.h2':'Hàng trăm giống, ' + ACC.v + 'và chưa dừng lại.' + ACC.s,
  'v.lede':'Sáu màu chủ đạo chỉ là khởi đầu. Trên cả hoa chậu lẫn cắt cành, chúng tôi giữ hàng trăm giống cùng lúc trong sản xuất — trắng tuyết và hồng phấn, đỏ rượu vang và vàng kim, chấm sao viền cánh và những tân phẩm vân cẩm thạch độc bản — mùa nào cũng có phép lai mới ra vòi. Mỗi bông dưới đây đều đã nở trên giàn của chính chúng tôi.',
  'v.b1.n':'Tuyết','v.b1.z':'TRẮNG','v.b2.n':'Ngà','v.b2.z':'KEM','v.b3.n':'Kem bơ','v.b3.z':'VÀNG NHẠT','v.b4.n':'Hồng phấn','v.b4.z':'HỒNG NHẠT',
  'v.b5.n':'Hồng','v.b5.z':'HỒNG','v.b6.n':'Đào','v.b6.z':'HỒNG SAN HÔ','v.b7.n':'San hô','v.b7.z':'SAN HÔ','v.b8.n':'Hồng hai màu','v.b8.z':'HAI TÔNG',
  'v.b9.n':'Hai màu','v.b9.z':'HAI TÔNG','v.b10.n':'Hồng sẫm','v.b10.z':'CÁNH SEN','v.b11.n':'Đỏ cánh sen','v.b11.z':'RỰC RỠ','v.b12.n':'Tím đỏ','v.b12.z':'TÍM ĐỎ',
  'v.b13.n':'Oải hương','v.b13.z':'TÍM NHẠT','v.b14.n':'Thạch anh tím','v.b14.z':'TÍM ĐẬM','v.b15.n':'Nhung bordeaux','v.b15.z':'ĐỎ RƯỢU VANG','v.b16.n':'Vàng kim','v.b16.z':'VÀNG',
  'v.b17.n':'Sao đêm','v.b17.z':'CHẤM SAO','v.b18.n':'Viền cánh','v.b18.z':'VIỀN MÉP',
  'v.f1':'6 màu chủ đạo','v.f2':'hàng chục kiểu vân','v.f3':'200+ giống đang sản xuất','v.f4':'phép lai mới mỗi mùa','v.link':'Cho chúng tôi biết màu, chúng tôi sẽ khớp →',
  'a.eyebrow':'Dòng đặc trưng · 星空','a.h2':'Chòm Sao',
  'a.lede':'Cả một bầu trời đêm rắc lên những cánh hoa sống — vân cẩm thạch xanh lục, hổ phách và tím, không lần nào rơi giống lần nào. Dòng ‘星空 · Chòm Sao’ được phát triển ' + ACC.b + 'hoàn toàn nội bộ' + ACC.bs + ' tại nhà kính Tùng Minh và đang ' + ACC.b + 'chờ cấp bằng sáng chế' + ACC.bs + ' — mỗi cây một số hiệu, độc bản, chỉ đặt được tại đây.',
  'a.t1':'星空 · CHÒM SAO','a.t2':'CHỜ CẤP BẰNG','a.t3':'LAI TẠO NỘI BỘ','a.t4':'ĐỘC BẢN','a.plants':'Các cây trong dòng',
  'a.c1.n':'Cẩm thạch cam chanh','a.c1.t':'Chậu · 星空','a.c1.b':'Cam và lục đổ tràn trên nền trắng — cây mới nhất rời giàn Chòm Sao, trồng và hoàn thiện nội bộ.',
  'a.c2.n':'Nghệ tây &amp; Trời xanh','a.c2.t':'Thiền đương đại','a.c2.b':'Hổ phách ấm vờn qua xanh dịu — một tuyên ngôn yên tĩnh, ngập nắng.',
  'a.c3.n':'Chàm sứ trắng','a.c3.t':'Thực vật hiện đại','a.c3.b':'Xoáy cobalt trên nền trắng sáng, như mực quét trên sứ.',
  'a.c4.n':'Ngọc hồng','a.c4.t':'Thực vật thủ công','a.c4.b':'Hồng phấn và lục ngọc gấp vào nhau, không hai cánh nào giống nhau.',
  'a.c5.n':'Sương chartreuse','a.c5.t':'Thực vật tối giản','a.c5.b':'Chanh nhạt trôi trên nền kem — lặng lẽ, đương đại, tinh tế.',
  'a.c6.n':'Sorbet Đào','a.c6.t':'Tối giản pastel','a.c6.b':'Đào nhạt và vàng kem loang vào hồng phấn — vân cẩm thạch ấm áp, ươm trồng tại vườn nhà.',
  'a.c7.n':'Cực Quang','a.c7.t':'Thực vật huyền ảo','a.c7.b':'Dải ánh kim bạc hà, tử đinh hương và san hô chuyển sắc trên từng cánh — không đóa nào giống đóa nào.',
  'a.g.t':'Bảng màu của bạn,<br>họa tiết của bạn','a.g.link':'Đặt riêng một dòng →','a.drag':'◄ kéo để xem ►',
  'sh.eyebrow':'04 / Cách giao hàng','sh.h2':'Đóng gói thủ công, ' + ACC.sh + 'vận chuyển lạnh.' + ACC.s,
  'sh.para':'Mỗi vòi hoa bọc xốp, mỗi bông lót bông đệm, mỗi thùng chất vào container lạnh ngay tại cửa. Từ giàn của chúng tôi đến tay bạn — Bắc Kinh hay Bangkok — chuỗi lạnh không bao giờ đứt.',
  'sh.hd':'Quy cách giao hàng','sh.r1.n':'3.8″ đang nở','sh.r2.n':'Hoa lớn','sh.r3.n':'Hoa nhỏ','sh.r4.n':'Cây giống',
  'sh.r1.c':'chậu 3.8″ · 9,7 cm','sh.r2.c':'chậu 4.7″ · 12 cm','sh.r3.c':'chậu 3.5″ · 9 cm','sh.r4.c':'đóng theo cỡ chậu',
  'sh.ppc':'cây / thùng',
  'sh.r1.d1':'thùng lớn 120×52×49 cm · 0,306 m³','sh.r1.d2':'2 khay trong × 20 · 118×49,5×22 cm · 0,129 m³',
  'sh.r2.d1':'thùng lớn 110×45×60 cm · 0,297 m³','sh.r2.d2':'3 khay trong × 20 · 108×43×18 cm · 0,084 m³',
  'sh.r3.d1':'thùng lớn 83×43×61 cm · 0,218 m³','sh.r3.d2':'3 khay trong × 24 · 81×41×19 cm · 0,063 m³',
  'sh.r4.c1':'chậu 1.7″ / 2.0″ — 280','sh.r4.c2':'chậu 2.5″ / 2.8″ — 120','sh.r4.c3':'chậu 3.5″ — 42','sh.r4.c4':'3.5″ ra vòi — 32','sh.r4.d1':'thùng đồng nhất 61×49×30 cm · 0,090 m³',
  'sh.fine':'Kích thước là số đo ngoài của thùng rỗng (cm); thùng đã đóng phồng thêm ≈1–2 cm mỗi cạnh. Thể tích là giá trị ước tính cước.',
  'sh.ch1':'Mọi thành phố lớn Trung Quốc','sh.ch2':'10+ quốc gia','sh.ch3':'Tươi lâu hơn mặt bằng thị trường',
  'c.kick':'Bán buôn · Xuất khẩu · Đặt riêng','c.h2':'Cùng nhau trồng nên<br>điều ' + ACC.c + 'tuyệt đẹp' + ACC.s + '.',
  'c.sub':'Yêu cầu catalogue bán buôn hiện hành — giống, hạng, số cây mỗi thùng và thời gian giao cho thị trường của bạn.',
  'c.ph':'Email công việc của bạn','c.addr':'Tiểu Nhai, huyện Tùng Minh, Côn Minh','c.langs':'EN · 中文 · РУ · VI',
  'f.about':'Kunming Tong Yi Biotechnology Co., Ltd. Hồ điệp cao cấp, trồng tại Vân Nam từ năm 2000.',
  'f.secs':'Chuyên mục','f.lang':'Ngôn ngữ',
  'f.c1':'© 2000–2026 Kunming Tong Yi Biotechnology','f.c2':'Nhà xuất khẩu hồ điệp nở hoa số 1 Trung Quốc',
  '_rail':['Câu chuyện','Cách chúng tôi trồng','Sản phẩm','Art Orchid','Cách giao hàng'],
  '_veilOn':'Hiện toàn bộ ảnh','_veilOff':'Trở lại khuôn cắt',
  '_geo':{myanmar:'MYANMAR',laos:'LÀO',vietnam:'VIỆT NAM',sichuan:'TỨ XUYÊN',guizhou:'QUÝ CHÂU',guangxi:'QUẢNG TÂY',yunnanBig:'云南',yunnanSub:'VÂN NAM'}
}
};

/* ============================================================ engine */
var LANG = 'en';
try { LANG = localStorage.getItem('kmty-lang') || 'en'; } catch (e) {}
if (!I18N[LANG]) LANG = 'en';

function applyDict() {
  var d = I18N[LANG];
  document.querySelectorAll('[data-t]').forEach(function (el) {
    var v = d[el.getAttribute('data-t')];
    if (v != null) el.textContent = v.replace(/&amp;/g, '&');
  });
  document.querySelectorAll('[data-t-html]').forEach(function (el) {
    var v = d[el.getAttribute('data-t-html')];
    if (v != null) el.innerHTML = v;
  });
  document.querySelectorAll('[data-t-ph]').forEach(function (el) {
    var v = d[el.getAttribute('data-t-ph')];
    if (v != null) el.setAttribute('placeholder', v);
  });
  document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : LANG;
  document.querySelectorAll('[data-lang]').forEach(function (b) {
    var on = b.getAttribute('data-lang') === LANG;
    b.classList.toggle('on', on);
    if (b.tagName === 'A') b.style.color = on ? '#F3EEE4' : 'rgba(243,238,228,.72)';
  });
}

window.KMTY_I18N = {
  get lang() { return LANG; },
  dcStrings: function () {
    var d = I18N[LANG];
    return { rail: d._rail, veilOn: d._veilOn, veilOff: d._veilOff };
  },
  set: function (lang) {
    if (!I18N[lang] || lang === LANG) return;
    LANG = lang;
    try { localStorage.setItem('kmty-lang', lang); } catch (e) {}
    applyDict();
    MAP.render();
    window.dispatchEvent(new CustomEvent('kmty:lang'));
    window.dispatchEvent(new Event('scroll'));   // refresh nav styling
  }
};

/* ============================================================ map module */
var SVGNS = 'http://www.w3.org/2000/svg';
var VB = { x: -150, y: -130, w: 1900, h: 1480 };
var MAP = {
  data: null, shown: false,
  els: null,
  grab: function () {
    if (this.els) return this.els;
    var sec = document.getElementById('yunnan');
    if (!sec) return null;
    this.els = {
      sec: sec,
      back: sec.querySelector('[data-mtb]'),
      front: sec.querySelector('[data-mtf]'),
      pins: sec.querySelector('[data-mpins]'),
      cardK: sec.querySelector('[data-pincard="kunming"]'),
      cardW: sec.querySelector('[data-pincard="wenshan"]')
    };
    return this.els;
  },
  text: function (parent, t, x, y, o) {
    var e = document.createElementNS(SVGNS, 'text');
    e.setAttribute('x', x); e.setAttribute('y', y);
    e.setAttribute('fill', o.fill); e.setAttribute('font-size', o.fs);
    e.setAttribute('font-weight', o.fw || 500);
    e.setAttribute('letter-spacing', o.lsp || '.14em');
    e.setAttribute('font-family', o.ff || "'Hanken Grotesk','Noto Sans','Noto Sans SC',sans-serif");
    e.setAttribute('text-anchor', 'middle');
    e.setAttribute('stroke', o.st || 'rgba(4,10,7,.9)');
    e.setAttribute('stroke-width', o.sws || 3);
    e.setAttribute('paint-order', 'stroke');
    e.setAttribute('stroke-linejoin', 'round');
    if (o.op != null) e.setAttribute('opacity', o.op);
    e.textContent = t;
    parent.appendChild(e);
  },
  render: function () {
    var els = this.grab();
    if (!els || !this.data) return;
    var d = I18N[LANG]._geo;
    var zhOf = { myanmar: '缅甸', laos: '老挝', vietnam: '越南', sichuan: '四川', guizhou: '贵州', guangxi: '广西' };
    var enOf = { myanmar: 'MYANMAR', laos: 'LAOS', vietnam: 'VIETNAM', sichuan: 'SICHUAN', guizhou: 'GUIZHOU', guangxi: 'GUANGXI' };
    els.back.innerHTML = ''; els.front.innerHTML = ''; els.pins.innerHTML = '';
    var self = this;
    // on phones the map renders as a small in-flow plate (~390px wide for a 1900-unit
    // viewBox), so labels drawn at desktop sizes come out microscopic — scale them up
    var K = 1;
    try { if (els.sec.getBoundingClientRect().width < 700) K = 2.05; } catch (e) {}
    (this.data.labels || []).forEach(function (l) {
      var key = l.en.toLowerCase();
      var co = l.tag === 'country';
      // small screens: the front overlay svg is hidden, so countries join the plate
      var target = (co && K === 1) ? els.front : els.back;
      var primary = d[key] || l.en.toUpperCase();
      var secondary = (LANG === 'zh') ? enOf[key] : zhOf[key];
      self.text(target, primary, l.x, l.y, { fill: co ? '#C7E7D3' : 'rgba(238,243,238,.8)', fs: (co ? 25 : 23) * K, fw: co ? 600 : 500, op: co ? 1 : .6, sws: (co ? 3.6 : 3) * K });
      if (secondary) self.text(target, secondary, l.x, l.y + (l.zhY - l.y) * K, { fill: co ? '#C7E7D3' : 'rgba(238,243,238,.75)', fs: (co ? 19 : 18) * K, fw: 400, lsp: '.08em', op: co ? .9 : .5, sws: (co ? 3.4 : 3) * K, ff: "'Noto Sans SC','Hanken Grotesk','Noto Sans',sans-serif" });
    });
    // Yunnan centre label
    this.text(els.back, d.yunnanBig, 690, 556, { fill: '#fff', fs: 58 * K, fw: 700, st: 'rgba(6,16,10,.55)', sws: 5 * K, ff: "'Noto Serif SC','Playfair Display',serif" });
    this.text(els.back, d.yunnanSub, 690, 556 + 36 * K, { fill: '#fff', fs: 22 * K, fw: 500, lsp: '.5em', st: 'rgba(6,16,10,.5)', sws: 4 * K });
    // pins: pulse rings + dot (names live on the cards)
    (this.data.pins || []).forEach(function (p) {
      var g = document.createElementNS(SVGNS, 'g');
      g.setAttribute('transform', 'translate(' + p.x + ',' + p.y + ')' + (K > 1 ? ' scale(' + K + ')' : ''));
      [0, 1.4].forEach(function (delay) {
        var c = document.createElementNS(SVGNS, 'circle');
        c.setAttribute('cx', 0); c.setAttribute('cy', 0); c.setAttribute('r', 4);
        c.setAttribute('fill', 'none'); c.setAttribute('stroke', '#ff9fcb'); c.setAttribute('stroke-width', 1.4);
        c.setAttribute('vector-effect', 'non-scaling-stroke');
        c.style.animation = 'kmtyPingR 2.8s ease-out infinite';
        if (delay) c.style.animationDelay = delay + 's';
        g.appendChild(c);
      });
      var dot = document.createElementNS(SVGNS, 'circle');
      dot.setAttribute('cx', 0); dot.setAttribute('cy', 0); dot.setAttribute('r', p.big ? 5.5 : 4.5);
      dot.setAttribute('fill', '#f27cb2'); dot.setAttribute('stroke', '#fff'); dot.setAttribute('stroke-width', 1.4);
      dot.setAttribute('vector-effect', 'non-scaling-stroke');
      g.appendChild(dot);
      els.pins.appendChild(g);
    });
    this.position();
  },
  position: function () {
    var els = this.grab();
    if (!els || !this.data) return;
    var r = els.sec.getBoundingClientRect();
    var w = r.width, h = r.height;
    if (!w || !h) return;
    var small = w < 700;
    var scale = Math.min(w / VB.w, h / VB.h);           // preserveAspectRatio meet
    var ox = (w - VB.w * scale) / 2, oy = (h - VB.h * scale) / 2;
    var px = function (x) { return ox + (x - VB.x) * scale; };
    var py = function (y) { return oy + (y - VB.y) * scale; };
    var pins = {};
    (this.data.pins || []).forEach(function (p) { pins[p.key] = p; });
    // both base cards live in the open area EAST of the province, stacked vertically,
    // each tied back to its pin with a leader line (keeps the Vietnam label uncovered)
    var lead = els.sec.querySelector('[data-leaders]');
    if (lead) lead.innerHTML = '';
    // remember each card's authored width so the desktop branch can restore it
    [els.cardK, els.cardW].forEach(function (c) {
      if (c && c.dataset.kmtyW == null) c.dataset.kmtyW = c.style.width;
    });
    if (small) {
      // phones: the pin layer is a static column (see the max-width:700px CSS),
      // so the base cards flow in-page instead of floating over the map
      [els.cardK, els.cardW].forEach(function (c) {
        if (!c) return;
        c.style.display = 'block';
        c.style.position = 'relative';
        c.style.left = 'auto'; c.style.top = 'auto';
        c.style.width = '100%'; c.style.maxWidth = '460px';
        c.style.margin = '0 auto';
      });
    } else {
      var gap = Math.round(Math.max(16, h * 0.028));
      [els.cardK, els.cardW].forEach(function (c) { if (c) { c.style.display = 'block'; c.style.transform = 'none'; c.style.position = 'absolute'; c.style.width = c.dataset.kmtyW || ''; c.style.maxWidth = ''; c.style.margin = ''; } });
      var kH = els.cardK ? els.cardK.offsetHeight : 300;
      var wH = els.cardW ? els.cardW.offsetHeight : 300;
      var cW = els.cardK ? els.cardK.offsetWidth : 420;
      var totalH = kH + gap + wH;
      var startY = Math.max(Math.round(py(64)), Math.round((h - totalH) / 2));
      var ax = Math.min(Math.round(px(1180)), Math.round(w - cW - Math.max(22, w * 0.02)));
      if (els.cardK) { els.cardK.style.left = ax + 'px'; els.cardK.style.top = startY + 'px'; }
      if (els.cardW) { els.cardW.style.left = ax + 'px'; els.cardW.style.top = (startY + kH + gap) + 'px'; }
      if (lead) {
        lead.setAttribute('viewBox', '0 0 ' + Math.round(w) + ' ' + Math.round(h));
        var sr = els.sec.getBoundingClientRect();
        // hand-drawn tendril in the same spirit as the "How we grow" vine: a filled ribbon
        // with a wobbling centreline and uneven thickness, tapering to a point at each end
        // (no dashes / no mechanical stroke — keeps the floral feel on the dark map).
        var draw = function (pin, card) {
          if (!pin || !card) return;
          var x1 = px(pin.x), y1 = py(pin.y);
          var cr = card.getBoundingClientRect();
          var x2 = cr.left - sr.left, y2 = cr.top - sr.top + Math.min(cr.height / 2, 96);
          var mx = (x1 + x2) / 2;
          var bez = function (t) {
            var u = 1 - t;
            return { x: u*u*u*x1 + 3*u*u*t*mx + 3*u*t*t*mx + t*t*t*x2,
                     y: u*u*u*y1 + 3*u*u*t*y1 + 3*u*t*t*y2 + t*t*t*y2 };
          };
          var SEG = 40, sp = [];
          for (var i = 0; i <= SEG; i++) sp.push(bez(i / SEG));
          var Lp = [], Rp = [];
          for (var i = 0; i <= SEG; i++) {
            var a = sp[Math.max(0, i - 1)], b = sp[Math.min(SEG, i + 1)];
            var dx = b.x - a.x, dy = b.y - a.y, ln = Math.hypot(dx, dy) || 1; dx /= ln; dy /= ln;
            var t = i / SEG, env = Math.sin(Math.PI * t);              // 0 at both tips -> tapered
            var wob = (3.4 * Math.sin(t * 13.1 + 1.2) + 1.7 * Math.sin(t * 31.7 + 3.4)) * env;
            var X = sp[i].x - dy * wob, Y = sp[i].y + dx * wob;
            var w = 0.5 + (1.9 + 0.8 * Math.sin(t * 19.3 + 0.6) + 0.5 * Math.sin(t * 44.1 + 2.1)) * env;
            Lp.push({ x: X - dy * w / 2, y: Y + dx * w / 2 });
            Rp.push({ x: X + dy * w / 2, y: Y - dx * w / 2 });
          }
          var d = '';
          Lp.forEach(function (q, i) { d += (i ? 'L' : 'M') + q.x.toFixed(1) + ' ' + q.y.toFixed(1); });
          for (var i = Rp.length - 1; i >= 0; i--) d += 'L' + Rp[i].x.toFixed(1) + ' ' + Rp[i].y.toFixed(1);
          d += 'Z';
          var p = document.createElementNS(SVGNS, 'path');
          p.setAttribute('d', d); p.setAttribute('fill', '#AED8B9'); p.setAttribute('opacity', '.85');
          lead.appendChild(p);
          var dc = document.createElementNS(SVGNS, 'circle');            // small bud where the tendril meets the photo
          dc.setAttribute('cx', x2.toFixed(1)); dc.setAttribute('cy', y2.toFixed(1)); dc.setAttribute('r', '3.6');
          dc.setAttribute('fill', '#f27cb2'); dc.setAttribute('stroke', 'rgba(246,240,228,.92)'); dc.setAttribute('stroke-width', '1.6');
          lead.appendChild(dc);
        };
        draw(pins.kunming, els.cardK);
        draw(pins.wenshan, els.cardW);
      }
    }
  },
  reveal: function () {
    var els = this.grab();
    if (!els) return;
    this.shown = true;
    [els.back, els.front, els.pins].forEach(function (g) { if (g) g.style.opacity = 1; });
    [els.cardK, els.cardW].forEach(function (c) { if (c) c.style.opacity = 1; });
  }
};

window.addEventListener('kmty:terroirdata', function (e) {
  MAP.data = e.detail;
  MAP.render();
  if (MAP.shown) MAP.reveal();
});
window.addEventListener('kmty:terroirin', function () { MAP.reveal(); });
window.addEventListener('resize', function () { MAP.position(); });

/* ============================================================ switcher + boot */
function wire() {
  document.querySelectorAll('[data-lang]').forEach(function (b) {
    if (b.__kmty) return;
    b.__kmty = true;
    b.addEventListener('click', function (ev) {
      if (b.tagName === 'A') ev.preventDefault();
      window.KMTY_I18N.set(b.getAttribute('data-lang'));
    });
  });
  applyDict();
  if (LANG !== 'en') window.dispatchEvent(new CustomEvent('kmty:lang'));
}
/* self-healing reveals: the runtime can replace nodes after mount, orphaning the
   original IntersectionObservers. No observers, no per-node flags — just sweep the
   viewport and force-reveal anything still hidden. Idempotent and replacement-proof. */
function heal() {
  window.KMTY_HEALN = (window.KMTY_HEALN || 0) + 1;
  // keep the muted timelapse videos playing (innerHTML-created <video muted> loses
  // its muted IDL state in Chromium, so autoplay silently blocks — force it)
  document.querySelectorAll('video[data-bgvideo]').forEach(function (v) {
    if (!v.muted) { v.muted = true; v.defaultMuted = true; }
    if (!v.loop) v.loop = true;                            // seamless native loop (attr is dropped by the React render, so force the property)
    if (v.playbackRate !== 0.5) v.playbackRate = 0.5;      // half-speed timelapse
    // keep it running so the bloom is always mid-open when the viewer scrolls to it
    if (v.paused) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
  });
  var vh = window.innerHeight || 800;
  document.querySelectorAll('[data-reveal],figure[data-clip],[data-clipv]').forEach(function (el) {
    var r = el.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= vh * 0.96 || (!r.width && !r.height)) return;
    if (el.style.opacity !== '' && el.style.opacity !== '1') { el.style.opacity = '1'; el.style.transform = 'none'; }
    el.querySelectorAll('img[style*="clip-path"]').forEach(function (im) {
      if (im.style.clipPath !== 'inset(0px 0px 0px 0px)' && im.style.clipPath !== 'inset(0 0 0 0)') im.style.clipPath = 'inset(0 0 0 0)';
    });
  });
}
setInterval(heal, 1100);
var healPending = false;
window.addEventListener('scroll', function () {
  if (healPending) return;
  healPending = true;
  requestAnimationFrame(function () { healPending = false; heal(); });
}, { passive: true });

/* ---- texture lab (experiment): swap the fabric behind the light sections ---- */
var FABRICS = {
  linen:    { url: 'images/web/linen.webp',            size: '300px', label: '亚麻 Linen' },
  brocade:  { url: 'images/web/fabric-brocade.webp',   size: '192px', label: '织锦 Brocade' },
  tiedye:   { url: 'images/web/fabric-tiedye.webp',    size: '480px', label: '扎染 Tie-dye' },
  water:    { url: 'images/web/fabric-watercolor.webp', size: '560px', label: '水彩 Wash' },
  none:     { url: '', size: '', label: 'None' }
};
var FAB = 'linen';
try { FAB = localStorage.getItem('kmty-fabric') || 'linen'; } catch (e) {}
if (!FABRICS[FAB]) FAB = 'linen';
function applyFabric() {
  var f = FABRICS[FAB];
  document.querySelectorAll('[data-fabric]').forEach(function (el) {
    el.style.backgroundImage = f.url ? 'url("' + f.url + '")' : 'none';
    el.style.backgroundSize = f.size || 'auto';
    el.style.backgroundRepeat = 'repeat';
  });
  var w = document.getElementById('kmty-fabweb');
  if (w) w.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.f === FAB); });
}
function fabricWidget() {
  if (document.getElementById('kmty-fabweb')) return;
  var w = document.createElement('div');
  w.id = 'kmty-fabweb';
  w.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:320;background:rgba(20,24,18,.88);backdrop-filter:blur(8px);border:1px solid rgba(243,238,228,.22);border-radius:999px;padding:7px 12px 7px 16px;display:flex;align-items:center;gap:8px;box-shadow:0 12px 34px rgba(0,0,0,.3);';
  var lb = document.createElement('span');
  lb.textContent = 'experiment · fabric';
  lb.style.cssText = "font-family:'Fraunces','Playfair Display',serif;font-style:italic;font-size:12px;color:rgba(243,238,228,.75);margin-right:2px;";
  w.appendChild(lb);
  Object.keys(FABRICS).forEach(function (k) {
    var b = document.createElement('button');
    b.dataset.f = k;
    b.textContent = FABRICS[k].label;
    b.style.cssText = "border:none;border-radius:999px;padding:6px 11px;font-family:'Hanken Grotesk','Noto Sans SC',sans-serif;font-size:11px;cursor:pointer;background:transparent;color:rgba(243,238,228,.8);transition:all .25s ease;";
    b.addEventListener('click', function () {
      FAB = k;
      try { localStorage.setItem('kmty-fabric', k); } catch (e) {}
      applyFabric();
    });
    w.appendChild(b);
  });
  var st = document.createElement('style');
  st.textContent = '#kmty-fabweb button.on{background:#F3EEE4;color:#1A1E17;}@media(max-width:820px){#kmty-fabweb{display:none !important;}}';
  w.appendChild(st);
  document.body.appendChild(w);
}

function boot() {
  MAP.els = null;          // DOM may have been rebuilt; re-grab on next use
  wire();
  MAP.render();
  heal();
  fabricWidget();
  applyFabric();
  // own reveal fallback in case the runtime's intersection event raced past us
  var sec = document.getElementById('yunnan');
  if (sec && !sec.__kmtyIO && 'IntersectionObserver' in window) {
    sec.__kmtyIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { MAP.reveal(); sec.__kmtyIO.disconnect(); } });
    }, { threshold: 0.22 });
    sec.__kmtyIO.observe(sec);
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
// the dc runtime rebuilds the DOM at mount time — the event can fire before or
// after this script runs depending on cache timing, so belt-and-braces re-apply
window.addEventListener('kmty:mounted', boot);
[300, 900, 2000].forEach(function (ms) { setTimeout(boot, ms); });
})();
