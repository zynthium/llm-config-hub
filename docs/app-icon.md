# macOS App Icon Update Process

This guide documents how to update the app icon for LLM Config Hub.

## Design Requirements

- Canvas: **1024 x 1024 px**
- Safe area: **824 x 824 px** (100px margin on each side)
- Corner radius: **185.4px** (squircle curve)
- **Draw corners manually** - macOS doesn't auto-clip like iOS

## Generate icns

```bash
# Generate all sizes from 1024px source
mkdir -p /tmp/AppIcon.iconset
for size in 16 32 128 256 512; do
  sips -z $size $size icon_1024.png --out /tmp/AppIcon.iconset/icon_${size}x${size}.png
done
sips -z 32 32   icon_1024.png --out /tmp/AppIcon.iconset/icon_16x16@2x.png
sips -z 64 64   icon_1024.png --out /tmp/AppIcon.iconset/icon_32x32@2x.png
sips -z 256 256 icon_1024.png --out /tmp/AppIcon.iconset/icon_128x128@2x.png
sips -z 512 512 icon_1024.png --out /tmp/AppIcon.iconset/icon_256x256@2x.png
cp icon_1024.png /tmp/AppIcon.iconset/icon_512x512@2x.png

# Generate icns (use iconutil only)
iconutil -c icns /tmp/AppIcon.iconset -o src-tauri/icons/icon.icns

# Sync PNGs
cp /tmp/AppIcon.iconset/icon_32x32.png   src-tauri/icons/32x32.png
cp /tmp/AppIcon.iconset/icon_128x128.png src-tauri/icons/128x128.png
cp /tmp/AppIcon.iconset/icon_256x256.png src-tauri/icons/256x256.png
cp /tmp/AppIcon.iconset/icon_512x512.png src-tauri/icons/512x512.png
cp icon_1024.png                         src-tauri/icons/icon.png
```

## Notes

- Dev mode won't show custom icon (no `.app` bundle)
- Run `npm run tauri:build` to verify
- Clear icon cache after update:

```bash
sudo rm -rf /Library/Caches/com.apple.iconservices.store && sudo killall iconservicesd; killall Dock
```
