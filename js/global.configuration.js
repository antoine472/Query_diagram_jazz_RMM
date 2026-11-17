/*******************************************************************************/
/*                    (C) Copyright 2019 by Safran Aircraft Engines            */
/*                             All rights reserved                             */
/*******************************************************************************/
/*
+-------------------------------------------------------------------------------+
| Revision |    Date    |     Author     |                Issue                 |
+-------------------------------------------------------------------------------+
|     1    | 15/04/2022 |   Safran - LO  | Initial version                      |
|     2    | 28/10/2026 |   Safran - AP  | RMM filter, baselines, memory, auto  |
+-------------------------------------------------------------------------------+
*/

const GUI_ICON_GCSTREAM = "./resources/gc_stream_icon.png";
const GUI_ICON_GCBASELINE = "./resources/gc_baseline_icon.png";
const GUI_ICON_GCSTAGE = "./resources/gc_stage_icon.png";

var GC_PROJECT_ID = null;
var GC_STREAM_LIST = null;

var GC_AM_STREAMS_ID = null;
var SELECTED_GC_STREAM_LINK = null;

var GC_STREAMS_ID = [];

// Global map to store stream ID -> stream name
var AM_STREAMS_MAP = {};

// ---- Espaces de noms RDF lus dans les reponses GC (NS_RDF est defini dans safran-controller.js)
const NS_DCTERMS = "http://purl.org/dc/terms/";
const NS_OSLC = "http://open-services.net/ns/core#";
const GC_MAX_PAGES = 50;                    // ---- Garde-fou : nombre maximal de pages OSLC lues

var SELECTED_GC_CONTEXT = null;             // ---- Contexte des requetes de reporting (stream GC choisi)
var SELECTED_AM_STREAM_ID = null;           // ---- AM stream choisi (pour ignorer les reponses perimees)
var g_AmStreamsReady = $.Deferred();        // ---- Resolu quand AM_STREAMS_MAP est rempli
var g_Restoring = false;                    // ---- Vrai pendant la restauration des choix memorises

// ---- Arbre GC : un stream GC contient des contributions (streams DNG, RMM, sous-GC...).
// ---- Mesures sur le serveur (28/10/2026) : la requete des streams accepte
// ---- oslc.select=...,oslc_config:contribution{oslc_config:configuration} et renvoie en une fois
// ---- tous les streams avec leurs contributions ; une contribution RMM a la forme
// ---- .../am/rtcoslc/scm/config/s/<id du stream RMM>, une sous-GC .../gc/configuration/<n>.
const NS_OSLC_CONFIG = "http://open-services.net/ns/config#";
const GC_MAX_DEPTH = 10;                    // ---- Profondeur maximale de l'arbre GC parcouru
const GC_REQUEST_TIMEOUT = 30000;           // ---- ms, lecture d'une sous-GC hors du projet
const GC_BASELINE_TYPE = "<http://open-services.net/ns/config#Baseline>";
const GC_NO_BASELINE_LABEL = "Stream (no baseline)";

var g_GcIndex = {};                         // ---- adresse GC -> liste des adresses de ses contributions
var g_GcFetch = {};                         // ---- lectures en cours des sous-GC absentes de l'index


/**
 * This function is called by the widget main function after retrieving the AM project ID from the widget preferences.
 * It allows to get the GC project ID linked to the AM project (defined in the AM project area / associations).
 * 
 * The request is build such as: 
 * <code>
 * https://agsdm-2.snm.snecma:9443/am/process/project-areas/_fCwTsLz7Ee2yIdED_I8iYg/links
 * </code>
 * 
 * The response is an XML.
 */
function getGlobalConfigurationProjects() {
    console.debug("[getGlobalConfigurationProjects] Get GC project ID from AM project ID : " + AM_PROJECT_ID);

    let gcProjectList = AM_HOSTNAME + "/am/process/project-areas/" + AM_PROJECT_ID + "/links";

    let myRequest = {
        'rest_method': "GET",
        'rest_url': gcProjectList,
        'rest_success': IS_SUCCESS,
        'rest_failed': IS_FAILED
    }

    ajax_async_request(myRequest, getGlobalConfigurationProjectID, gui_FailObjectList, null);
}

/**
 * This function is called after the REST response of the getGlobalConfigurationProjects function.
 * It allows to parse the XML response and extract the GC project ID.
 * 
 * This function supports only ONE global configuration project.
 * @param {*} data - REST response containing the GC project links
 */
