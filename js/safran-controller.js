/*******************************************************************************/
/*                    (C) Copyright 2019 by Safran Aircraft Engines            */
/*                             All rights reserved                             */
/*******************************************************************************/
/*
+-------------------------------------------------------------------------------+
| Revision |    Date    |     Author     |                Issue                 |
+-------------------------------------------------------------------------------+
|     1    | 15/04/2022 |   Safran - LO  | Initial version                      |
|     2    | 02/08/2023 |   Safran - LO  | Change request for components        |
|     3    | 18/03/2024 |   Safran - LO  | Change REST query for JAZZ V7 OP1/2  |
|     4    | 18/04/2024 |   Safran - AP  | Change REST query for JAZZ V7 OP3    |
|     5    | 07/05/2025 |   Safran - LO  | Add download button				    |
|     6    | 18/11/2025 |   Safran - LO  | Accept whitespace in diagram types   |
|     7    | 38/03/2026 |   Safran - LO  | GC taking into account               |
|     8    | 26/10/2026 |   Safran - AP  | Operating Mode Chart / TBS type names|
|     9    | 26/10/2026 |   Safran - AP  | SFB and Environment diagram boxes    |
|    10    | 26/10/2026 |   Safran - AP  | Mode charts: owner, inherited copies |
|    11    | 26/10/2026 |   Safran - AP  | Views Diagrams/Tables/Matrix, memory |
|    12    | 29/10/2026 |   Safran - AP  | Functional Chain Diagram box         |
|    13    | 30/10/2026 |   Safran - AP  | Tabs, diagram table, column filters  |
+-------------------------------------------------------------------------------+

*/

/* ------------------------------------------------------------------------------
---- Constantes
--------------------------------------------------------------------------- */
const IS_FAILED = "FAILED";
const IS_SUCCESS = "SUCCEDED";
const IS_INPROGRESS = "IN_PROGRESS";

const GUI_ITEM_SWITCHLOCALCONF_ROOT = "gui_switchlocalconf";
const GUI_ITEM_SWITCHGLOBALCONF_ROOT = "gui_switchglobalconf";

// ---- Icons
const GUI_ICON_AM_STREAM = "./resources/am_stream_icon.png";
const GUI_ICON_AM_COMPONENT = "./resources/am_component_icon.png";

// ---- Prefixe proprietaire des Operating Mode Charts, comme l'en-tete de diagramme Rhapsody
// ---- Le service de reporting ne renvoie pas le proprietaire d'un element : seul le
// ---- proprietaire connait ses enfants (propriete RDF rmm_am:aggregate). On lit donc le
// ---- RDF des elements pouvant contenir un Operating Mode Chart :
// ----   - propriete Aggregates du profil : Operational System, Logical System, Stakeholder
// ----   - par heritage (Redefines System) : Functional System
// ---- Niveau = rang dans l'analyse descendante (1 = operationnel, 2 = fonctionnel, 3 = logique).
// ---- Un diagramme herite porte le meme nom que l'original : quand plusieurs diagrammes
// ---- ont le meme nom, seul celui du niveau le plus haut est affiche.
const OWNER_LEVELS = {
    'Operational System': 1,
    'Stakeholder': 1,
    'Functional System': 2,
    'Logical System': 3
};
const OWNER_REQUEST_TIMEOUT = 30000;                            // ---- ms, pour ne jamais bloquer le masquage

// ---- Niveaux d'analyse de la methode (packages A a D du profil) : un onglet par niveau
const DIAGRAM_LEVELS = [
    { key: "A", name: "Operational", css: "operational" },
    { key: "B", name: "Functional", css: "functional" },
    { key: "C", name: "Logical", css: "logical" },
    { key: "D", name: "Technical", css: "technical" }
];
const TAB_ALL = "ALL";                                          // ---- Onglet de tous les niveaux

