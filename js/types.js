/* ------------------------------------------------------------------------------
---- Classes
--------------------------------------------------------------------------- */
class ClassConfiguration {    // ---- Caracteristiques d'une configuration (Globale, Stream ou Baseline)
    name = ""                  // ---- Nom de la configuration
    description = ""           // ---- Description de la configuration
    url = ""                   // ---- URL de la configuration
    id = ""                    // ---- Identifiant de la configuration
    type = ""                  // ---- Type de condiguration : stream ou baseline
    part = []                  // ---- Liste des constituants d'une congiguration globale

    /**
     * Réinitialiser l'objet
     */

    empty() {
        this.name = "";
        this.description = "";
        this.url = "";
        this.id = "";
        this.type = "";

        this.part.splice(0);
    }

    /**
     * Affecter une configuration a partir d'une liste
     * @param {Array} confList - Table d'objets de type "Configuration"
     * @param {String} confId - Identifiant de la configuration
     */

    set(confList, confId) {
        for (let myConf of confList) {
            if (confId === myConf.id) {
                this.name = myConf.name;
                this.description = myConf.description;
                this.url = myConf.url;
                this.id = myConf.id;
                this.type = myConf.type;
                break;
            }
        }
    }
}
