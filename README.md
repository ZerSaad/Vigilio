# Vigilio

Application de détection de somnolence du conducteur, développée dans le cadre d’un projet de fin d’année.

Vigilio analyse les signes de fatigue à partir de la caméra du téléphone et déclenche des alertes progressives. Le traitement des images s’effectue directement sur l’appareil.

> Version bêta expérimentale. Vigilio ne remplace ni le repos ni l’attention du conducteur. En cas de somnolence, arrêtez-vous dans un lieu sûr.

## Fonctionnalités

- Détection de la fermeture prolongée des yeux.
- Détection des bâillements répétés.
- Détection de la baisse de tête.
- Signalement lorsque la bouche est masquée par une main.
- Alertes sonores progressives.
- Vibrations et alerte visuelle sur Android.
- Historique des sessions et export en CSV ou JSON.

Lorsque certaines parties du visage sont masquées, l’application adapte l’importance accordée aux indicateurs encore disponibles.

## Installation sur Android

1. Ouvrez la section [Releases](../../releases).
2. Téléchargez le fichier **Vigilio-test.apk** de la version souhaitée.
3. Ouvrez-le sur votre téléphone.
4. Autorisez l’installation depuis cette source si Android le demande.
5. Lancez Vigilio et autorisez l’accès à la caméra.

L’APK est destiné à **Android uniquement**. Il ne peut pas être installé sur iPhone.

## Utilisation

1. Placez le téléphone sur un support stable, face au conducteur.
2. Vérifiez que le visage est visible et suffisamment éclairé.
3. Démarrez la surveillance et suivez les indications de calibration.
4. Gardez l’application ouverte au premier plan.

Effectuez les premiers essais à l’arrêt. Vérifiez que les alertes sont audibles avant le départ et ne manipulez pas le téléphone pendant la conduite.

## Confidentialité

- L’analyse des images est réalisée sur l’appareil.
- Les images de la caméra ne sont pas envoyées à un serveur.
- Les paramètres et l’historique sont conservés localement.
- Aucun compte utilisateur n’est nécessaire.

L’historique n’est pas synchronisé entre les appareils. Il peut être perdu après une désinstallation ou un effacement des données de l’application ; un export permet de le conserver.

## Limites

La fiabilité dépend notamment de l’éclairage, de la position du téléphone, des performances de l’appareil et de la visibilité du visage.

Les lunettes de soleil, l’obscurité ou les occultations peuvent empêcher certaines détections. Des alertes injustifiées et des signes de fatigue non détectés restent possibles.

La surveillance s’interrompt lorsque l’application passe en arrière-plan.

## Technologies

| Partie | Technologies |
|---|---|
| Interface | React, TypeScript, Vite et CSS |
| Vision par ordinateur | MediaPipe Tasks Vision |
| Traitement vidéo | Web Worker |
| Application Android | Capacitor et plugins Java |
| Stockage local | LocalStorage |
| Tests | Vitest et Playwright |
| Compilation Android | Gradle et GitHub Actions |

Vigilio utilise des modèles préentraînés pour repérer le visage et les mains. Une logique fondée sur des seuils et des durées interprète ensuite ces mesures pour déclencher les alertes.

## Développement local

Avec Node.js et npm installés :

    npm ci
    npm run assets
    npm run dev

Ouvrez ensuite l’adresse affichée dans le terminal et autorisez la caméra.

Pour exécuter les tests et compiler la version web :

    npm test
    npm run build

## Signaler un problème

Utilisez l’onglet **Issues** du dépôt en précisant :

- Le modèle du téléphone et la version d’Android.
- La version de Vigilio.
- Les étapes permettant de reproduire le problème.
- Le comportement observé.