// ---- Types de diagrammes affiches, dans l'ordre des cadres de la version D
// ----   names       : nom du New Term renvoye par le reporting, espaces supprimes
// ----                 (les anciens noms des New Terms sont conserves)
// ----   poster      : affiche du type (dossier resources), affichee en petit dans le tableau ;
// ----                 "" = pastille de la couleur du niveau
// ----   ownerPrefix : diagramme prefixe par son proprietaire (voir OWNER_LEVELS)
const DIAGRAM_TYPE_LIST = [
    // ---- A Operational
    { names: ["LifecycleDiagram"], level: "A", label: "Lifecycle Diagram", poster: "poster_01_Diagramme_de_cycle_de_vie.png" },
    { names: ["Use_CaseDiagram"], level: "A", label: "Use Case Diagram", poster: "poster_02_Diagramme_de_cas_d_utilisation.png" },
    { names: ["ContextDiagram"], level: "A", label: "Context Diagram", poster: "poster_04_Diagramme_de_contexte.png" },
    { names: ["EnvironmentDiagram"], level: "A", label: "Environment Diagram", poster: "poster_04_Diagramme_de_contexte.png" },
    { names: ["OperationalSequenceDiagram"], level: "A", label: "Operational Sequence Diagram", poster: "poster_03_Diagramme_de_scenario_operationnel.png" },
    // ---- B Functional
    { names: ["OperatingModeChart", "OperatingModeChartDiagram"], level: "B", label: "Operating Mode Chart Diagram", poster: "poster_05_Diagramme_de_modes.png", ownerPrefix: true },
    { names: ["FunctionalBreakdownStructure"], level: "B", label: "Functional Breakdown Structure", poster: "poster_06_Arborescence_fonctionnelle.png" },
    { names: ["SystemFunctionalBehavior"], level: "B", label: "System Functional Behavior", poster: "poster_07_Diagramme_de_comportement_fonctionnel.png" },
    { names: ["FunctionalBehaviorDiagram"], level: "B", label: "Functional Behavior Diagram", poster: "poster_07_Diagramme_de_comportement_fonctionnel.png" },
    { names: ["FunctionalChainDiagram"], level: "B", label: "Functional Chain Diagram", poster: "poster_07_Diagramme_de_comportement_fonctionnel.png" },
    { names: ["FunctionalSequenceDiagram"], level: "B", label: "Functional Sequence Diagram", poster: "" },
    // ---- C Logical
    { names: ["LogicalSequenceDiagram"], level: "C", label: "Logical Sequence Diagram", poster: "poster_11_Diagramme_de_scenario_interne.png" },
    { names: ["LogicalBreakdownStructure"], level: "C", label: "Logical Breakdown Structure", poster: "poster_10_Arborescence_organique.png" },
    { names: ["LogicalArchitectureDiagram"], level: "C", label: "Logical Architecture Diagram", poster: "poster_09_Diagramme_de_structure_logique.png" },
    // ---- D Technical
    { names: ["TechnicalBreakdownStructure", "TechnicalBreakdownDiagram"], level: "D", label: "Technical Breakdown Structure", poster: "poster_14_Arborescence_physique.png" },
    { names: ["TechnicalArchitectureDiagram"], level: "D", label: "Technical Architecture Diagram", poster: "poster_13_Diagramme_de_structure_physique.png" }
];

// ---- Acces direct par nom de New Term, et rang de chaque type pour le tri du tableau
const DIAGRAM_TYPES = {};
DIAGRAM_TYPE_LIST.forEach(function (myType, idx) {
    myType.order = idx;
    myType.names.forEach(function (myName) {
        DIAGRAM_TYPES[myName] = myType;
    });
});

// ---- Image de chargement, dans le tableau et dans les vues Tables et Matrices
const LOADING_IMG = '<img src="./resources/loading.gif" alt="loading..." width="35" height="35" style="display: block;margin-left: auto;margin-right: auto;" />';

// ---- Vues du widget : tableau des diagrammes, liste des tables, liste des matrices
const VIEW_NAMES = ["diagrams", "tables", "matrices"];

// ---- Memoire des choix de l'utilisateur (navigateur local, comme un cookie mais jamais envoye au
// ---- serveur). La cle est completee par l'ID du projet AM : un jeu de choix par projet.
const STORAGE_PREFIX = "SafranQueryDiagram:";
const OWNER_SEPARATOR = "_";                                    // ---- "Proprietaire_Diagramme"
const NS_RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";   // ---- Espace de noms RDF
const NS_RMM = "http://jazz.net/ns/am/rmm#";                    // ---- Espace de noms RMM (rmm_am)


/* ------------------------------------------------------------------------------
---- Variables globales
--------------------------------------------------------------------------- */
var AM_HOSTNAME;
var AM_PROJECT_ID;
var AM_PROJECT_GC;
var AM_COMPONENT_NAME;
var selectedStreamURI;

var g_ConfGCList = [];                          // ---- GC configurations list
var g_ConfCurrent = new ClassConfiguration();   // ---- Current configuration
var g_OwnerRequestId = 0;                       // ---- Numero de la derniere recherche de proprietaires
var g_Diagrams = [];                            // ---- Diagrammes du composant (voir gui_BuildObjectList)
var g_DiagramState = "initial";                 // ---- initial, loading, failed ou loaded
var g_Filters = { type: "", name: "", modified: "", owner: "" };   // ---- Filtres des colonnes
var g_Tab = TAB_ALL;                            // ---- Onglet courant


/* ------------------------------------------------------------------------------
---- Widget Fonctions
--------------------------------------------------------------------------- */

/** Initialisation de l'IHM du widget */
function view_init(am_hostname, projetID, gc_hostname) {

    AM_HOSTNAME = am_hostname;
    AM_PROJECT_ID = projetID;
    AM_PROJECT_GC = gc_hostname;

    clearInputs();

    // ---- Bascule Diagrams | Tables | Matrices, avec retour sur la derniere vue utilisee
    $("#gui_viewSwitch").on("click", "button", function () {
        gui_ShowView($(this).attr("data-view"));
    });
    gui_ShowView(widget_LoadChoices().view);

    // ---- Onglets All / A / B / C / D, avec retour sur le dernier onglet utilise
    $("#gui_levelTabs").on("click", "button", function () {
        gui_ShowTab($(this).attr("data-tab"));
    });
    // ---- Filtres des colonnes : communs a tous les onglets, appliques a chaque frappe
    $("#diagram_table").on("input", "input.column-filter", function () {
        g_Filters[$(this).attr("data-filter")] = $(this).val();
        gui_RenderDiagrams();
    });
    gui_ShowTab(widget_LoadChoices().tab);

    console.debug("[view_init] AM_HOSTNAME = " + AM_HOSTNAME);
    console.debug("[view_init] AM_PROJECT_ID = " + AM_PROJECT_ID);
    console.debug("[view_init] AM_PROJECT_GC = " + AM_PROJECT_GC);

    getGlobalConfigurationProjects();
}