function getGlobalConfigurationProjectID(data) {

    var xmlData = $.parseXML(data);
    var $xml = $(xmlData);

    // Look for jp:link elements
    $xml.find("jp\\:link").each(function () {
        var $link = $(this);

        // Check the link type
        var linkType = $.trim($link.find("jp\\:link-type").text());
        if (linkType === "configuration-contributes-to") {

            // Inside this jp:link, get the oslc:ServiceProvider details URL
            var detailsLink = $link
                .find("oslc\\:ServiceProvider")
                .find("oslc\\:details")
                .attr("rdf:resource");

            if (detailsLink) {
                // Extract the ID at the end of the URL
                GC_PROJECT_ID = detailsLink.substring(detailsLink.lastIndexOf("/") + 1);
            }

            // Stop after the first matching link
            return false;
        }
    });


    console.debug("[getGlobalConfigurationProjectID] GC Project ID = " + GC_PROJECT_ID);

    if (GC_PROJECT_ID == null || GC_PROJECT_ID == "") {
        alert("No Global Configuration project linked to this AM project. Please link a GC project in the AM project area / associations.");
        return;
    }

    // ---- Les noms des AM streams sont charges une fois, avant tout choix de GC : avant, cette
    // ---- requete partait en meme temps que la lecture du stream GC et la liste AM Stream
    // ---- pouvait rester vide si la reponse arrivait en second.
    getArchitectureManagementStreams();

    getGlobalConfigurationStreams();

}

/**
 * This function is called after retrieving the GC project ID.
 * It allows to get the list of streams of the GC project and display them in the GUI.
 */
function getGlobalConfigurationStreams() {

    let gcStreamList = AM_PROJECT_GC + "/gc/oslc-query/configurations/" + GC_PROJECT_ID + "?oslc.where=rdf:type=%3Chttp://open-services.net/ns/config%23Stream%3E%20and%20rdf:type!=%3Chttp://jazz.net/ns/config_ext%23PersonalStream%3E&oslc.select=dcterms:title,dcterms:identifier,oslc_config:contribution%7Boslc_config:configuration%7D&oslc.paging=true";

    console.debug("[getGlobalConfigurationStreams] GC stream list URL : " + gcStreamList);

    // ---- Message d'attente pendant la lecture et le filtrage des streams GC
    $("#gui_gcconfigBtnContent").empty().append(gui_DropdownInfo("Loading..."));

    gc_ReadStreamPage(gcStreamList, [], 1);
}

/**
 * Lit une page de la requete GC, puis la page suivante (oslc:nextPage) jusqu'a la derniere.
 * Avant, seule la premiere page etait lue : des streams pouvaient manquer.
 * @param {String} pageUrl - URL de la page a lire
 * @param {Array} streams - streams deja lus, completes page apres page
 * @param {Number} pageNumber - numero de la page (garde-fou GC_MAX_PAGES)
 */
function gc_ReadStreamPage(pageUrl, streams, pageNumber) {
    let myRequest = {
        'rest_method': "GET",
        'rest_url': pageUrl,
        'rest_success': IS_SUCCESS,
        'rest_failed': IS_FAILED
    }

    ajax_async_request(myRequest, function (data) {
        const myNextPage = gc_ParseStreamPage(data, streams);
        if (myNextPage && pageNumber < GC_MAX_PAGES) {
            gc_ReadStreamPage(myNextPage, streams, pageNumber + 1);
        } else {
            gc_FilterRmmStreams(streams);
        }
    }, gui_FailObjectList, null);
}

/**
 * Extrait les streams d'une page de reponse GC.
 * Le bloc d'en-tete oslc:ResponseInfo n'a ni identifiant ni titre : il est ignore. C'est lui
 * qui apparaissait comme une valeur vide en tete de la liste "GC Configuration".
 * @param {String} data - reponse RDF/XML de la requete GC
 * @param {Array} streams - liste completee avec {streamTitle, streamLink, streamID}
 * @returns {String|null} URL de la page suivante, ou null pour la derniere page
 */
function gc_ParseStreamPage(data, streams) {
    const myDoc = $.parseXML(data);
    const myParts = gc_PartMap(myDoc);

    $.each(myDoc.getElementsByTagNameNS(NS_RDF, "Description"), function (idx, desc) {
        const myTitle = gc_ChildText(desc, NS_DCTERMS, "title");
        const myId = gc_ChildText(desc, NS_DCTERMS, "identifier");
        if (myTitle !== "" && myId !== "") {
            streams.push({
                streamTitle: myTitle,
                streamLink: desc.getAttributeNS(NS_RDF, "about"),
                streamID: myId,
                contributions: gc_Contributions(desc, myParts)
            });
        }
    });

    const myNext = myDoc.getElementsByTagNameNS(NS_OSLC, "nextPage")[0];
    return myNext ? myNext.getAttributeNS(NS_RDF, "resource") : null;
}

/**
 * Table "contribution -> configurations" d'une reponse RDF. Une contribution est decrite a part
 * (adresse .../gc/part/<n> ou noeud anonyme rdf:nodeID) avec sa propriete oslc_config:configuration.
 * @param {Document} doc - reponse RDF/XML
 * @returns {Object} cle = adresse ou "_:"+nodeID, valeur = adresses des configurations
 */
