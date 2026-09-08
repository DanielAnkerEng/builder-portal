import { resolveDemo } from './demo-data.mjs'

const params = new URLSearchParams(location.search)
const demo = resolveDemo(params.get('site'))
document.body.classList.add(`demo-${demo.theme}`)
document.title = `${demo.name} – nettsideeksempel | Wreach`

const root = document.getElementById('demoRoot')
const element = (tag, className, text) => { const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node }
const link = (className, text, href) => { const node=element('a',className,text);node.href=href;return node }

const nav=element('header','demo-nav');const brand=element('a','demo-brand',demo.name);brand.href='#top';const navLinks=element('nav','demo-nav-links');for(const [text,href] of [['Tjenester','#tjenester'],['Om oss','#historie'],['Kontakt','#kontakt-demo']])navLinks.append(link('',text,href));nav.append(brand,navLinks,link('demo-nav-cta','Ta kontakt','#kontakt-demo'))

const hero=element('section','demo-hero');hero.id='top';const copy=element('div','demo-hero-copy');copy.append(element('p','demo-kicker',demo.kicker),element('h1','',demo.title),element('p','demo-intro',demo.intro));const actions=element('div','demo-actions');actions.append(link('demo-primary',demo.cta,'#tjenester'),link('demo-secondary','Om virksomheten','#historie'));copy.append(actions)
const art=element('div','demo-art');art.setAttribute('aria-label','Dekorativ presentasjon');art.append(element('span','demo-badge',demo.badge),element('div','demo-art-main',demo.visual),element('div','demo-art-detail','01 / 03'))
hero.append(copy,art)

const services=element('section','demo-services');services.id='tjenester';const serviceHead=element('div','demo-section-head');serviceHead.append(element('p','demo-kicker',demo.label),element('h2','',demo.theme==='estate'?'Utvalgt med omtanke':'Det viktigste, gjort skikkelig'));const serviceGrid=element('div','demo-service-grid');demo.services.forEach(([title,description],index)=>{const card=element('article','demo-service-card');card.append(element('span','demo-service-index',String(index+1).padStart(2,'0')),element('h3','',title),element('p','',description));serviceGrid.append(card)});services.append(serviceHead,serviceGrid)

const story=element('section','demo-story');story.id='historie';const storyVisual=element('div','demo-story-visual');storyVisual.append(element('span','',demo.visual));const storyCopy=element('div','demo-story-copy');storyCopy.append(element('p','demo-kicker','Vår tilnærming'),element('blockquote','',demo.quote),element('p','','Et nettsideeksempel utviklet for å vise hvordan tydelig innhold, særpreg og god struktur kan skape tillit.'));story.append(storyVisual,storyCopy)

const contact=element('section','demo-contact');contact.id='kontakt-demo';contact.append(element('p','demo-kicker','Ta neste steg'),element('h2','',demo.cta),element('p','',demo.contact),link('demo-primary','Tilbake til Wreach','index.html#kontakt'),element('small','demo-disclaimer','Demonstrasjon – ingen bestilling eller henvendelse sendes fra denne siden.'))
const footer=element('footer','demo-footer');footer.append(element('strong','',demo.name),element('span','','Nettsideeksempel laget av Wreach'))
root.append(nav,hero,services,story,contact,footer)