/**
 * Cleans all Project, Configuration, Component inputs
 */
function clearInputs() {
    $("#gui_gcprojectBtnContent").empty();
    $("#gui_gcconfigBtnContent").empty();
    $("#gui_configBtnContent").empty();
    $("#gui_gcbaselineBtnContent").empty();
    $("#gui_amStreamBtnContent").empty();     // ---- Entrees d'exemple du HTML retirees
    $("#gui_componentBtnContent").empty();
}

function gui_SetInitialState() {
    gui_SetDiagramState("initial");
    $("#table_list").html('<li>Select configuration</li>');
    $("#matrix_list").html('<li>Select configuration</li>');
    $(".view-count").text("");                // ---- Compteurs des vues vides tant que rien n'est charge
}

function gui_SetLoadingState() {
    gui_SetDiagramState("loading");
    $("#table_list").html('<li>' + LOADING_IMG + '</li>');
    $("#matrix_list").html('<li>' + LOADING_IMG + '</li>');
    $(".view-count").text("");
}
/**
* Afficher un indicateur de probleme
*/
function gui_FailObjectList() {
    gui_SetDiagramState("failed");
    $("#table_list").html('<li>Error retrieving data</li>');
    $("#matrix_list").html('<li>Error retrieving data</li>');
    $(".view-count").text("");
}

/**
* Etat du tableau des diagrammes hors chargement reussi : la liste est videe et les
* recherches de proprietaires en cours sont ignorees
* @param {String} state - "initial", "loading" ou "failed"
*/
function gui_SetDiagramState(state) {
    g_DiagramState = state;
    g_Diagrams = [];
    g_OwnerRequestId++;
    gui_RenderDiagrams();
}

/**
* Fonction principale
* Les objets sont structuré par le metamodel:
* https://agsdm-ap.snm.snecma:9443/am/reporting/rhapsody/ArchitectureElementStatistics?metadata=schema
* @param {*} data 
* @returns 
*/
function gui_BuildObjectList(data) {
    let xmlData = $.parseXML(data);

    // ---- Nouvelle liste des diagrammes, affichee par gui_RenderDiagrams
    let myDiagrams = [];

    // ---- Elements pouvant posseder un Operating Mode Chart (voir OWNER_LEVELS)
    let ownerCandidates = [];

    // ---- Tables et matrices, affichees dans les vues Tables et Matrices
    let viewItems = [];

    $(xmlData).find('ArchitectureElement').each(function () { // ---- Boucler sur chaque artefact

        const isDiagram = $(this).find('isDiagram').text();
        const myType = $(this).find('type').text();

        // ---- Element d'un type proprietaire possible : on le garde pour la recherche du proprietaire
        let ownerLevel = OWNER_LEVELS[myType];
        if (isDiagram !== "true" && ownerLevel !== undefined) {
            ownerCandidates.push({ href: $(this).attr('href'), label: rmm_ElementLabel(this), level: ownerLevel });
        }

        // ---- Table ou matrice (indicateurs isTable / isMatrix du service de reporting)
        let isMatrix = $(this).find('isMatrix').text() === "true";
        if (isDiagram !== "true" && (isMatrix || $(this).find('isTable').text() === "true")) {
            viewItems.push({
                kind: isMatrix ? "matrix" : "table",
                type: myType,
                label: rmm_ElementLabel(this),
                link: $(this).attr('href'),
                image: $(this).find('image').text()
            });
        }

        if (isDiagram === "true") {
            // ---- Le type renvoye est le nom du New Term du profil, espaces supprimes ici
            const myKind = DIAGRAM_TYPES[myType.replace(/\s+/g, '')];
            if (myKind === undefined) {
                console.warn("Corresponding SafranArchitecture diagram type not found for: " + myType);
                return;                                 // ---- element suivant
            }
            const myLink = $(this).attr('href');
            const myLabel = rmm_ElementLabel(this);
            myDiagrams.push({
                kind: myKind,                           // ---- entree de DIAGRAM_TYPE_LIST
                uri: rmm_BaseUri(myLink),               // ---- adresse comparee au RDF des proprietaires
                link: myLink,
                image: $(this).find('image').text(),
                label: myLabel,                         // ---- nom d'origine
                name: myLabel,                          // ---- nom affiche (prefixe proprietaire eventuel)
                modified: rmm_FormatModified($(this).find('modified').text()),
                modifiedBy: $(this).find('modifiedBy').text(),
                owner: undefined,                       // ---- nom du proprietaire, une fois trouve
                ownerLevel: undefined,                  // ---- niveau du proprietaire (OWNER_LEVELS)
                hidden: false                           // ---- copie heritee masquee
            });
        }
    });

    g_Diagrams = myDiagrams;
    g_DiagramState = "loaded";
    gui_RenderDiagrams();

    // ---- Vues Tables et Matrices, puis compteurs de la bascule de vues
    gui_BuildViewLists(viewItems);

    // ---- Ajout asynchrone du prefixe proprietaire puis masquage des copies heritees
    // ---- (le nom actuel reste affiche en cas d'echec)
    rmm_ResolveDiagramOwners(ownerCandidates);
}