function gc_PartMap(doc) {
    let myParts = {};
    $.each(doc.getElementsByTagNameNS(NS_RDF, "Description"), function (idx, desc) {
        const myConfigs = gc_ChildResources(desc, NS_OSLC_CONFIG, "configuration");
        if (myConfigs.length > 0) {
            const myKey = desc.getAttributeNS(NS_RDF, "about") || ("_:" + desc.getAttributeNS(NS_RDF, "nodeID"));
            myParts[myKey] = myConfigs;
        }
    });
    return myParts;
}

/**
 * Adresses des configurations contribuant a une configuration GC. Les trois ecritures RDF/XML
 * possibles sont lues : contribution par adresse, par rdf:nodeID, ou decrite sur place.
 * @param {Element} desc - rdf:Description de la configuration GC
 * @param {Object} parts - table construite par gc_PartMap
 * @returns {Array} adresses des configurations contributrices
 */
function gc_Contributions(desc, parts) {
    let myUrls = [];
    for (let i = 0; i < desc.children.length; i++) {
        const myChild = desc.children[i];
        if (myChild.namespaceURI !== NS_OSLC_CONFIG || myChild.localName !== "contribution") {
            continue;
        }
        const myRef = myChild.getAttributeNS(NS_RDF, "resource");
        const myNode = myChild.getAttributeNS(NS_RDF, "nodeID");
        if (myRef) {
            myUrls = myUrls.concat(parts[myRef] || []);
        } else if (myNode) {
            myUrls = myUrls.concat(parts["_:" + myNode] || []);
        } else {
            // ---- Contribution decrite sur place : <oslc_config:contribution><rdf:Description>...
            $.each(myChild.getElementsByTagNameNS(NS_OSLC_CONFIG, "configuration"), function (idx, conf) {
                myUrls.push(conf.getAttributeNS(NS_RDF, "resource"));
            });
        }
    }
    return myUrls;
}

/**
 * Valeurs rdf:resource des enfants directs d'un noeud RDF
 * @param {Element} node - noeud parent
 * @param {String} ns - espace de noms de l'enfant
 * @param {String} localName - nom local de l'enfant
 * @returns {Array} adresses trouvees
 */
function gc_ChildResources(node, ns, localName) {
    let myUrls = [];
    for (let i = 0; i < node.children.length; i++) {
        if (node.children[i].namespaceURI === ns && node.children[i].localName === localName) {
            myUrls.push(node.children[i].getAttributeNS(NS_RDF, "resource"));
        }
    }
    return myUrls;
}

/**
 * Contributions d'une configuration GC : depuis l'index (streams du projet GC), sinon par une
 * lecture de son RDF (sous-GC d'un autre projet). Un echec donne une liste vide.
 * @param {String} gcLink - adresse de la configuration GC
 * @returns {Promise} liste des adresses des contributions
 */
function gc_ContributionsOf(gcLink) {
    if (g_GcIndex[gcLink] !== undefined) {
        return Promise.resolve(g_GcIndex[gcLink]);
    }
    if (g_GcFetch[gcLink] === undefined) {
        g_GcFetch[gcLink] = Promise.resolve($.ajax({
            url: gcLink,
            method: "GET",
            dataType: "text",
            headers: { "OSLC-Core-Version": "2.0", "Accept": "application/rdf+xml" },
            xhrFields: { "withCredentials": true },
            timeout: GC_REQUEST_TIMEOUT
        })).then(function (data) {
            const myDoc = $.parseXML(data);
            const myParts = gc_PartMap(myDoc);
            let myUrls = [];
            $.each(myDoc.getElementsByTagNameNS(NS_RDF, "Description"), function (idx, desc) {
                if (desc.getAttributeNS(NS_RDF, "about") === gcLink) {
                    myUrls = gc_Contributions(desc, myParts);
                }
            });
            g_GcIndex[gcLink] = myUrls;
            return myUrls;
        }, function () {
            mgt_Console("GC configuration not readable : '" + gcLink + "'", CONSOLE_WARNING);
            return [];
        });
    }
    return g_GcFetch[gcLink];
}

/**
 * AM streams de ce projet contenus dans une configuration GC, directement ou dans ses sous-GC.
 * Seuls les streams connus de AM_STREAMS_MAP (streams RMM du projet AM du widget) sont gardes.
 * @param {String} gcLink - adresse de la configuration GC
 * @param {Array} path - configurations deja traversees (protection contre les boucles)
 * @returns {Promise} liste sans doublon des identifiants d'AM streams
 */
function gc_AmStreamIdsOf(gcLink, path) {
    if (path.indexOf(gcLink) >= 0 || path.length > GC_MAX_DEPTH) {
        return Promise.resolve([]);
    }
    return gc_ContributionsOf(gcLink).then(function (urls) {
        // ---- Contributions RMM directes : identifiant = dernier segment de l'adresse
        let myIds = urls.filter(url => url && url.indexOf("/am/") >= 0)
            .map(url => url.substring(url.lastIndexOf("/") + 1))
            .filter(id => AM_STREAMS_MAP[id] !== undefined);
        // ---- Sous-GC : parcours recursif
        const mySubs = urls.filter(url => url && url.indexOf("/gc/configuration/") >= 0);
        return Promise.all(mySubs.map(sub => gc_AmStreamIdsOf(sub, path.concat([gcLink])))).then(function (lists) {
            lists.forEach(list => { myIds = myIds.concat(list); });
            return myIds.filter((id, idx) => myIds.indexOf(id) === idx);
        });
    });
}

