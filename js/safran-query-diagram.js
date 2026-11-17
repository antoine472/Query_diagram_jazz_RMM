/*******************************************************************************/
/*                    (C) Copyright 2019 by Safran Aircraft Engines            */
/*                             All rights reserved                             */
/*******************************************************************************/
/*
+-------------------------------------------------------------------------------+
| Revision |    Date    |     Author     |                Issue                 |
+-------------------------------------------------------------------------------+
|     1    | 15/04/2022 |   Safran - LO  | Initial version                      |
+-------------------------------------------------------------------------------+
*/

/* ------------------------------------------------------------------------------
---- Constantes
--------------------------------------------------------------------------- */
// cf. les USER PREF dans le XML
const WIDGET_PREF_AM_HOSTNAME = "JAZZ_AMHOSTNAME";    // comme "https://agsdm-ap.snm.snecma:9443"
const WIDGET_PREF_AM_PROJECT_ID = "JAZZ_AMPROJECTID";   // comme "_Mz3bAMOUEeuz-4WnWEzDIw"
const WIDGET_PREF_GC_HOSTNAME = "JAZZ_GCHOSTNAME";    // comme "https://agsjts-ap.snm.snecma:9443"


/**
* Recuperer les parametres <UserPref> d'un widget Jazz
* @param {String} sUserPrefName - Nom du parametre
*/
function widget_get_UserPref(sUserPrefName) {
    var sValue = '';
    var prefs = new gadgets.Prefs();
    sValue = prefs.getString(sUserPrefName);

    return sValue;
}

/* --------------------------------------------------------------------------
---- Point d'entree du widget
--------------------------------------------------------------------------- */
$().ready(function () {

    // ---- External Parameters
    AM_HOSTNAME = widget_get_UserPref(WIDGET_PREF_AM_HOSTNAME);
    AM_PROJECT_ID = widget_get_UserPref(WIDGET_PREF_AM_PROJECT_ID);
    GC_HOSTNAME = widget_get_UserPref(WIDGET_PREF_GC_HOSTNAME);

    // ---- Main view
    view_init(AM_HOSTNAME, AM_PROJECT_ID, GC_HOSTNAME);
});