/**
* Fonction de tri des diagrammes par "natural sort"
* @param {*} mylist 
* @returns 
*/
function sortlist(mylist) {
    var listitems = mylist.children('li').get();
    // @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare
    listitems.sort((a, b) => a.innerText.localeCompare(b.innerText, navigator.languages[0] || navigator.language, { numeric: true, ignorePunctuation: true }))
    $.each(listitems, function (idx, itm) { mylist.append(itm); });
}

/**
* Libelle d'un element du service de reporting : label, ou name si label vaut "null" ou est vide
* (meme regle que pour les diagrammes dans gui_BuildObjectList)
* @param {Element} xmlElement - noeud ArchitectureElement de la reponse du reporting
* @returns {String} libelle a afficher
*/
function rmm_ElementLabel(xmlElement) {
    let myLabel = $(xmlElement).children('label').text();
    if (myLabel === "null" || myLabel === "")
        myLabel = $(xmlElement).children('name').text();
    return myLabel;
}

/**
* Adresse d'une ressource RMM sans ses parametres (?oslc_config.context=...)
* @param {String} href - adresse complete
* @returns {String} adresse de base, identique dans le reporting et dans le RDF
*/
function rmm_BaseUri(href) {
    return (href || "").split("?")[0];
}

/**
* Recherche des proprietaires : lecture du RDF de chaque candidat, puis recherche des
* diagrammes a prefixer parmi ses enfants directs (rmm_am:aggregate). Quand toutes les
* reponses sont arrivees (succes ou echec), les copies heritees sont masquees.
* @param {Array} candidates - liste de {href, label, level} construite dans gui_BuildObjectList
*/
function rmm_ResolveDiagramOwners(candidates) {
    // ---- Nouvelle recherche : les reponses tardives d'une recherche precedente seront ignorees
    const myRequestId = ++g_OwnerRequestId;
    let myPending = candidates.length;

    // ---- Aucun diagramme a prefixer : aucune requete
    if (!g_Diagrams.some(function (d) { return d.kind.ownerPrefix === true; })) {
        return;
    }

    $.each(candidates, function (idx, owner) {
        // ---- GET direct (sans ajax_async_request) : un echec ne doit pas ouvrir de fenetre
        // ---- d'authentification, le nom actuel du diagramme reste simplement affiche
        $.ajax({
            url: owner.href,
            method: "GET",
            dataType: "text",
            headers: { "OSLC-Core-Version": "2.0", "Accept": "application/rdf+xml" },
            xhrFields: { "withCredentials": true },
            timeout: OWNER_REQUEST_TIMEOUT
        }).done(function (data) {
            if (myRequestId === g_OwnerRequestId) {
                rmm_ApplyOwner(data, owner);
            }
        }).fail(function (jqXHR) {
            mgt_Console("Owner lookup failed for '" + owner.href + "' (" + jqXHR.status + ")", CONSOLE_WARNING);
        }).always(function () {
            // ---- Derniere reponse de la recherche courante : masquage des copies heritees
            myPending--;
            if (myPending === 0 && myRequestId === g_OwnerRequestId) {
                gui_HideInheritedDiagrams();
            }
        });
    });
}

/**
* Ajoute le prefixe "Proprietaire_" aux diagrammes contenus directement par un element
* et note le niveau du proprietaire (utilise par gui_HideInheritedDiagrams)
* @param {String} rdfText - RDF/XML de l'element proprietaire
* @param {Object} owner - {href, label, level} de l'element proprietaire
*/
function rmm_ApplyOwner(rdfText, owner) {
    let myDoc;
    try {
        myDoc = $.parseXML(rdfText);
    } catch (e) {
        return;                                     // ---- Reponse illisible : nom actuel conserve
    }

    // ---- Adresses des enfants directs du proprietaire
    let myChildren = {};
    $.each(myDoc.getElementsByTagNameNS(NS_RMM, "aggregate"), function (idx, agg) {
        myChildren[rmm_BaseUri(agg.getAttributeNS(NS_RDF, "resource"))] = true;
    });

    // ---- Diagrammes a prefixer, enfants de ce proprietaire et pas encore prefixes
    let myChanged = false;
    g_Diagrams.forEach(function (d) {
        if (d.kind.ownerPrefix === true && myChildren[d.uri] === true && d.owner === undefined) {
            d.owner = owner.label;
            d.ownerLevel = owner.level;
            d.name = owner.label + OWNER_SEPARATOR + d.label;
            myChanged = true;
        }
    });

    // ---- Le nouveau nom change l'ordre du tableau
    if (myChanged) {
        gui_RenderDiagrams();
    }
}

