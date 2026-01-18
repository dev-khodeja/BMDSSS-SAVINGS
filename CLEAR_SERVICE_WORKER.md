# How to Clear Service Workers - BMDSS Savings App

## Method 1: Using Browser Console (Easiest)

Open your browser's Developer Console (F12) and type:
```javascript
unregisterServiceWorker()
```

This will automatically:
- Unregister all service workers
- Clear all caches
- Show a success message

## Method 2: Browser DevTools

### Chrome/Edge/Brave
1. Press `F12` or `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (Mac)
2. Go to **Application** tab (or **Storage** in some browsers)
3. Click **Service Workers** in the left sidebar
4. Find your service worker (should show the URL with `/sw.js`)
5. Click **Unregister** button
6. Go to **Cache Storage** in the left sidebar
7. Right-click each cache and select **Delete**
8. Or right-click **Cache Storage** and select **Clear Site Data**

### Firefox
1. Press `F12` or `Ctrl+Shift+I`
2. Go to **Application** tab
3. Click **Service Workers** in the left sidebar
4. Click **Unregister** next to your service worker
5. Click **Storage** → **Cache Storage**
6. Delete all cache entries

### Safari
1. Enable Developer menu: Safari → Preferences → Advanced → Show Develop menu
2. Press `Cmd+Option+C`
3. Go to **Storage** tab
4. Click **Service Workers** → **Unregister**
5. Click **Cache** → Delete all

## Method 3: Clear All Site Data

### Chrome/Edge
1. Click the **🔒 Lock icon** or **ℹ️ Info icon** in the address bar
2. Click **Site settings** or **Cookies and site data**
3. Click **Clear data**
4. Check all boxes (especially **Cached images and files**)
5. Click **Clear**

### Firefox
1. Click the **🔒 Lock icon** in the address bar
2. Click **Clear Cookies and Site Data**
3. Check **Cached Web Content**
4. Click **Clear**

## Method 4: Hard Refresh
- **Windows/Linux**: `Ctrl + Shift + R` or `Ctrl + F5`
- **Mac**: `Cmd + Shift + R`

Note: This only clears cache, not service workers.

## Method 5: Incognito/Private Mode
Open your app in Incognito/Private browsing mode to bypass cached service workers.

## Quick Test
After clearing, reload the page and check the console. You should see:
```
Service Worker registered: [your URL]
Service Worker ready!
```

## Troubleshooting

### If service worker won't unregister:
1. Close all tabs with your app open
2. Use DevTools to unregister
3. Clear browser cache completely
4. Restart browser

### If notifications still not working:
1. Check notification permission in browser settings
2. Clear service workers using Method 1 or 2
3. Reload page and grant permission when prompted
4. Check browser console for errors

### For Development:
Use Chrome DevTools → **Application** → **Service Workers** → Check **"Update on reload"** checkbox for automatic updates.
