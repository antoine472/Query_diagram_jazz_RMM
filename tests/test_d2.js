// Tests unitaires du widget SafranArchitecture Query Diagram 2026d2 (Node.js + jsdom + jQuery)
// Onglets All / A / B / C / D, tableau des diagrammes, filtres des colonnes, date et auteur de
// modification, vues Tables et Matrices, prefixe proprietaire et masquage des copies heritees.
// Lancement : TZ=Europe/Paris node test_d2.js <dossier du widget>
// (le dossier contient Safran_QueryDiagram.html, js/ELM_utils.js, js/types.js,
//  js/global.configuration.js, js/safran-controller.js)
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const DIR = process.argv[2];

// ---- Page du widget chargee dans jsdom, scripts executes dans la fenetre simulee
const dom = new JSDOM(fs.readFileSync(path.join(DIR, 'Safran_QueryDiagram.html'), 'utf8'),
    { runScripts: 'outside-only', url: 'https://widget.example/' });
const w = dom.window;
const warns = [], infos = [];
w.console.debug = () => {}; w.console.log = () => {};
w.console.warn = (m) => warns.push(String(m)); w.console.info = (m) => infos.push(String(m));
w.eval(fs.readFileSync(require.resolve('jquery/dist/jquery.js'), 'utf8'));
w.eval(['ELM_utils.js', 'types.js', 'global.configuration.js', 'safran-controller.js']
    .map(f => fs.readFileSync(path.join(DIR, 'js', f), 'utf8')).join('\n'));
const $ = w.$;

// ---- $.ajax simule : chaque appel attend la reponse que le test lui donne
let calls = [];
w.$.ajax = (o) => { const d = w.$.Deferred(); calls.push({ o, d }); return d.promise(); };
const take = () => { const c = calls; calls = []; return c; };

// ---- Compteurs de resultats
let ok = 0, ko = 0;
function check(name, cond) {
    if (cond) { ok++; console.log('OK   ' + name); } else { ko++; console.log('FAIL ' + name); }
}

// ---- Reponse du reporting RMM : memes champs que le serveur (releve du 30/10/2026)
const H = 'https://am.example/am/resource-rmm/', CTX = '?oslc_config.context=https%3A%2F%2Fgc.example%2Fgc%2Fconfiguration%2F1';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const el = (id, type, name, o = {}) =>
    `<ArchitectureElement href="${H}${id}${CTX}"><name>${esc(name)}</name><label>${esc(o.label || name)}</label>` +
    `<type>${type}</type><modified>${o.modified || '2026/10/15 8:15:58'}</modified><modifiedBy>${o.by || 'ADMIN'}</modifiedBy>` +
    `<isDiagram>${o.diag === false ? 'false' : 'true'}</isDiagram><isTable>${o.table ? 'true' : 'false'}</isTable>` +
    `<isMatrix>${o.matrix ? 'true' : 'false'}</isMatrix>` + (o.noImage ? '' : `<image>${H}${id}.png</image>`) + `</ArchitectureElement>`;
const list = (...e) => `<rmm><ArchitectureElements>${e.join('')}</ArchitectureElements></rmm>`;
const rdf = (id, kids) => `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:rmm_am="http://jazz.net/ns/am/rmm#">` +
    `<rdf:Description rdf:about="${H}${id}">${kids.map(k => `<rmm_am:aggregate rdf:resource="${H}${k}"/>`).join('')}</rdf:Description></rdf:RDF>`;

// ---- Lecture du tableau affiche
const rows = () => $('#diagram_rows tr.diagram-row').map((i, tr) => ({
    tr: $(tr), type: $(tr).find('.type-label').text(), name: $(tr).find('td.cell-name').text(),
    modified: $(tr).find('td.cell-modified').text(), owner: $(tr).find('td.cell-owner').text()
})).get();
const names = () => rows().map(r => r.name);
const stateText = () => $('#diagram_rows tr.state-row').text().trim();
const counts = () => ['ALL', 'A', 'B', 'C', 'D'].map(t => t + ':' + $('#gui_tab_count_' + t).text()).join(' ');
const filter = (key, value) => $(`input.column-filter[data-filter="${key}"]`).val(value).trigger('input');
const tab = (key) => $(`#gui_levelTabs button[data-tab="${key}"]`).trigger('click');