/**
* Masque les copies heritees : pour chaque nom de diagramme, seul le diagramme dont le
* proprietaire a le niveau le plus haut (plus petit numero) reste affiche. Un diagramme
* dont le proprietaire n'a pas ete trouve n'est jamais masque.
*/
function gui_HideInheritedDiagrams() {
    // ---- Niveau le plus haut trouve pour chaque nom de diagramme
    let myBestLevel = {};
    g_Diagrams.forEach(function (d) {
        if (d.ownerLevel !== undefined && (myBestLevel[d.label] === undefined || d.ownerLevel < myBestLevel[d.label])) {
            myBestLevel[d.label] = d.ownerLevel;
        }
    });

    // ---- Diagrammes d'un niveau plus bas que l'original : retires du tableau
    g_Diagrams.forEach(function (d) {
        if (d.ownerLevel !== undefined && !d.hidden && d.ownerLevel > myBestLevel[d.label]) {
            mgt_Console("Inherited diagram hidden : '" + d.name + "'", CONSOLE_INFO);
            d.hidden = true;
        }
    });

    // ---- Le nombre de diagrammes affiches a change
    gui_RenderDiagrams();
    gui_UpdateViewCounts();
}

/**
* Date de modification du reporting en heure locale, format AAAA-MM-JJ HH:MM.
* Le reporting donne l'heure en temps universel sans le dire : "2026/10/15 8:15:58"
* correspond a dcterms:modified 2026-10-15T08:15:58Z (verifie le 30/10/2026).
* @param {String} raw - valeur du champ modified du reporting
* @returns {String} date affichee ; valeur d'origine si le format n'est pas reconnu
*/
function rmm_FormatModified(raw) {
    const myRaw = String(raw || "").trim();
    const m = myRaw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
    if (!m) {
        return myRaw;
    }
    const myDate = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)));
    const pad = function (n) { return String(n).padStart(2, "0"); };
    return myDate.getFullYear() + "-" + pad(myDate.getMonth() + 1) + "-" + pad(myDate.getDate()) + " " +
        pad(myDate.getHours()) + ":" + pad(myDate.getMinutes());
}

/**
* Niveau d'analyse d'une cle d'onglet
* @param {String} key - "A", "B", "C" ou "D"
* @returns {Object} entree de DIAGRAM_LEVELS, undefined pour l'onglet All ou une cle inconnue
*/
function gui_LevelOf(key) {
    return DIAGRAM_LEVELS.filter(function (l) { return l.key === key; })[0];
}

/**
* Affiche un onglet et memorise le choix
* @param {String} tab - "ALL", "A", "B", "C" ou "D" (valeur inconnue : "ALL")
*/
function gui_ShowTab(tab) {
    if (tab !== TAB_ALL && gui_LevelOf(tab) === undefined) {
        tab = TAB_ALL;
    }
    g_Tab = tab;
    $("#gui_levelTabs button").each(function () {
        const isActive = $(this).attr("data-tab") === tab;
        $(this).toggleClass("active", isActive).attr("aria-pressed", isActive ? "true" : "false");
    });
    widget_SaveChoice("tab", tab);
    gui_RenderDiagrams();
}

/**
* Vrai si le texte contient le filtre, sans tenir compte des majuscules (filtre vide : vrai)
* @param {String} text - texte de la colonne
* @param {String} filter - texte saisi dans le filtre
* @returns {Boolean}
*/
function gui_Contains(text, filter) {
    const myFilter = String(filter || "").trim().toLowerCase();
    return myFilter === "" || String(text || "").toLowerCase().indexOf(myFilter) >= 0;
}

/**
* Vrai si le diagramme passe les filtres des quatre colonnes
* @param {Object} d - enregistrement de g_Diagrams
* @returns {Boolean}
*/
function gui_DiagramPasses(d) {
    return gui_Contains(d.kind.label, g_Filters.type) && gui_Contains(d.name, g_Filters.name) &&
        gui_Contains(d.modified, g_Filters.modified) && gui_Contains(d.modifiedBy, g_Filters.owner);
}

/**
* Ordre du tableau : niveau puis type (ordre de DIAGRAM_TYPE_LIST), puis nom en "natural sort"
*/
function gui_CompareDiagrams(a, b) {
    return (a.kind.order - b.kind.order) || gui_NaturalCompare(a.name, b.name);
}

/**
* Ecrit un texte dans un element en surlignant la premiere occurrence du filtre (<mark>).
* Les textes passent par des noeuds texte : un nom contenant < ou & s'affiche tel quel.
* @param {Object} target - element jQuery a remplir
* @param {String} text - texte a afficher
* @param {String} filter - texte a surligner
*/
function gui_AppendHighlighted(target, text, filter) {
    const myText = String(text);
    const myFilter = String(filter || "").trim();
    const myAt = (myFilter === "") ? -1 : myText.toLowerCase().indexOf(myFilter.toLowerCase());
    if (myAt < 0) {
        target.text(myText);
        return;
    }
    target.append(document.createTextNode(myText.slice(0, myAt)))
        .append($('<mark></mark>').text(myText.slice(myAt, myAt + myFilter.length)))
        .append(document.createTextNode(myText.slice(myAt + myFilter.length)));
}

