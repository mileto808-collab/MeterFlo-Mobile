# Building MeterFlo Mobile for Google Play Store

This guide explains how to build an Android App Bundle (.aab) file for submission to the Google Play Store.

## Prerequisites

- Node.js installed
- An Expo account (create one at [expo.dev](https://expo.dev))
- A Google Play Developer account ($25 one-time fee)

## Step 1: Install EAS CLI

Install the Expo Application Services CLI globally:

```bash
npm install -g eas-cli
```

## Step 2: Login to Expo

Authenticate with your Expo account:

```bash
eas login
```

Enter your Expo credentials when prompted.

## Step 3: Configure EAS Build (First Time Only)

If this is your first build, configure EAS:

```bash
eas build:configure
```

This creates an `eas.json` file with build profiles.

## Step 4: Build the AAB File

Run the production build command:

```bash
eas build --platform android --profile production
```

### What happens during the build:

1. Your code is uploaded to Expo's build servers
2. EAS generates a signing keystore (or uses your existing one)
3. The app is compiled into an Android App Bundle
4. Build typically takes 10-20 minutes
5. You receive a download link when complete

### Build Options

| Command | Description |
|---------|-------------|
| `eas build -p android --profile production` | Production AAB for Play Store |
| `eas build -p android --profile preview` | APK for testing on devices |

## Step 5: Download Your AAB

Once the build completes:

1. Copy the download link from the terminal output, OR
2. Visit [expo.dev](https://expo.dev) → Your Project → Builds
3. Download the `.aab` file

## Step 6: Submit to Google Play Store

### First-Time Submission (Manual Upload Required)

1. Go to [Google Play Console](https://play.google.com/console)
2. Click **Create app**
3. Fill in app details (name, language, category)
4. Navigate to **Release** → **Production** → **Create new release**
5. Upload your `.aab` file
6. Complete required information:
   - Store listing (screenshots, description)
   - Content rating questionnaire
   - Data safety form
   - Target audience settings

### Automated Submissions (After First Upload)

After your first manual upload, you can automate future submissions:

```bash
eas submit --platform android
```

Or combine build and submit:

```bash
eas build --platform android --profile production --auto-submit
```

**Note:** Automated submission requires a Google Service Account key configured in your EAS dashboard.

## Managing Credentials

View or update your signing credentials:

```bash
eas credentials -p android
```

Options:
- View current keystore details
- Download keystore backup
- Upload custom keystore

## Updating Your App

When releasing updates:

1. Increment `version` in `app.json` (e.g., "1.0.1")
2. Increment `android.versionCode` in `app.json` (e.g., 2)
3. Run the build command again
4. Upload new AAB to Play Console

## Troubleshooting

### "Cannot install AAB directly on device"

AAB files are only for Play Store distribution. To test on a device, build an APK:

```bash
eas build -p android --profile preview
```

### Build fails with credential errors

Reset and regenerate credentials:

```bash
eas credentials -p android
```

### Need to use a specific keystore

You can provide your own keystore via the EAS credentials manager or by configuring `eas.json`.

## App Configuration Reference

Key settings in `app.json`:

```json
{
  "expo": {
    "name": "MeterFlo Mobile",
    "version": "1.0.0",
    "android": {
      "package": "com.meterflo.mobile",
      "versionCode": 1,
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/android-icon-foreground.png",
        "backgroundColor": "#2563EB"
      }
    }
  }
}
```

## Resources

- [Expo EAS Build Documentation](https://docs.expo.dev/build/setup/)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer)
- [Android App Bundle Guide](https://developer.android.com/guide/app-bundle)
