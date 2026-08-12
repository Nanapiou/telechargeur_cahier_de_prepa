# Téléchargeur Cahier de Prepa

Une petite extension navigateur qui télécharge les fichiers d'une page Cahier de Prepa et les regroupe dans une archive ZIP en conservant l'arborescence.

## Utilisation

Pour l'utiliser, il suffit de télécharger le dossier de l'extension (sous format ZIP), puis de le charger dans son navigateur en tant qu'extension non empaquetée.

## Structure du projet

- `manifest.json` - manifeste de l'extension
- `popup/` - interface et logique du popup
- `content_scripts/` - script injecté dans la page pour analyser le site et construire le ZIP
- `lib/` - bibliothèques tierces (`JSZip` et `FileSaver`)
- `icons/` - icônes de l'extension