/**
* Ligne du tableau pour un diagramme : type, nom, date, auteur de la modification, actions
* @param {Object} d - enregistrement de g_Diagrams
* @returns {Object} ligne jQuery
*/
function gui_DiagramRow(d) {
    let myRow = $('<tr class="diagram-row"></tr>').addClass(gui_LevelOf(d.kind.level).css);

    // ---- Type : affiche du type en petit, ou pastille de la couleur du niveau
    let myType = $('<span class="type-cell"></span>');
    if (d.kind.poster) {
        myType.append($('<img class="type-icon" alt="">').attr('src', './resources/' + d.kind.poster));
    } else {
        myType.append('<span class="type-chip" aria-hidden="true"></span>');
    }
    myType.append($('<span class="type-label"></span>').text(d.kind.label));
    myRow.append($('<td class="cell-type"></td>').append(myType));

    // ---- Nom : lien vers le diagramme dans RMM, texte du filtre surligne
    let myLink = $('<a target="_blank" rel="noopener noreferrer"></a>').attr('href', d.link);
    gui_AppendHighlighted(myLink, d.name, g_Filters.name);
    myRow.append($('<td class="cell-name"></td>').append(myLink));

    myRow.append($('<td class="cell-modified"></td>').text(d.modified));
    myRow.append($('<td class="cell-owner"></td>').text(d.modifiedBy));

    // ---- Actions : telechargement de l'image, seulement si le service la fournit
    let myActions = $('<td class="cell-actions"></td>');
    if (d.image) {
        myActions.append($('<a download target="_blank"><i class="fa-solid fa-download"></i></a>')
            .attr('href', d.image).attr('title', 'Download the image').attr('aria-label', 'Download the image of ' + d.name));
    }
    myRow.append(myActions);
    return myRow;
}

/**
* Ligne de message du tableau (Select configuration, chargement, erreur, aucun resultat)
* @param {String} text - message ; null pour l'image de chargement
* @returns {Object} ligne jQuery
*/
function gui_StateRow(text) {
    let myCell = $('<td colspan="5"></td>');
    if (text === null) {
        myCell.html(LOADING_IMG);
    } else {
        myCell.text(text);
    }
    return $('<tr class="state-row"></tr>').append(myCell);
}

/**
* Affiche les compteurs des onglets et le tableau de l'onglet courant, a partir de
* g_Diagrams et des filtres des colonnes
*/
function gui_RenderDiagrams() {
    let myBody = $("#diagram_rows");
    myBody.empty();
    $("#gui_emptyTypes").prop("hidden", true).text("");

    // ---- Panneau aux couleurs de l'onglet courant
    const myLevel = gui_LevelOf(g_Tab);
    $("#gui_diagramPanel").removeClass("all operational functional logical technical")
        .addClass(myLevel ? myLevel.css : "all");

    // ---- Rien de charge : une ligne de message, onglets sans compteur
    if (g_DiagramState !== "loaded") {
        $(".tab-count, .tab-detail").text("");
        myBody.append(gui_StateRow(g_DiagramState === "loading" ? null :
            (g_DiagramState === "failed" ? "Error retrieving data" : "Select configuration")));
        return;
    }

    // ---- Diagrammes affichables (copies heritees retirees), puis ceux qui passent les filtres
    const myVisible = g_Diagrams.filter(function (d) { return !d.hidden; }).sort(gui_CompareDiagrams);
    const myPassing = myVisible.filter(gui_DiagramPasses);

    // ---- Onglets : nombre de diagrammes filtres, nombre de types qui ont des diagrammes
    [TAB_ALL].concat(DIAGRAM_LEVELS.map(function (l) { return l.key; })).forEach(function (tab) {
        const myTypes = DIAGRAM_TYPE_LIST.filter(function (k) { return tab === TAB_ALL || k.level === tab; });
        const myFilled = myTypes.filter(function (k) {
            return myVisible.some(function (d) { return d.kind === k; });
        }).length;
        const myCount = myPassing.filter(function (d) { return tab === TAB_ALL || d.kind.level === tab; }).length;
        $("#gui_tab_count_" + tab).text(myCount);
        $("#gui_tab_detail_" + tab).text(myFilled + " of " + myTypes.length + " types with diagrams");
    });

    // ---- Lignes de l'onglet courant
    const inTab = function (d) { return g_Tab === TAB_ALL || d.kind.level === g_Tab; };
    const myRows = myPassing.filter(inTab);
    myRows.forEach(function (d) {
        myBody.append(gui_DiagramRow(d));
    });
    if (myRows.length === 0) {
        myBody.append(gui_StateRow(myVisible.some(inTab) ? "No diagram matches the filters" :
            (g_Tab === TAB_ALL ? "No diagram in this configuration" : "No diagram at this level")));
    }

    // ---- Types de l'onglet courant sans aucun diagramme
    const myEmpty = DIAGRAM_TYPE_LIST.filter(function (k) {
        return (g_Tab === TAB_ALL || k.level === g_Tab) && !myVisible.some(function (d) { return d.kind === k; });
    }).map(function (k) { return k.label; });
    if (myEmpty.length > 0) {
        $("#gui_emptyTypes").text("No diagram yet: " + myEmpty.join(", ")).prop("hidden", false);
    }
}

