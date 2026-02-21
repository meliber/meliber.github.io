'use strict';

// Fix: NexT theme forcibly sets config.highlight.hljs = false, which causes
// Hexo to generate un-prefixed class names (e.g., "keyword" instead of
// "hljs-keyword"). However, NexT imports highlight.js CSS themes that use
// hljs- prefixed selectors, so the token colors never apply.
//
// This script runs after NexT's filter (priority 0) and restores hljs to true,
// so the generated HTML classes match the imported CSS selectors.
hexo.on('generateBefore', () => {
  if (hexo.config.highlight) {
    hexo.config.highlight.hljs = true;
  }
});
