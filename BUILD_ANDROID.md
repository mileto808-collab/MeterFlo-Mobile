# Building and Installing the MeterFlo Android APK

Build the Android App Bundle (`.aab`) through EAS from Replit Shell, then use bundletool on Windows to create a signed universal APK. Install the APK over USB or distribute it through the app's GitHub repository or an admin. Google Play submission is not required for this process.

## Prerequisites

- EAS CLI available in Replit Shell and signed in to the Expo account for this project. If needed, install it with `npm install -g eas-cli`, then run `eas login`.
- Java installed on Windows, with `java` available in Command Prompt.
- [Android SDK Platform Tools](https://developer.android.com/tools/releases/platform-tools) extracted on Windows; this includes `adb.exe`.
- [bundletool](https://github.com/google/bundletool/releases) downloaded and named `bundletool.jar`.
- The existing `meterflo.keystore`, its keystore password, the signing key alias `meterflo`, and the signing key password.
- For USB installation: a connected Android phone with USB debugging enabled.

**Signing matters:** Use the same signing key used for previously distributed MeterFlo APKs. Replacing or regenerating it can prevent an APK from updating an existing installation. Keep keystores and passwords private; do not commit them to the repository or upload them with releases.

The Windows path and password values below are descriptive examples, not actual credentials.

## Step 1: Build the AAB in Replit Shell

From the project directory in **Replit Shell**, run:

```bash
eas build -p android --profile production
```

Wait for the production build to finish. Download the `.aab` using the build link shown in the terminal, or through the project's Builds page on [expo.dev](https://expo.dev).

This project already has an `eas.json` production profile. Its Android build version is managed remotely by EAS, and `production.autoIncrement` is enabled. Do not rely on manually changing a local `android.versionCode` to control the production build number.

## Step 2: Put the files in the Platform Tools directory

Use your actual extracted Platform Tools directory. For example:

```text
C:\Android\platform-tools
```

Name the downloaded bundle `meterflo.aab`. Before running bundletool, the directory should contain:

```text
C:\Android\platform-tools\
    adb.exe
    bundletool.jar
    meterflo.aab
    meterflo.keystore
```

The `.aab` and keystore must be in this directory when using the relative filenames in the command below. Keep the other files included with Platform Tools in place.

## Step 3: Open Windows Command Prompt in that directory

In **Windows Command Prompt (cmd.exe)**, run:

```cmd
cd /d "C:\Android\platform-tools"
```

Replace the example path with your actual Platform Tools directory. The `/d` option changes both the drive and directory if necessary.

## Step 4: Generate the signed universal APK archive

Run this command from the same Windows Command Prompt:

```cmd
java -jar bundletool.jar build-apks --bundle=meterflo.aab --output=meterflo.apks --ks=meterflo.keystore --ks-pass=pass:YOUR_KEYSTORE_PASSWORD --ks-key-alias=meterflo --key-pass=pass:YOUR_SIGNING_KEY_PASSWORD --mode=universal
```

Before running it:

- Replace `YOUR_KEYSTORE_PASSWORD` with the keystore password.
- Replace `YOUR_SIGNING_KEY_PASSWORD` with the password for the `meterflo` signing key. These passwords may be the same, depending on the keystore.
- Keep the signing alias `meterflo` unless your existing keystore uses a different alias.

The `pass:` prefix tells bundletool that the following value is the password. The placeholders are not literal passwords. Windows Command Prompt treats some characters specially; passwords containing those characters need appropriate cmd.exe quoting or escaping. Avoid sharing command history or screenshots containing real passwords.

This creates `meterflo.apks`, an archive containing the signed universal APK. The `.apks` archive is not itself an installable APK.

## Step 5: Extract and name the APK

1. In File Explorer, enable **File name extensions** so you can change the actual extension.
2. Rename `meterflo.apks` to `meterflo.zip`.
3. Extract the ZIP archive.
4. Find the extracted `universal.apk` and rename it to `meterflo.apk`.
5. Copy `meterflo.apk` into your Platform Tools directory so the installation command below can find it.

The filename sequence is:

```text
meterflo.aab → meterflo.apks → meterflo.zip → universal.apk → meterflo.apk
```

## Step 6: Install or distribute the APK

### Install over USB

Connect the phone to the computer, enable USB debugging, and approve the computer's USB debugging authorization prompt on the phone.

From the Platform Tools directory in Windows Command Prompt, check the connection:

```cmd
adb devices
```

The phone should be listed with the status `device`, not `unauthorized`. Then install:

```cmd
adb install meterflo.apk
```

If MeterFlo is already installed and you intend to update it while keeping its data, use:

```cmd
adb install -r meterflo.apk
```

Updating requires a compatible application ID, the same signing key, and an acceptable Android version code. Do not uninstall the existing app merely to bypass a signing mismatch: uninstalling can delete its local data.

### Obtain the APK from GitHub or an admin

Alternatively, obtain the built `meterflo.apk` from the app's GitHub repository or an admin and install it on the phone. Android may ask you to allow installation from the browser or file manager used to open the APK.

Distribute the APK, not the AAB, APK archive, signing keystore, or passwords. The app's GitHub update feature remains the distribution path for replacement APKs.

## Troubleshooting

- **Java is not recognized:** Install Java and ensure it is on the Windows PATH; reopen Command Prompt afterward.
- **Bundle or keystore file not found:** Confirm Command Prompt is in the Platform Tools directory and the filenames match the command.
- **Signing password or alias error:** Check the existing keystore's passwords and alias. Do not regenerate the signing key to resolve this.
- **Output archive already exists:** Move the previous archive to a backup location or choose a different output filename before repeating the conversion.
- **Phone is unauthorized or missing:** Unlock the phone, approve USB debugging authorization, and check the USB cable and Windows device driver.
- **Cannot install the AAB or APKS:** Complete the conversion and extraction steps, then install the extracted `.apk`.
- **Update fails with a signature or version mismatch:** Verify the original signing key, application ID, and Android version code before retrying.

## Resources

- [Expo EAS Build documentation](https://docs.expo.dev/build/setup/)
- [Android bundletool documentation](https://developer.android.com/tools/bundletool)
- [Android Platform Tools download](https://developer.android.com/tools/releases/platform-tools)