// ================================================================== 1 Structure et etat initial
w.view_init('https://am.example', '_PROJ', 'https://gc.example');
take();                                                  // ---- requetes GC du demarrage : hors sujet ici
check('1 - cinq onglets All, A, B, C, D', JSON.stringify($('#gui_levelTabs button').map((i, b) => $(b).attr('data-tab')).get()) === '["ALL","A","B","C","D"]');
check('1 - cinq colonnes et quatre filtres', $('#diagram_table .head-row th').length === 5 && $('#diagram_table input.column-filter').length === 4);
check('1 - version affichee 2026d2', $('#widget_version').text().trim() === 'Widget version : 2026d2');
check('1 - onglet All actif au premier lancement', $('#gui_levelTabs button.active').attr('data-tab') === 'ALL');
check('1 - etat initial : Select configuration', stateText() === 'Select configuration');

// ================================================================== 2 Chargement et erreur
w.gui_SetLoadingState();
check('2 - chargement : image dans le tableau et dans la vue Tables', $('#diagram_rows img[alt="loading..."]').length === 1 && $('#table_list img[alt="loading..."]').length === 1);
w.gui_FailObjectList();
check('2 - erreur : message dans le tableau', stateText() === 'Error retrieving data');

// ================================================================== 3 Contenu du tableau
w.gui_BuildObjectList(list(
    el('1', 'Lifecycle Diagram', 'Production lifecycle', { by: 'Lucas' }),
    el('2', 'Use_Case Diagram', 'Main use cases', { modified: '2026/1/5 23:30:00' }),
    el('3', 'Context Diagram', 'Context', {}),
    el('4', 'Functional Behavior Diagram', 'FBD 1', { noImage: true }),
    el('5', 'Functional Chain Diagram', 'Chain 10'),
    el('6', 'Functional Chain Diagram', 'Chain 2'),
    el('7', 'Functional Sequence Diagram', 'Acquire command sequence'),
    el('8', 'Logical Architecture Diagram', 'IP2 - FETT'),
    el('9', 'Logical Architecture Diagram', 'Vue filtrée', { modified: '2026/10/20 9:00:00' }),
    el('10', 'Technical Breakdown Diagram', 'Old TBS', { modified: 'pas une date' }),
    el('11', 'Statechart Diagram', 'Internal statechart'),
    el('12', 'Use_Case Diagram', 'Name <b>bold</b> & co'),
    el('20', 'Function Allocation Table', 'Allocation', { diag: false, table: true }),
    el('21', 'Function Allocation Matrix', 'Matrix A', { diag: false, matrix: true }),
    el('22', 'Function To Use Case Matrix', 'Matrix B', { diag: false, matrix: true, noImage: true })
));
let r = rows();
check('3 - ordre : niveau, type, nom en tri naturel', JSON.stringify(names()) === JSON.stringify([
    'Production lifecycle', 'Main use cases', 'Name <b>bold</b> & co', 'Context', 'FBD 1', 'Chain 2', 'Chain 10',
    'Acquire command sequence', 'IP2 - FETT', 'Vue filtrée', 'Old TBS']));
