import Link from "next/link";
import "./promo.css";

const Arrow = () => <span aria-hidden="true">→</span>;

const features = [
  { icon: "▦", tone: "blue", title: "Тауар және баға", text: "Каталогты, бағаны, қалдықты және жарияланымды бір жерден басқарыңыз." },
  { icon: "♙", tone: "violet", title: "Сауда өкілдері", text: "Клиент базасы, тапсырыс, маршрут және комиссия — мобильді қосымшада." },
  { icon: "◇", tone: "orange", title: "Қойма процесі", text: "Тапсырысты қабылдау, жинау, стикер мен накладнойды автоматты дайындау." },
  { icon: "⌁", tone: "green", title: "Жеткізу және маршрут", text: "QR арқылы қабылдау, картадағы бағыт және жеткізілгенін растау." },
  { icon: "↗", tone: "cyan", title: "Комиссия және есеп", text: "Сату, орташа чек, комиссия және команда нәтижесі нақты уақытта." },
  { icon: "◎", tone: "navy", title: "Мультиюзер жүйе", text: "Компания, СӨ, қоймашы және экспедиторға бөлек рөл мен кабинет." },
];

const steps = [
  { number: "01", role: "Сауда өкілі", title: "Тапсырысты қабылдайды", text: "Клиентті таңдап, тауарларды қосып, тапсырысты жібереді." },
  { number: "02", role: "Қойма", title: "Тауарды дайындайды", text: "Жинауды бастайды, стикер мен накладнойды шығарып, дайын деп белгілейді." },
  { number: "03", role: "Экспедитор", title: "QR арқылы қабылдайды", text: "Дайын тапсырыстарды сканерлеп, жеткізу маршрутын бастайды." },
  { number: "04", role: "Басшы", title: "Нәтижені көреді", text: "Әр кезеңді, сатуды, қалдықты және комиссияны Workspace-та бақылайды." },
];

