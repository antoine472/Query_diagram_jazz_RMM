# SafranArchitecture Query Diagram (widget Jazz / RMM)

Widget de tableau de bord Jazz qui liste les diagrammes, tables et matrices d'un projet Rhapsody
stocke dans RMM, pour la configuration choisie (GC, baseline, AM stream, composant).

Version : **2026d2** (30/10/2026). Le detail de la version est dans le fichier `v2026d2`.

## Contenu

| Fichier | Role |
| --- | --- |
| `Safran_QueryDiagram.xml` | Gadget Jazz : preferences (serveur AM, projet, serveur GC), charge la page avec `?v=2026d2` |
| `Safran_QueryDiagram.html` | Page : selection, onglets All / A / B / C / D, tableau filtrable, vues Tables et Matrices |
| `css/grid.css`, `css/fonts/` | Styles, police IBM Plex Sans (licence SIL OFL) |
| `js/global.configuration.js` | Listes GC, baselines, AM streams, composants |
| `js/safran-controller.js` | Requete de reporting RMM, onglets, filtres, proprietaires des Operating Mode Charts |
| `js/safran-query-diagram.js`, `js/ELM_utils.js`, `js/types.js` | Point d'entree, outils, classes (inchanges depuis l'origine) |
| `tests/test_d2.js` | Tests unitaires (jsdom + jQuery) |

Non fournis dans ce depot, a reprendre du serveur : les bibliotheques `js/jquery/`, `js/bootstrap/`,
`js/handlebars/`, `js/font-awesome/` et le dossier `resources/` (affiches des types, icones, image de chargement).

## Installation

1. Copier les fichiers dans le dossier du widget sur le serveur, en remplacant les anciens.
2. Controle : la page affiche "Widget version : 2026d2" et les onglets All / A / B / C / D.
3. Si le tableau de bord montre l'ancienne page : supprimer le widget, puis l'ajouter avec
   l'adresse `.../Safran_QueryDiagram.xml?v=2026d2`.

## Tests

```
cd tests
npm install
TZ=Europe/Paris npm test
```

`TZ=Europe/Paris` est necessaire : les dates sont verifiees en heure locale.