check('3 - compteurs des onglets', counts() === 'ALL:11 A:4 B:4 C:2 D:1');
check('3 - detail de l onglet B : types remplis / types du niveau', $('#gui_tab_detail_B').text() === '3 of 6 types with diagrams');
check('3 - compteurs de la bascule : 11 diagrammes, 1 table, 2 matrices', $('#gui_count_diagrams').text() === '11' && $('#gui_count_tables').text() === '1' && $('#gui_count_matrices').text() === '2');
check('3 - affiche reduite du type', r[0].tr.find('img.type-icon').attr('src') === './resources/poster_01_Diagramme_de_cycle_de_vie.png' && r[0].type === 'Lifecycle Diagram');
const fsd = r.find(x => x.name === 'Acquire command sequence');
check('3 - Functional Sequence Diagram : onglet B, pastille sans affiche', fsd.type === 'Functional Sequence Diagram' && fsd.tr.hasClass('functional') && fsd.tr.find('.type-chip').length === 1 && fsd.tr.find('img').length === 0);
check('3 - ancien nom TechnicalBreakdownDiagram range en TBS', r.find(x => x.name === 'Old TBS').type === 'Technical Breakdown Structure');
check('3 - date en heure locale (UTC+2 le 15/10)', r[0].modified === '2026-10-15 10:15');
check('3 - date d hiver (UTC+1 le 05/01)', r[1].modified === '2026-01-06 00:30');
check('3 - date au format inconnu gardee telle quelle', r.find(x => x.name === 'Old TBS').modified === 'pas une date');
check('3 - colonne Owner = modifiedBy', r[0].owner === 'Lucas' && r[1].owner === 'ADMIN');
check('3 - lien du nom vers le diagramme, nouvel onglet', r[0].tr.find('td.cell-name a').attr('href') === H + '1' + CTX && r[0].tr.find('td.cell-name a').attr('target') === '_blank');
check('3 - telechargement si image, sinon rien', r[0].tr.find('a[download]').attr('href') === H + '1.png' && r.find(x => x.name === 'FBD 1').tr.find('a[download]').length === 0);
check('3 - nom avec < et & affiche tel quel, sans balise creee', $('#diagram_rows td.cell-name b').length === 0 && names().includes('Name <b>bold</b> & co'));
check('3 - type inconnu : avertissement et pas de ligne', warns.some(m => m.includes('Statechart')) && !names().includes('Internal statechart'));
check('3 - onglet All : types sans diagramme listes', $('#gui_emptyTypes').prop('hidden') === false && $('#gui_emptyTypes').text().startsWith('No diagram yet: Environment Diagram, Operational Sequence Diagram'));
check('3 - vue Tables : un groupe par type', $('#table_list .view-type').text() === 'Function Allocation Table (1)');
check('3 - vue Matrices : deux types, telechargement seulement si image', $('#matrix_list .view-group').length === 2 && $('#matrix_list a[download]').length === 1);

// ================================================================== 4 Onglets
tab('B');
check('4 - onglet B actif, panneau aux couleurs fonctionnelles', $('#gui_levelTabs button.active').attr('data-tab') === 'B' && $('#gui_diagramPanel').hasClass('functional'));
check('4 - onglet B : seulement ses diagrammes', JSON.stringify(names()) === '["FBD 1","Chain 2","Chain 10","Acquire command sequence"]');
check('4 - onglet B : types vides du niveau', $('#gui_emptyTypes').text() === 'No diagram yet: Operating Mode Chart Diagram, Functional Breakdown Structure, System Functional Behavior');
check('4 - onglet memorise', JSON.parse(w.localStorage.getItem('SafranQueryDiagram:_PROJ')).tab === 'B');
tab('D');
check('4 - onglet D : TBS seule', JSON.stringify(names()) === '["Old TBS"]' && $('#gui_diagramPanel').hasClass('technical'));
w.gui_ShowTab('Z');
check('4 - onglet inconnu : retour a All', $('#gui_levelTabs button.active').attr('data-tab') === 'ALL');

// ================================================================== 5 Filtres
filter('name', 'CHAIN');
check('5 - filtre du nom sans majuscules : compteurs', counts() === 'ALL:2 A:0 B:2 C:0 D:0');
check('5 - texte trouve surligne, casse d origine gardee', $('#diagram_rows mark').length === 2 && $('#diagram_rows mark').first().text() === 'Chain');
tab('C');
check('5 - filtre garde en changeant d onglet', stateText() === 'No diagram matches the filters' && $('input.column-filter[data-filter="name"]').val() === 'CHAIN');
filter('name', '');
filter('type', 'logical arch');
check('5 - filtre du type', JSON.stringify(names()) === '["IP2 - FETT","Vue filtrée"]');
filter('modified', '10-20');
check('5 - filtres combines type + date', JSON.stringify(names()) === '["Vue filtrée"]');
filter('type', ''); filter('modified', '');
tab('ALL');
filter('owner', 'luc');
check('5 - filtre de l owner', JSON.stringify(names()) === '["Production lifecycle"]');
filter('owner', '   ');
check('5 - filtre fait d espaces = pas de filtre', names().length === 11);
filter('owner', '');
check('5 - filtres effaces : tout revient', counts() === 'ALL:11 A:4 B:4 C:2 D:1' && $('#diagram_rows mark').length === 0);
w.gui_BuildObjectList(list());
check('5 - configuration sans diagramme : message dedie', stateText() === 'No diagram in this configuration' && $('#gui_count_diagrams').text() === '0');