/**
 * Ne garde que les streams GC qui contiennent au moins un stream RMM de ce projet AM.
 * Si aucune contribution n'a pu etre lue (reponse au format inattendu), la liste complete est
 * affichee plutot qu'une liste vide.
 * @param {Array} streams - streams lus par gc_ReadStreamPage
 */
function gc_FilterRmmStreams(streams) {
    streams.forEach(stream => { g_GcIndex[stream.streamLink] = stream.contributions; });

    const myContributionCount = streams.reduce((sum, stream) => sum + stream.contributions.length, 0);
    if (myContributionCount === 0) {
        mgt_Console("GC contributions not found in the query response : list not filtered", CONSOLE_WARNING);
        gui_BuildGlobalConfigurationStreamsBtn(streams);
        return;
    }

    g_AmStreamsReady.done(function () {
        Promise.all(streams.map(stream => gc_AmStreamIdsOf(stream.streamLink, []))).then(function (lists) {
            const myRmmStreams = streams.filter((stream, idx) => lists[idx].length > 0);
            mgt_Console("GC configurations with RMM : " + myRmmStreams.length + " / " + streams.length, CONSOLE_INFO);
            gui_BuildGlobalConfigurationStreamsBtn(myRmmStreams);
        });
    });
}

/**
 * Charge les baselines du stream GC choisi et remplit la liste "GC Baseline".
 * Premiere entree : le stream lui-meme. Baselines triees de la plus recente a la plus ancienne.
 * Ne rejette jamais : en cas d'echec, la liste propose seulement le stream.
 * @param {String} streamLink - adresse du stream GC
 * @returns {Promise} resolue quand la liste est prete
 */
function gc_LoadBaselines(streamLink) {
    const myUrl = AM_PROJECT_GC + "/gc/oslc-query/configurations/" + GC_PROJECT_ID
        + "?oslc.where=" + encodeURIComponent("rdf:type=" + GC_BASELINE_TYPE + " and oslc_config:baselineOfStream=<" + streamLink + ">")
        + "&oslc.select=" + encodeURIComponent("dcterms:title,dcterms:created")
        + "&oslc.paging=true";

    return gc_ReadBaselinePages(myUrl, [], 1).then(function (baselines) {
        if (streamLink === SELECTED_GC_STREAM_LINK) {
            gui_BuildBaselineBtn(streamLink, baselines, true);
        }
    }, function () {
        mgt_Console("GC baselines not readable for '" + streamLink + "'", CONSOLE_WARNING);
        if (streamLink === SELECTED_GC_STREAM_LINK) {
            gui_BuildBaselineBtn(streamLink, [], false);
        }
    });
}

/**
 * Lit les pages de la requete des baselines
 * @param {String} pageUrl - page a lire
 * @param {Array} baselines - baselines deja lues {title, link, created}
 * @param {Number} pageNumber - numero de page (garde-fou GC_MAX_PAGES)
 * @returns {Promise} liste complete des baselines
 */
function gc_ReadBaselinePages(pageUrl, baselines, pageNumber) {
    return Promise.resolve($.ajax({
        url: pageUrl,
        method: "GET",
        dataType: "text",
        headers: { "OSLC-Core-Version": "2.0", "Accept": "application/rdf+xml" },
        xhrFields: { "withCredentials": true },
        timeout: GC_REQUEST_TIMEOUT
    })).then(function (data) {
        const myDoc = $.parseXML(data);
        $.each(myDoc.getElementsByTagNameNS(NS_RDF, "Description"), function (idx, desc) {
            const myTitle = gc_ChildText(desc, NS_DCTERMS, "title");
            const myLink = desc.getAttributeNS(NS_RDF, "about");
            if (myTitle !== "" && myLink.indexOf("/gc/configuration/") >= 0) {
                baselines.push({ title: myTitle, link: myLink, created: gc_ChildText(desc, NS_DCTERMS, "created") });
            }
        });
        const myNext = myDoc.getElementsByTagNameNS(NS_OSLC, "nextPage")[0];
        if (myNext && pageNumber < GC_MAX_PAGES) {
            return gc_ReadBaselinePages(myNext.getAttributeNS(NS_RDF, "resource"), baselines, pageNumber + 1);
        }
        return baselines;
    });
}

/**
 * Remplit la liste "GC Baseline" et restaure la baseline memorisee si elle existe toujours
 * @param {String} streamLink - stream GC choisi
 * @param {Array} baselines - baselines du stream
 * @param {Boolean} readable - false si les baselines n'ont pas pu etre lues
 */