/**
* Comparaison "natural sort", identique a celle de sortlist
* @param {String} a - premier texte
* @param {String} b - second texte
* @returns {Number} resultat de localeCompare
*/
function gui_NaturalCompare(a, b) {
    return String(a).localeCompare(String(b), navigator.languages[0] || navigator.language,
        { numeric: true, ignorePunctuation: true });
}

/**
* Remplit les vues Tables et Matrices
* @param {Array} items - liste de {kind, type, label, link, image} construite dans gui_BuildObjectList
*/
function gui_BuildViewLists(items) {
    gui_FillViewList($("#table_list"), items.filter(function (i) { return i.kind === "table"; }),
        "No table in this configuration");
    gui_FillViewList($("#matrix_list"), items.filter(function (i) { return i.kind === "matrix"; }),
        "No matrix in this configuration");
    gui_UpdateViewCounts();
}

/**
* Remplit une liste de vue : un groupe par type (nom du New Term), elements tries par nom.
* Les textes passent par .text() : un nom contenant < ou & s'affiche tel quel.
* @param {Object} list - liste jQuery a remplir
* @param {Array} items - elements a afficher
* @param {String} emptyText - message si la liste est vide
*/
function gui_FillViewList(list, items, emptyText) {
    list.empty();
    if (items.length === 0) {
        list.append($('<li class="view-empty"></li>').text(emptyText));
        return;
    }

    // ---- Regroupement par type
    let myGroups = {};
    items.forEach(function (item) {
        (myGroups[item.type] = myGroups[item.type] || []).push(item);
    });

    Object.keys(myGroups).sort(gui_NaturalCompare).forEach(function (type) {
        let mySubList = $('<ul class="view-items"></ul>');
        myGroups[type].sort(function (a, b) { return gui_NaturalCompare(a.label, b.label); }).forEach(function (item) {
            let myItem = $('<li></li>');
            myItem.append($('<a target="_blank" rel="noopener noreferrer"></a>').attr('href', item.link).text(item.label));
            // ---- Bouton de telechargement seulement si le service fournit une image
            if (item.image) {
                myItem.append(' ').append(
                    $('<a download target="_blank"><i class="fa-solid fa-download"></i></a>').attr('href', item.image));
            }
            mySubList.append(myItem);
        });
        list.append($('<li class="view-group"></li>')
            .append($('<p class="view-type"></p>').text(type + " (" + myGroups[type].length + ")"))
            .append(mySubList));
    });
}

/**
* Met a jour les compteurs de la bascule de vues (nombre d'elements affiches dans chaque vue)
*/
function gui_UpdateViewCounts() {
    // ---- Diagrammes affiches (copies heritees retirees) ; vide tant que rien n'est charge
    $("#gui_count_diagrams").text(g_DiagramState === "loaded" ?
        g_Diagrams.filter(function (d) { return !d.hidden; }).length : "");
    $("#gui_count_tables").text($("#table_list ul.view-items > li").length);
    $("#gui_count_matrices").text($("#matrix_list ul.view-items > li").length);
}

/**
* Affiche une des trois vues et memorise le choix
* @param {String} view - "diagrams", "tables" ou "matrices" (valeur inconnue : "diagrams")
*/
function gui_ShowView(view) {
    if (VIEW_NAMES.indexOf(view) < 0) {
        view = "diagrams";
    }
    $("#diagrams_view").prop("hidden", view !== "diagrams");
    $("#tables_view").prop("hidden", view !== "tables");
    $("#matrices_view").prop("hidden", view !== "matrices");
    $("#gui_viewSwitch button").each(function () {
        const isActive = $(this).attr("data-view") === view;
        $(this).toggleClass("active", isActive).attr("aria-pressed", isActive ? "true" : "false");
    });
    widget_SaveChoice("view", view);
}

/**
* Lit les choix memorises pour le projet AM courant
* @returns {Object} choix memorises ({} si aucun ou si le stockage du navigateur est bloque)
*/
function widget_LoadChoices() {
    try {
        const myRaw = window.localStorage.getItem(STORAGE_PREFIX + AM_PROJECT_ID);
        const myChoices = myRaw ? JSON.parse(myRaw) : {};
        return (myChoices && typeof myChoices === "object") ? myChoices : {};
    } catch (e) {
        return {};                              // ---- Stockage bloque ou valeur illisible : aucun choix
    }
}

/**
* Memorise un choix pour le projet AM courant
* @param {String} key - nom du choix (gcLink, gcBaselineLink, amStreamId, component, view, tab)
* @param {*} value - valeur ; null ou undefined efface le choix
*/
function widget_SaveChoice(key, value) {
    try {
        let myChoices = widget_LoadChoices();
        if (value === null || value === undefined) {
            delete myChoices[key];
        } else {
            myChoices[key] = value;
        }
        window.localStorage.setItem(STORAGE_PREFIX + AM_PROJECT_ID, JSON.stringify(myChoices));
    } catch (e) {
        // ---- Stockage indisponible : le widget fonctionne, sans memoire des choix
    }
}


