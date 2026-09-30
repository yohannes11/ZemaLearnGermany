// Google AdSense settings for the course.
//
// While `client` is empty, every ad slot shows a dashed placeholder box so you can see where ads will go.
// When your AdSense account is approved:
//   1. Put your publisher id in `client` (it looks like 'ca-pub-1234567890123456').
//   2. In AdSense, create one display ad unit per slot below and paste each unit's data-ad-slot number.
//   3. Replace the line in ads.txt with the one AdSense gives you.
// Set `enabled: false` to hide all ads and placeholders.
window.ADS_CONFIG = {
  enabled: true,
  client: '',
  slots: {
    top: '',      // banner under the lesson header, every page
    sidebar: '',  // under the chapter list (computers only)
    bottom: '',   // after the exercise or word list, every page
  },
};