export default function PromoPage() {
  return (
    <main className="promo-page">
      <header className="promo-header">
        <Link className="promo-brand" href="/promo" aria-label="Alsat Workspace басты беті">
          <span className="promo-brand-mark">A</span>
          <span><b>ALSAT</b><small>WORKSPACE</small></span>
        </Link>
        <nav className="promo-nav" aria-label="Негізгі навигация">
          <a href="#features">Мүмкіндіктер</a>
          <a href="#workflow">Қалай жұмыс істейді?</a>
          <a href="#roles">Кімге арналған?</a>
        </nav>
        <div className="promo-header-actions">
          <Link className="promo-login" href="/agent-login">Кіру</Link>
          <Link className="promo-button promo-button-small" href="/?start=registration">Тегін бастау <Arrow /></Link>
        </div>
      </header>

      <section className="promo-hero">
        <div className="promo-glow promo-glow-one" />
        <div className="promo-glow promo-glow-two" />
        <div className="promo-hero-copy">
          <div className="promo-kicker"><span>●</span> Қазақстан бизнесіне арналған B2B платформа</div>
          <h1>Сату процесіңізді<br /><em>бір жүйеге</em> біріктіріңіз.</h1>
          <p>Alsat Workspace компания, сауда өкілі, қойма және жеткізуді бір цифрлық кеңістікте байланыстырады. Тапсырыстан жеткізуге дейінгі әр қадам бақылауда.</p>
          <div className="promo-hero-actions">
            <Link className="promo-button" href="/?start=registration">Workspace ашу <Arrow /></Link>
            <a className="promo-button promo-button-ghost" href="#workflow"><span className="promo-play">▶</span> Қалай жұмыс істейді?</a>
          </div>
          <div className="promo-proof">
            <span>✓ Орнату қажет емес</span>
            <span>✓ Телефон мен компьютерде</span>
            <span>✓ Деректер қорғалған</span>
          </div>
        </div>

        <div className="promo-product-stage" aria-label="Alsat Workspace интерфейсінің көрінісі">
          <div className="promo-desktop">
            <aside className="preview-sidebar">
              <div className="preview-logo">A</div>
              {['▦','□','♙','⌂','▤','◎'].map((item, index) => <span className={index === 0 ? 'active' : ''} key={item + index}>{item}</span>)}
            </aside>
            <div className="preview-workspace">
              <div className="preview-top"><span>Kraus Electric TOO</span><span>⌁ &nbsp; ● &nbsp; AK</span></div>
              <div className="preview-content">
                <div className="preview-greeting"><small>БҮГІНГІ НӘТИЖЕ</small><b>Қайырлы күн, Асқар! 👋</b></div>
                <div className="preview-stats">
                  <div><i className="blue">▦</i><small>Тауарлар</small><b>128</b></div>
                  <div><i className="green">♙</i><small>Сауда өкілдері</small><b>24</b></div>
                  <div><i className="orange">□</i><small>Тапсырыстар</small><b>742 500 ₸</b></div>
                </div>
                <div className="preview-table">
                  <div className="preview-table-title"><b>Жаңа тапсырыстар</b><span>Барлығын көру →</span></div>
                  {[
                    ['#1048','Строймаркет','742 500 ₸','Жаңа'],
                    ['#1047','Құрылыс дүкен','385 000 ₸','Жинауда'],
                    ['#1046','Mega Stroy','921 000 ₸','Дайын'],
                    ['#1045','Строй City','215 000 ₸','Жеткізуде'],
                  ].map(row => <div className="preview-row" key={row[0]}><b>{row[0]}</b><span>{row[1]}</span><strong>{row[2]}</strong><em>{row[3]}</em></div>)}
                </div>
              </div>
            </div>
          </div>

          <div className="promo-phone">
            <div className="phone-status"><b>9:41</b><span>● ◔ ▰</span></div>
            <div className="phone-person"><span className="phone-avatar">Н</span><div><b>Нұрлан Әбдірахманов</b><small>Сауда өкілі</small></div><i>♧</i></div>
            <div className="phone-summary"><small>Бүгінгі көрсеткіштер</small><b>1 245 000 ₸</b><span>12 тапсырыс · 24 клиент</span></div>
            <div className="phone-actions"><b>Жылдам әрекеттер</b><div><span>▣<small>Тапсырыс</small></span><span>♙<small>Клиент</small></span></div></div>
            <div className="phone-orders"><b>Соңғы тапсырыстар</b>{['Строймаркет','ЭлектроДОМ','Техносвет'].map((name, index) => <div key={name}><span>▣</span><p><b>№1004{5-index} · {name}</b><small>Жаңа тапсырыс</small></p><strong>{[245,185,315][index]} 000 ₸</strong></div>)}</div>
            <div className="phone-nav"><span className="active">⌂<small>Басты</small></span><span>▤<small>Тапсырыс</small></span><span>♙<small>Клиент</small></span><span>↗<small>Есеп</small></span></div>
          </div>
          <div className="promo-float promo-float-orders"><i>↗</i><span><small>Бүгінгі тапсырыс</small><b>+24%</b></span></div>
          <div className="promo-float promo-float-live"><span>●</span> Нақты уақытта</div>
        </div>
      </section>

      <div className="promo-trust"><span>БІР ЖҮЙЕДЕ</span><b>САТУ</b><i>×</i><b>ҚОЙМА</b><i>×</i><b>ЖЕТКІЗУ</b><i>×</i><b>АНАЛИТИКА</b></div>

      <section className="promo-section" id="features">
        <div className="promo-section-head"><div><span className="promo-eyebrow">БАРЛЫҒЫ БІР ЖЕРДЕ</span><h2>Күнделікті жұмысты<br />жеңілдететін құралдар</h2></div><p>Командаңызға бөлек бағдарламалар қажет емес. Alsat сатудың толық циклін бір-бірімен байланыстырады.</p></div>
        <div className="promo-feature-grid">
          {features.map(feature => <article className="promo-feature" key={feature.title}><span className={`promo-feature-icon ${feature.tone}`}>{feature.icon}</span><h3>{feature.title}</h3><p>{feature.text}</p><a href="#workflow">Толығырақ <Arrow /></a></article>)}
        </div>
      </section>

      <section className="promo-workflow" id="workflow">
        <div className="promo-workflow-inner">
          <div className="promo-workflow-copy"><span className="promo-eyebrow light">БІР ТАПСЫРЫС — ТӨРТ РӨЛ</span><h2>Әркім өз жұмысын көреді.<br /><em>Бәрі бір нәтиже үшін.</em></h2><p>Ақпарат қолмен тасымалданбайды. Бір қызметкердің әрекеті келесі рөлдің кабинетінде автоматты түрде пайда болады.</p></div>
          <div className="promo-flow-visual"><div className="flow-core"><span>A</span><b>ALSAT</b><small>БІР ДЕРЕК</small></div>{['СӨ','ҚОЙМА','ЖЕТКІЗУ','БАСШЫ'].map((role, index) => <div className={`flow-role role-${index+1}`} key={role}><i>{['♙','◇','⌁','↗'][index]}</i><b>{role}</b></div>)}</div>
          <div className="promo-steps">{steps.map(step => <article key={step.number}><span>{step.number}</span><small>{step.role}</small><h3>{step.title}</h3><p>{step.text}</p></article>)}</div>
        </div>
      </section>

      <section className="promo-section promo-roles-section" id="roles">
        <div className="promo-section-head centered"><div><span className="promo-eyebrow">ӘР РӨЛГЕ — ӨЗ КАБИНЕТІ</span><h2>Командаңызға түсінікті интерфейс</h2></div><p>Артық батырмасыз, тек жұмысына қажетті ақпарат. Телефонда да, компьютерде де ыңғайлы.</p></div>
        <div className="promo-role-grid">
          <article className="promo-role-card sales"><div className="role-card-copy"><span>САУДА ӨКІЛІНЕ</span><h3>Клиент жанында тапсырыс алыңыз</h3><p>Каталог, клиент картасы, маршрут және комиссия әрқашан қолда.</p><Link href="/agent">СӨ кабинетін көру <Arrow /></Link></div><div className="role-phone"><div className="mini-head">Клиенттер <b>＋</b></div><div className="mini-search">⌕ Клиентті іздеу</div>{['Строймаркет','ЭлектроДОМ','Техносвет'].map((x,i)=><div className="mini-client" key={x}><i>⌂</i><span><b>{x}</b><small>{[120,85,95][i]} 000 ₸</small></span><em>Белсенді</em></div>)}</div></article>
          <article className="promo-role-card warehouse"><div className="role-card-copy"><span>ҚОЙМАҒА</span><h3>Жинауды ретімен басқарыңыз</h3><p>Қабылдау, жинау, стикер, накладной және дайын тапсырыс бір ағында.</p><Link href="/warehouse">Қойма кабинетін көру <Arrow /></Link></div><div className="warehouse-ticket"><div><small>ТАПСЫРЫС</small><b>№100045</b><em>Жинауда</em></div><ul><li><span>Кабель ВВГнг 3×2.5</span><b>10 дана</b></li><li><span>Автомат C16</span><b>5 дана</b></li><li><span>Розетка ақ</span><b>20 дана</b></li></ul><strong>QR</strong><small>СТИКЕР ДАЙЫН</small></div></article>
          <article className="promo-role-card delivery"><div className="role-card-copy"><span>ЭКСПЕДИТОРҒА</span><h3>Маршрутты бір батырмамен бастаңыз</h3><p>QR сканерлеп қабылдаңыз, карта арқылы жеткізіп, қолтаңбамен растаңыз.</p><Link href="/dispatcher">Экспедитор кабинетін көру <Arrow /></Link></div><div className="route-map"><span className="route-line" /><i className="route-dot d1">1</i><i className="route-dot d2">2</i><i className="route-dot d3">3</i><div className="route-card"><small>КЕЛЕСІ НҮКТЕ</small><b>Строймаркет</b><span>2.4 км · 10:30 дейін</span></div></div></article>
        </div>
      </section>

      <section className="promo-benefits">
        <article><i>◉</i><div><b>Offline режим</b><span>Интернет болмаса да жұмыс жалғасады</span></div></article>
        <article><i>↻</i><div><b>Нақты уақыт</b><span>Өзгерістер бірден барлық рөлге түседі</span></div></article>
        <article><i>♢</i><div><b>Қауіпсіз дерек</b><span>Supabase негізіндегі қорғалған архитектура</span></div></article>
        <article><i>□</i><div><b>PWA қосымша</b><span>Телефонға дүкеннен жүктемей орнатылады</span></div></article>
      </section>

      <section className="promo-final-cta">
        <div className="cta-grid" /><div className="cta-orb orb-one" /><div className="cta-orb orb-two" />
        <span className="promo-eyebrow light">АЛҒАШҚЫ ҚАДАМ</span><h2>Сатуды бүгіннен бастап<br />бір жүйеде басқарыңыз.</h2><p>Alsat Workspace-қа компанияңызды тіркеп, командаңызбен жұмыс процесін бастаңыз.</p>
        <div><Link className="promo-button promo-button-white" href="/?start=registration">Тегін Workspace ашу <Arrow /></Link><Link className="promo-cta-login" href="/agent-login">Аккаунтым бар — кіру</Link></div>
      </section>

      <footer className="promo-footer"><Link className="promo-brand" href="/promo"><span className="promo-brand-mark">A</span><span><b>ALSAT</b><small>WORKSPACE</small></span></Link><p>Қазақстан бизнесіне арналған сату және дистрибуция платформасы.</p><span>© 2026 Alsat Workspace</span></footer>
    </main>
  );
}