/* ------------------------------------------------------------------------------
   ---- Core Fonctions
   --------------------------------------------------------------------------- */
/**
 * Open an application window in a tab browser (initiate an authentication challenge)
 * @param {String} reqURL : request URL
 */

function open_winappl(reqURL) {
	const regexp = /(https:\/\/[^\/]+)\/([^\/]+)(?:\/|$)/gm; // ---- Group 1 = hostname | Group 2 = application name

	const WIN_TARGET = '_blank';
	const WIN_FEATURES = "popup,width=100,height=100";
	const WIN_CLOSEDELAY = 5000;

	const JTS_URL = '/dashboards/all';
	const CCM_URL = '/web#action=jazz.viewPage&id=com.ibm.team.process.projectAreaList';
	const GC_URL = '/web';
	const RM_URl = '/web';
	const QM_URL = '/web#action=jazz.viewPage&id=com.ibm.team.process.projectAreaList';
	const AM_URL = '';

	let myReqHost;
	let myReqAppl;
	let myMatch = [];

	let myWindow;
	let myWinURL;

	// ---- In the request URL, get the hostname and application name

	myMatch = regexp.exec(reqURL);

	if (myMatch !== null) {
		myReqHost = myMatch[1];
		myReqAppl = myMatch[2];
	}

	myWinURL = myReqHost + '/' + myReqAppl;

	// ---- Open application base window

	switch (myReqAppl.toLowerCase()) {
		case 'jts':
			myWinURL += JTS_URL;
			break;

		case 'ccm':
			myWinURL += CCM_URL;
			break;

		case 'gc':
			myWinURL += GC_URL;
			break;

		case 'rm':
			myWinURL += RM_URl;
			break;

		case 'qm':
			myWinURL += QM_URL;
			break;

		case 'am':
			myWinURL += AM_URL;
			break;

		default:
			mgt_Console("Open Window - Application '" + myReqAppl + "' unknown !", CONSOLE_ERROR);

			return undefined;
	}

	// ---- Open URL in a new browser tab

	mgt_Console("Open Window : '" + myWinURL + "'", CONSOLE_INFO);

	myWindow = window.open(myWinURL, WIN_TARGET, WIN_FEATURES);

	// ---- Close the window after a delay

	setTimeout(() => {
		myWindow.close();
	},
		WIN_CLOSEDELAY
	);

	myWindow.blur();
	window.focus();
}
/**
* Requete AJAX - Asynchrone - With parameters
* @param {Object} rest_request - Requete REST (REST URL de la requete AJAX et messages associés)
* @param {*} success_func - Fonction a appeler sur la requete est un succes
* @param {*} failed_func - Fonction a appeler sur la requete est un echec
* @param {*} callback_parm - Parametre a transmettre aux callback fonctions
*/

/**
 * Requete AJAX - Asynchrone
 * @param {Object} rest_request - Requete REST (REST URL de la requete AJAX et messages associés)
 * @param {Function} success_func - Fonction a appeler sur la requete est un succes
 * @param {Function} failed_func - Fonction a appeler sur la requete est un echec
 * @param {Function} always_func - Fonction a appeler quel que soit l'état de la requête
 */

function ajax_async_request(rest_request, success_func, failed_func, always_func) {
	const APPL_LAUNCHDELAY = 6000;

	return $.ajax({
		url: rest_request.rest_url,
		method: ((rest_request.method === undefined) ? "GET" : rest_request.method),
		dataType: "text",
		headers: ((rest_request.headers === undefined) ?
			{
				"OSLC-Core-Version": "2.0",
				"Accept": "xml+rdf"
			} : rest_request.headers),
		xhrFields: {
			"withCredentials": true
		},
		crossdomain: true,
		async: ((rest_request.async === undefined) ? true : rest_request.async)
	}) // ---- Request successfull
		.done(function (data, textStatus, jqXHR) {
			mgt_Console("AJAX-GET call is successfull for '" + rest_request.rest_url + "' !");

			if (success_func) {
				success_func(data);
			}
		}) // ---- Request failed
		.fail(function (jqXHR, textStatus, errorThrown) {
			mgt_Console("AJAX-GET call failed for '" + rest_request.rest_url + "' with '" + textStatus + "' !", CONSOLE_ERROR);

			if (jqXHR.status === 401) { // ---- 401 : need an authentication challenge
				console.log("### ERROR : Authentication challenge needed with code '" + jqXHR.status + "' !");

				// ---- Open application window

				open_winappl(rest_request.rest_url);

				// ---- After a time out, relaunch te request

				setTimeout(() => { // ---- Waiting for opened windows run authentication challenge
					ajax_async_request(rest_request, success_func, failed_func, always_func);
				},
					APPL_LAUNCHDELAY
				);
			} else if (failed_func) {
				failed_func(jqXHR.status, rest_request);
			}
		}) // ---- Other
		.always(function (dataOrjqXHR, textStatus, jqXHRorErrorThrown) {
			mgt_Console("textStatus = '" + textStatus + "'");

			if (always_func && textStatus === "success") {
				always_func(jqXHRorErrorThrown.status);
			} else if (always_func && textStatus !== "success") {
				always_func(dataOrjqXHR.status);
			}
		});
}