function gui_BuildBaselineBtn(streamLink, baselines, readable) {
    $("#gui_gcbaselineBtnContent").empty();

    // ---- Premiere entree : le stream lui-meme (contexte par defaut)
    $("#gui_gcbaselineBtnContent").append(
        gui_DropdownItem(GUI_ICON_GCSTREAM, "GC Stream Icon", GC_NO_BASELINE_LABEL, function () {
            gui_SelectGlobalConfigurationBaseline(null, GC_NO_BASELINE_LABEL);
        }));

    // ---- Baselines, de la plus recente a la plus ancienne (date ISO : tri alphabetique inverse)
    baselines.sort((a, b) => b.created.localeCompare(a.created));
    baselines.forEach(baseline => {
        const myLabel = gc_BaselineLabel(baseline);
        $("#gui_gcbaselineBtnContent").append(
            gui_DropdownItem(GUI_ICON_GCBASELINE, "GC Baseline Icon", myLabel, function () {
                gui_SelectGlobalConfigurationBaseline(baseline.link, myLabel);
            }));
    });

    if (!readable) {
        $("#gui_gcbaselineBtnContent").append(gui_DropdownInfo("Baselines not available"));
    } else if (baselines.length === 0) {
        $("#gui_gcbaselineBtnContent").append(gui_DropdownInfo("No baseline for this stream"));
    }

    // ---- Restauration : la baseline memorisee devient le contexte (les diagrammes ne sont
    // ---- charges qu'apres, par la suite de la chaine de restauration)
    const mySaved = widget_LoadChoices();
    const mySavedBaseline = g_Restoring ? baselines.find(baseline => baseline.link === mySaved.gcBaselineLink) : undefined;
    if (mySavedBaseline) {
        SELECTED_GC_CONTEXT = mySavedBaseline.link;
        $("#gui_gcbaselineBtn").text(gc_BaselineLabel(mySavedBaseline));
    }
}

/**
 * Libelle d'une baseline : titre et date de creation (AAAA-MM-JJ)
 * @param {Object} baseline - {title, link, created}
 * @returns {String} libelle affiche
 */
function gc_BaselineLabel(baseline) {
    return baseline.title + (baseline.created ? " (" + baseline.created.substring(0, 10) + ")" : "");
}

/**
 * Choix d'une baseline (ou du stream lui-meme) : change le contexte des requetes et recharge
 * les diagrammes si un composant est deja choisi. AM Stream et Component restent ceux du stream.
 * @param {String|null} baselineLink - adresse de la baseline, null pour le stream lui-meme
 * @param {String} label - texte affiche sur le bouton
 */
function gui_SelectGlobalConfigurationBaseline(baselineLink, label) {
    $("#gui_gcbaselineBtn").text(label);
    SELECTED_GC_CONTEXT = baselineLink || SELECTED_GC_STREAM_LINK;
    widget_SaveChoice("gcBaselineLink", baselineLink);

    if (AM_COMPONENT_NAME) {
        gui_SetLoadingState();
        buildArchitectureElementsList();
    }
}

/**
 * Texte d'un enfant direct d'un noeud RDF
 * @param {Element} node - noeud parent
 * @param {String} ns - espace de noms de l'enfant
 * @param {String} localName - nom local de l'enfant
 * @returns {String} texte nettoye, "" si absent
 */
function gc_ChildText(node, ns, localName) {
    for (let i = 0; i < node.children.length; i++) {
        if (node.children[i].namespaceURI === ns && node.children[i].localName === localName) {
            return $.trim(node.children[i].textContent);
        }
    }
    return "";
}

/**
 * Element de liste deroulante : icone + texte, clic gere par jQuery.
 * Le texte passe par createTextNode : un nom contenant une apostrophe ou un chevron ne casse
 * plus le code HTML (avant, le nom etait colle dans un attribut onclick).
 * @param {String} icon - chemin de l'icone
 * @param {String} alt - texte alternatif de l'icone
 * @param {String} text - texte affiche
 * @param {Function} onSelect - fonction appelee au clic
 * @returns {Object} element jQuery
 */
function gui_DropdownItem(icon, alt, text, onSelect) {
    return $('<a class="dropdown-item" href="#"></a>')
        .append($('<img>').attr({ src: icon, alt: alt }))
        .append(document.createTextNode(text))
        .on("click", function (event) {
            // ---- preventDefault seulement : "return false" bloquerait aussi la propagation du clic
            // ---- et Bootstrap ne refermerait plus la liste deroulante
            event.preventDefault();
            g_Restoring = false;                // ---- Un clic de l'utilisateur arrete la restauration
            onSelect();
        });
}

/**
 * Element de liste deroulante non cliquable (liste vide)
 * @param {String} text - message affiche
 * @returns {Object} element jQuery
 */
