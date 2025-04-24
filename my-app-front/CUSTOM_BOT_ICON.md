# How to Add Your Own Custom Bot Icon

This guide explains how to replace the default bot icon with your own custom image.

## Option 1: Use a Local Image

1. **Prepare your image**:
   - Create or find an image you want to use as your bot icon
   - For best results, use a square image (1:1 aspect ratio)
   - Recommended size: 256x256 pixels or larger
   - Supported formats: PNG, JPG, JPEG, GIF, WebP, SVG
   - For a circular appearance, use an image with a transparent background or crop it to a circle

2. **Add your image to the project**:
   - Place your image file in the `public/images` folder
   - For example: `public/images/my-bot-icon.png`

3. **Update the code**:
   - Open the file `components/ui/simple-bot-face.tsx`
   - Find this section (around line 16-21):
   ```javascript
   // ===================================================================
   // REPLACE THIS URL WITH YOUR OWN IMAGE URL TO USE A CUSTOM BOT ICON
   // Example: const DEFAULT_BOT_IMAGE = "/images/my-custom-bot.png";
   // Or use an external URL: const DEFAULT_BOT_IMAGE = "https://i.imgur.com/YOURIMAGE.png";
   // ===================================================================
   const DEFAULT_BOT_IMAGE = "https://i.imgur.com/aSVPWXX.png"; // Professor bot from imgur
   ```
   - Replace the URL with the path to your image:
   ```javascript
   const DEFAULT_BOT_IMAGE = "/images/my-bot-icon.png";
   ```

4. **Save the file and restart the application**

## Option 2: Use an External Image

If you prefer to use an image hosted elsewhere:

1. **Get the image URL**:
   - Upload your image to a service like Imgur, ImgBB, or any other image hosting service
   - Copy the direct URL to the image (right-click on the image and select "Copy image address")

2. **Update the code**:
   - Open the file `components/ui/simple-bot-face.tsx`
   - Find the `DEFAULT_BOT_IMAGE` line and replace it with your image URL:
   ```javascript
   const DEFAULT_BOT_IMAGE = "https://example.com/my-image.png";
   ```

3. **Save the file and restart the application**

## Important Notes

- Make sure the external image URL is from a source that allows hotlinking
- If your image doesn't appear, check the browser console for any errors related to image loading
- The image will be displayed in a circular container, so parts of the image may be cropped if it's not square