// ================================================================== 6 Proprietaires des Operating Mode Charts
take();
const OMC = 'Operating Mode Chart Diagram';
w.gui_BuildObjectList(list(
    el('100', 'Operational System', 'B-VSV Actuation System', { diag: false }),
    el('101', 'Functional System', 'B_VSV', { diag: false }),
    el('102', 'Logical System', 'B_VSV LS', { diag: false }),
    el('103', 'Package', 'Pkg', { diag: false }),
    el('110', 'Operating Mode Chart', 'OperatingMode'),
    el('111', 'Operating Mode Chart', 'OperatingMode'),
    el('112', 'Operating Mode Chart', 'OperatingMode'),
    el('120', 'Functional Breakdown Structure', 'VSV FBS')
));
const c1 = take();
const idOf = c => c.o.url.replace(H, '').split('?')[0];
check('6 - une lecture RDF par proprietaire possible, pas pour un package', c1.length === 3 && !c1.some(c => idOf(c) === '103'));
check('6 - delai de 30 s et en-tete RDF', c1.every(c => c.o.timeout === 30000 && c.o.headers.Accept === 'application/rdf+xml'));
const namesOf = (type) => rows().filter(x => x.type === type).map(x => x.name);
c1.find(c => idOf(c) === '100').d.resolve(rdf('100', ['110']));
c1.find(c => idOf(c) === '101').d.resolve(rdf('101', ['111']));
check('6 - reponses partielles : prefixes poses, rien de masque', namesOf(OMC).length === 3 && namesOf(OMC).includes('B-VSV Actuation System_OperatingMode'));
c1.find(c => idOf(c) === '102').d.resolve(rdf('102', ['112']));
check('6 - derniere reponse : seul l original operationnel reste', JSON.stringify(namesOf(OMC)) === '["B-VSV Actuation System_OperatingMode"]');
check('6 - FBS sans prefixe', JSON.stringify(namesOf('Functional Breakdown Structure')) === '["VSV FBS"]');

check('6 - compteurs mis a jour apres masquage', $('#gui_tab_count_B').text() === '2' && $('#gui_count_diagrams').text() === '2');

// ---- Echec de la lecture de l original : un diagramme sans proprietaire connu n'est jamais masque
w.gui_BuildObjectList(list(
    el('100', 'Operational System', 'OA', { diag: false }),
    el('101', 'Functional System', 'FA', { diag: false }),
    el('110', 'Operating Mode Chart', 'OperatingMode'),
    el('111', 'Operating Mode Chart', 'OperatingMode')
));
const c2 = take();
c2.find(c => idOf(c) === '100').d.reject({ status: 500 });
c2.find(c => idOf(c) === '101').d.resolve(rdf('101', ['111']));
check('6 - proprietaire introuvable : nom brut garde, l autre aussi', JSON.stringify(namesOf(OMC).sort()) === '["FA_OperatingMode","OperatingMode"]');

// ---- Deux systemes du meme niveau avec un diagramme du meme nom : les deux restent
w.gui_BuildObjectList(list(
    el('100', 'Operational System', 'Sys A', { diag: false }),
    el('101', 'Operational System', 'Sys B', { diag: false }),
    el('110', 'Operating Mode Chart', 'OperatingMode'),
    el('111', 'Operating Mode Chart', 'OperatingMode')
));
const c3 = take();
c3.find(c => idOf(c) === '100').d.resolve(rdf('100', ['110']));
c3.find(c => idOf(c) === '101').d.resolve(rdf('101', ['111']));
check('6 - meme nom, meme niveau : les deux gardes', JSON.stringify(namesOf(OMC)) === '["Sys A_OperatingMode","Sys B_OperatingMode"]');

// ---- Reponse tardive d'une recherche precedente : ignoree
w.gui_BuildObjectList(list(
    el('100', 'Operational System', 'Late', { diag: false }),
    el('110', 'Operating Mode Chart', 'OperatingMode')
));
const c4 = take();
w.gui_SetLoadingState();
c4[0].d.resolve(rdf('100', ['110']));
check('6 - reponse tardive apres un nouveau chargement : ignoree', stateText() === '' && $('#diagram_rows img[alt="loading..."]').length === 1);

// ================================================================== 7 Retour a l etat initial
w.gui_SetInitialState();
check('7 - retour a l etat initial : message et compteurs vides', stateText() === 'Select configuration' && $('#gui_count_diagrams').text() === '');

console.log('\n' + ok + ' OK / ' + ko + ' FAIL');
process.exit(ko === 0 ? 0 : 1);