function gui_DropdownInfo(text) {
    return $('<span class="dropdown-item-text text-muted"></span>').text(text);
}

/**
 * Lists all streams available in a project
 * <code>
<rdf:Description rdf:about="https://agsjts-2.snm.snecma:9443/gc/configuration/803">
<dcterms:title rdf:parseType="Literal">26733#RISE_AD-L-TME-MM1</dcterms:title>
<dcterms:identifier>_DA9i1hGKEfGhzrQr33wHPw</dcterms:identifier>
</rdf:Description>
<rdf:Description rdf:about="https://agsjts-2.snm.snecma:9443/gc/configuration/271">
<dcterms:title rdf:parseType="Literal">RISE-AD-L_TME_CESAMES-v1_2023</dcterms:title>
<dcterms:identifier>_eUUNRrzjEe28IsZe0Dtpkg</dcterms:identifier>
</rdf:Description>
</code>
 * @param {String} data - REST response listing all streams in the project 
 */
function gui_BuildGlobalConfigurationStreamsBtn(globalConfigurationStreams) {

    gui_SetInitialState();

    // ---- Empty current list
    $("#gui_gcconfigBtnContent").empty();

    // Sort streams alphabetically by streamTitle
    globalConfigurationStreams.sort((a, b) => a.streamTitle.localeCompare(b.streamTitle));

    globalConfigurationStreams.forEach(stream => {
        console.debug("Stream title : " + stream.streamTitle);
        console.debug("Stream link : " + stream.streamLink);

        $("#gui_gcconfigBtnContent").append(
            gui_DropdownItem(GUI_ICON_GCSTREAM, "GC Stream Icon", stream.streamTitle, function () {
                gui_SelectGlobalConfigurationStream(stream.streamLink, stream.streamTitle);
            }));
    });

    if (globalConfigurationStreams.length === 0) {
        $("#gui_gcconfigBtnContent").append(gui_DropdownInfo("No GC configuration"));
    }

    // ---- Restauration : le stream GC memorise est reselectionne s'il est toujours dans la liste
    const mySaved = widget_LoadChoices();
    const mySavedStream = globalConfigurationStreams.find(stream => stream.streamLink === mySaved.gcLink);
    if (mySavedStream) {
        g_Restoring = true;
        gui_SelectGlobalConfigurationStream(mySavedStream.streamLink, mySavedStream.streamTitle);
    }
}

/**
 * Selection of stream and component
 */
function getArchitectureManagementStreams() {

    let amStreamList;

    amStreamList = AM_HOSTNAME + "/am/service/com.ibm.team.scm.oslc.common.internal.IScmOslcRestService/streams?projectArea=" + AM_PROJECT_ID + "&nameFilter=*";

    let myRequest = {
        'rest_method': "GET",
        'rest_url': amStreamList,
        'rest_success': IS_SUCCESS,
        'rest_failed': IS_FAILED
    }


    ajax_async_request(myRequest, listArchitectureManagementStreams, gui_FailObjectList, null);
}




function listArchitectureManagementStreams(data) {
    let xmlData = $.parseXML(data);

    // Clear previous map
    AM_STREAMS_MAP = {};

    // Find all <values> elements with a <uri> and <name>
    $(xmlData)
        .find('values')
        .each(function () {
            const $val = $(this);
            const name = $val.find('name').text();
            const uri = $val.find('uri').text();

            // Extract stream ID from the URI (after last '/')
            const id = uri.substring(uri.lastIndexOf('/') + 1);

            if (id && name) {
                AM_STREAMS_MAP[id] = name;
            }
        });

    console.debug("AM_STREAMS_MAP:", AM_STREAMS_MAP);

    // ---- Les choix de GC en attente peuvent maintenant lire leurs contributions
    g_AmStreamsReady.resolve();
}

/**
 * This function is called when the user clicks on a GC stream in the list.
 * It allows to display the selected stream name on the button and to save the selected stream link.
 */
function gui_SelectGlobalConfigurationStream(streamLink, streamTitle) {
    $('#gui_gcconfigBtn').text(streamTitle);

    // ---- Stream GC choisi : il sert de contexte aux requetes de reporting
    SELECTED_GC_STREAM_LINK = streamLink;
    SELECTED_GC_CONTEXT = streamLink;
    console.debug("Selected stream link : " + SELECTED_GC_STREAM_LINK);
    widget_SaveChoice("gcLink", streamLink);
    if (!g_Restoring) {
        widget_SaveChoice("gcBaselineLink", null);   // ---- Nouveau choix manuel : on repart du stream
    }

    // ---- Les choix suivants dependent du stream GC : on les remet a zero
    SELECTED_AM_STREAM_ID = null;
    AM_COMPONENT_NAME = null;
    $("#gui_gcbaselineBtn").text(GC_NO_BASELINE_LABEL);
    $("#gui_gcbaselineBtnContent").empty().append(gui_DropdownInfo("Loading..."));
    $("#gui_amStreamBtn").text("Select the AM Stream");
    $("#gui_amStreamBtnContent").empty();
    $("#gui_componentBtn").text("Select the Component");
    $("#gui_componentBtnContent").empty();
    gui_SetInitialState();

    // ---- Baselines d'abord (la baseline memorisee fixe le contexte), puis AM streams une fois
    // ---- leurs noms connus
    const myBaselines = gc_LoadBaselines(streamLink);
    g_AmStreamsReady.done(function () {
        myBaselines.then(function () {
            getArchitectureManagementStreamsInGlobalConfiguration(streamLink);
        });
    });
}

