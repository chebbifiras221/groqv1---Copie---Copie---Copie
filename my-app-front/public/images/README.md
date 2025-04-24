# Custom Images Folder

This folder is for storing custom images used in the application.

## Adding a Custom Bot Icon

To use your own custom bot icon:

1. Place your image file in this folder (e.g., `my-bot-icon.png`)
2. Open the file `components/ui/simple-bot-face.tsx`
3. Find the line with `const DEFAULT_BOT_IMAGE = "..."`
4. Replace it with `const DEFAULT_BOT_IMAGE = "/images/my-bot-icon.png"`

## Image Requirements

- For best results, use a square image (1:1 aspect ratio)
- Recommended size: 256x256 pixels or larger
- Supported formats: PNG, JPG, JPEG, GIF, WebP, SVG
- For a circular appearance, use an image with a transparent background or crop it to a circle

## Using External Images

You can also use images hosted elsewhere by providing the full URL:

```javascript
const DEFAULT_BOT_IMAGE = "https://example.com/my-image.png";
```

Make sure the external image URL is from a source that allows hotlinking.