/**
 * This function allows to get the list of ONLY AM streams linked to the selected GC stream.
 * 
 * Expecting a valid GC stream link as input.
 */
function getArchitectureManagementStreamsInGlobalConfiguration(selectedStreamLink) {

    if (selectedStreamLink == null || selectedStreamLink == "") {
        alert("Selected stream link is null or empty. Please select a valid GC stream.");
        return;
    }

    // ---- AM streams du stream GC et de ses sous-GC (avant : contributions directes seulement)
    gc_AmStreamIdsOf(selectedStreamLink, []).then(function (amStreamIds) {
        // ---- Reponse d'un stream GC qui n'est plus le stream choisi : ignoree
        if (selectedStreamLink === SELECTED_GC_STREAM_LINK) {
            fetchArchitectureManagementStreams(amStreamIds);
        }
    });
}


/**
 * Remplit la liste AM Stream
 * @param {Array} amStreamIds - identifiants des AM streams trouves dans l'arbre GC
 */
function fetchArchitectureManagementStreams(amStreamIds) {

    // ---- Empty current component object
    $("#gui_amStreamBtnContent").empty();
    $("#gui_componentBtn").text("Select the Component");

    // Collect all AM streams with their IDs and names
    var amStreams = amStreamIds.map(id => ({ id: id, name: AM_STREAMS_MAP[id] }));

    // Sort streams alphabetically by name
    amStreams.sort((a, b) => a.name.localeCompare(b.name));

    // Render sorted streams
    amStreams.forEach(stream => {
        $("#gui_amStreamBtnContent").append(
            gui_DropdownItem(GUI_ICON_AM_STREAM, "AM Stream Icon", stream.name, function () {
                gui_SelectComponents(stream.id, stream.name);
            }));
    });

    if (amStreams.length === 0) {
        $("#gui_amStreamBtnContent").append(gui_DropdownInfo("No RMM stream in this GC configuration"));
    }

    // ---- Restauration du choix memorise, sinon selection d'office s'il n'y a qu'un seul AM stream
    const mySaved = widget_LoadChoices();
    const mySavedStream = g_Restoring ? amStreams.find(stream => stream.id === mySaved.amStreamId) : undefined;
    if (mySavedStream) {
        gui_SelectComponents(mySavedStream.id, mySavedStream.name);
    } else if (amStreams.length === 1) {
        gui_SelectComponents(amStreams[0].id, amStreams[0].name);
    } else {
        g_Restoring = false;
    }
}

function getArchitectureManagementStreamInformation(streamID) {
    let myRequest = {
        'rest_method': "GET",
        'rest_url': "https://agsdm.snm.snecma:9443/am/stream/" + streamID,
        'rest_success': IS_SUCCESS,
        'rest_failed': IS_FAILED
    }

    ajax_async_request(myRequest, gui_BuildArchitectureManagementStreamsBtn, gui_FailObjectList, null);
}

function gui_BuildArchitectureManagementStreamsBtn(data) {

    let xmlData = $.parseXML(data);

    console.debug("Stream information : " + xmlData);

}

/**
 * Get list of all components of the project
 */
function gui_SelectComponents(streamID, streamName) {

    // ---- Empty current component object
    $("#gui_amStreamBtn").text(streamName);
    $("#gui_componentBtnContent").empty();
    $("#gui_componentBtn").text("Select the Component");

    SELECTED_AM_STREAM_ID = streamID;
    AM_COMPONENT_NAME = null;
    widget_SaveChoice("amStreamId", streamID);

    // https://agsdm-ap.snm.snecma:9443/am/service/com.ibm.team.scm.common.rest.IScmRichClientRestService/SearchComponents2?ownerItemNamespace=com.ibm.team.process&ownerItemType=ProjectArea&ownerItemId=_Mz3bAMOUEeuz-4WnWEzDIw

    //https://agsdm.snm.snecma:9443/am/service/com.ibm.team.scm.common.internal.rest.IScmRestService2/workspace?workspaceItemId=_1PK5YBMDEe2UrMqTdZaFiw
    var lastPart = AM_PROJECT_GC.split("/").pop();
    const REST_AM_COMPONENT_LIST = AM_HOSTNAME + "/am/service/com.ibm.team.scm.common.internal.rest.IScmRestService2/workspace?workspaceItemId=" + streamID;

    console.log(REST_AM_COMPONENT_LIST);

    let myRequest = {
        'rest_method': "GET",
        'rest_url': REST_AM_COMPONENT_LIST,
        'rest_success': IS_SUCCESS,
        'rest_failed': IS_FAILED
    }

    ajax_async_request(myRequest, function (data) {
        // ---- Reponse d'un AM stream qui n'est plus le stream choisi : ignoree
        if (streamID === SELECTED_AM_STREAM_ID) {
            gui_BuildComponentBtn(data);
        }
    }, gui_FailObjectList, null);

}

function gui_BuildComponentBtn(data) {
    let xmlData = $.parseXML(data);

    gui_SetInitialState();

    // ---- Empty current component object
    $("#gui_componentBtnContent").empty();
    $("#gui_componentBtn").text("Select the Component");

    // ---- Decode the content of the REST response



    let componentNames = [];
    $(xmlData).find('components').each(function () {

        const namedata = $(this).children('name').text();
        componentNames.push(namedata);

        $("#gui_componentBtnContent").append(
            gui_DropdownItem(GUI_ICON_AM_COMPONENT, "Component Icon", namedata, function () {
                gui_Component_select(namedata);
            }));
    });

    if (componentNames.length === 0) {
        $("#gui_componentBtnContent").append(gui_DropdownInfo("No component in this AM stream"));
    }

    // ---- Restauration du choix memorise, sinon selection d'office s'il n'y a qu'un seul composant
    const mySaved = widget_LoadChoices();
    if (g_Restoring && componentNames.indexOf(mySaved.component) >= 0) {
        gui_Component_select(mySaved.component);
    } else if (componentNames.length === 1) {
        gui_Component_select(componentNames[0]);
    }
    g_Restoring = false;                        // ---- Fin de la chaine de restauration
}

/**
 * Display the selected GC stream from the list on the button
 */
// function gui_GC_stream_select() {
//     gui_SetLoadingState();
//     let selectedStreamName = this.event.srcElement.text;

//     $('#gui_gcconfigBtn').text(selectedStreamName);

//     // getArchitectureManagementStreams();
// }





function gui_GC_stream_select() {
    gui_SetLoadingState();
    let selectedStreamName = this.event.srcElement.text;
    $('#gui_gcstreamBtn').text(selectedStreamName);
    getComponents(selectedStreamName);
}

/**
 * Display the selected component from the list on the button
 */
function gui_Component_select(selectedComponentName) {
    gui_SetLoadingState();

    $('#gui_componentBtn').text(selectedComponentName);

    AM_COMPONENT_NAME = selectedComponentName;
    widget_SaveChoice("component", selectedComponentName);

    buildArchitectureElementsList();
}

/**
* Création de la requête pour l'envoi des données AM
*/
function buildArchitectureElementsList() {
    console.debug("[buildArchitectureElementsList] Build the REST query to get the architecture elements list with AM_HOSTNAME = " + AM_HOSTNAME + ", AM_PROJECT_ID = " + AM_PROJECT_ID + ", AM_PROJECT_GC = " + AM_PROJECT_GC + " and AM_COMPONENT_NAME = " + AM_COMPONENT_NAME + " GC_STREAMS_ID = " + GC_STREAMS_ID + " SELECTED_GC_STREAM_LINK = " + SELECTED_GC_STREAM_LINK);

    // ---- Contexte de configuration : le stream GC choisi, ou la baseline choisie
    const encodedGCStreamLink = encodeURIComponent(SELECTED_GC_CONTEXT || SELECTED_GC_STREAM_LINK);

    const encodedName = encodeURIComponent(AM_COMPONENT_NAME);

    // https://agsdm.snm.snecma:9443/am/reporting/rhapsody/ArchitectureElement?&projectId=_dOfVkBJpEe2UrMqTdZaFiw&oslc_config.context=https%3A%2F%2Fagsjts.snm.snecma%3A9443%2Fgc%2Fconfiguration%2F34&componentName=BAS%20System%20Model
    REST_AM_GETOBJECTLIST = AM_HOSTNAME + "/am/reporting/rhapsody/ArchitectureElement?&projectId=" + AM_PROJECT_ID + "&oslc_config.context=" + encodedGCStreamLink + "&componentName=" + encodedName;
    const MSG_IS_FAILED = "Get object list has failed !";
    const MSG_IS_SUCCESS = "OK";

    let myRequest = {
        'rest_method': "GET",
        'rest_url': REST_AM_GETOBJECTLIST,
        'rest_success': MSG_IS_SUCCESS,
        'rest_failed': MSG_IS_FAILED
    }

    const myListUrl = REST_AM_GETOBJECTLIST;
    ajax_async_request(myRequest, function (data) {
        // ---- Reponse d'une ancienne selection (choix change pendant le chargement) : ignoree
        if (myListUrl === REST_AM_GETOBJECTLIST) {
            gui_BuildObjectList(data);
        }
    }, gui_FailObjectList, null);


}